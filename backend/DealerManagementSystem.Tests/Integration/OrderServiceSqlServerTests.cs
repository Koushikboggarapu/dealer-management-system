using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;
using DealerManagementSystem.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace DealerManagementSystem.Tests.Integration;

[Collection("SQL Server")]
[Trait("Category", "SqlServer")]
public sealed class OrderServiceSqlServerTests : IAsyncLifetime
{
    private readonly SqlServerTestDatabase _database = new();
    public Task InitializeAsync() => _database.InitializeAsync();
    public Task DisposeAsync() => _database.DisposeAsync();

    [Fact]
    public async Task Dealer_cannot_read_edit_transition_or_list_another_dealers_orders()
    {
        var otherOrder = await _database.CreateOrderAsync(_database.Dealer1, false, new OrderItemRequest(_database.ChairId, 1));
        var ownOrder = await _database.CreateOrderAsync(_database.Dealer2, false, new OrderItemRequest(_database.DeskId, 1));

        await using (var db = _database.CreateContext())
        {
            var service = new OrderService(new UnitOfWork(db));
            var error = await Assert.ThrowsAsync<AppException>(() => service.GetAsync(otherOrder, _database.Dealer2, _database.Token));
            Assert.Equal(404, error.StatusCode);
            Assert.Equal("Order not found.", error.Message);
        }
        await using (var db = _database.CreateContext())
        {
            var service = new OrderService(new UnitOfWork(db));
            var error = await Assert.ThrowsAsync<AppException>(() => service.UpdateAsync(otherOrder,
                new DraftRequest([new(_database.ChairId, 2)]), _database.Dealer2, _database.Token));
            Assert.Equal(404, error.StatusCode);
        }
        var transitionError = await Assert.ThrowsAsync<AppException>(() =>
            _database.TransitionAsync(otherOrder, OrderStatus.Cancelled, _database.Dealer2));
        Assert.Equal(404, transitionError.StatusCode);

        await using var verify = _database.CreateContext();
        var reader = new OrderService(new UnitOfWork(verify));
        var page = await reader.ListAsync(_database.Dealer2, null, null, 1, 20, _database.Token);
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(ownOrder, Assert.Single(page.Items).Id);
        var hiddenPage = await reader.ListAsync(_database.Dealer2, otherOrder.ToString(), null, 1, 20, _database.Token);
        Assert.Empty(hiddenPage.Items);
        Assert.Equal(0, hiddenPage.TotalCount);
        var order = await reader.GetAsync(otherOrder, _database.Dealer1, _database.Token);
        Assert.Equal(OrderStatus.Draft, order.Status);
        Assert.Equal(1, Assert.Single(order.Items).Quantity);
        Assert.Single(order.History);
        Assert.Equal(otherOrder, (await reader.GetAsync(otherOrder, _database.Admin, _database.Token)).Id);
    }

    [Fact]
    public async Task Approving_a_draft_is_rejected_without_changing_stock_or_history()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, false, new OrderItemRequest(_database.ChairId, 2));
        var error = await Assert.ThrowsAsync<AppException>(() =>
            _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin));
        Assert.Equal(409, error.StatusCode);

        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Draft, order.Status);
        Assert.Single(order.History);
        Assert.Equal(5, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
    }

    [Fact]
    public async Task Submitted_order_cannot_be_edited()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true, new OrderItemRequest(_database.ChairId, 1));
        await using (var db = _database.CreateContext())
        {
            var error = await Assert.ThrowsAsync<AppException>(() => new OrderService(new UnitOfWork(db))
                .UpdateAsync(id, new DraftRequest([new(_database.ChairId, 2)]), _database.Dealer1, _database.Token));
            Assert.Equal(409, error.StatusCode);
        }
        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Submitted, order.Status);
        Assert.Equal(1, Assert.Single(order.Items).Quantity);
        Assert.Equal(120m, order.Total);
        Assert.Equal(2, order.History.Count);
    }

    [Fact]
    public async Task Dealer_cannot_cancel_an_approved_order()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true, new OrderItemRequest(_database.ChairId, 1));
        await _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin);
        var error = await Assert.ThrowsAsync<AppException>(() =>
            _database.TransitionAsync(id, OrderStatus.Cancelled, _database.Dealer1));
        Assert.Equal(409, error.StatusCode);

        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Approved, order.Status);
        Assert.Equal(3, order.History.Count);
        Assert.DoesNotContain(order.History, h => h.NewStatus == OrderStatus.Cancelled);
        Assert.Equal(4, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
    }

    [Fact]
    public async Task Insufficient_stock_leaves_every_product_and_the_order_unchanged()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true,
            new OrderItemRequest(_database.ChairId, 2), new OrderItemRequest(_database.DeskId, 11));
        Dictionary<Guid, byte[]> versions;
        await using (var before = _database.CreateContext())
            versions = await before.Products.ToDictionaryAsync(p => p.Id, p => p.RowVersion, _database.Token);

        var error = await Assert.ThrowsAsync<AppException>(() =>
            _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin));
        Assert.Equal(409, error.StatusCode);
        Assert.Contains("Insufficient stock", error.Message);

        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Submitted, order.Status);
        Assert.Equal(2, order.History.Count);
        Assert.DoesNotContain(order.History, h => h.NewStatus == OrderStatus.Approved);
        Assert.Equal(5, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
        Assert.Equal(10, (await verify.Products.SingleAsync(p => p.Id == _database.DeskId, _database.Token)).AvailableStock);
        foreach (var product in await verify.Products.ToListAsync(_database.Token))
            Assert.True(versions[product.Id].SequenceEqual(product.RowVersion));
    }

    [Fact]
    public async Task Failure_after_database_writes_rolls_back_stock_status_and_history_together()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true,
            new OrderItemRequest(_database.ChairId, 2), new OrderItemRequest(_database.DeskId, 3));
        var failure = new FailAfterSaveInterceptor();
        await using (var db = _database.CreateContext(failure))
        {
            var service = new OrderService(new UnitOfWork(db));
            await Assert.ThrowsAsync<InjectedApprovalException>(() => service.TransitionAsync(id,
                new TransitionRequest(OrderStatus.Approved, "Should roll back"), _database.Admin, _database.Token));
        }
        Assert.True(failure.WritesReached);
        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Submitted, order.Status);
        Assert.Equal(2, order.History.Count);
        Assert.DoesNotContain(order.History, h => h.NewStatus == OrderStatus.Approved);
        Assert.Equal(5, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
        Assert.Equal(10, (await verify.Products.SingleAsync(p => p.Id == _database.DeskId, _database.Token)).AvailableStock);
    }

    [Fact]
    public async Task Repeated_approval_deducts_stock_and_records_approval_only_once()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true, new OrderItemRequest(_database.ChairId, 2));
        var started = DateTimeOffset.UtcNow;
        await _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin, "First approval");
        var finished = DateTimeOffset.UtcNow;
        byte[] productVersion;
        byte[] orderVersion;
        await using (var beforeRetry = _database.CreateContext())
        {
            productVersion = (await beforeRetry.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).RowVersion;
            orderVersion = (await beforeRetry.Orders.SingleAsync(o => o.Id == id, _database.Token)).RowVersion;
        }
        var repeated = await _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin, "Repeated approval");
        Assert.Equal(OrderStatus.Approved, repeated.Status);

        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        var product = await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
        Assert.Equal(3, product.AvailableStock);
        Assert.True(productVersion.SequenceEqual(product.RowVersion));
        Assert.True(orderVersion.SequenceEqual(order.RowVersion));
        var history = Assert.Single(order.History, h => h.NewStatus == OrderStatus.Approved);
        Assert.Equal(OrderStatus.Submitted, history.PreviousStatus);
        Assert.Equal(_database.Admin.UserId, history.UserId);
        Assert.Equal("First approval", history.Remarks);
        Assert.InRange(history.Timestamp, started, finished);
        Assert.Equal(3, order.History.Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Concurrent_approvals_cannot_oversell_or_deduct_twice(bool sameOrder)
    {
        var firstId = await _database.CreateOrderAsync(_database.Dealer1, true,
            new OrderItemRequest(_database.ChairId, 4), new OrderItemRequest(_database.DeskId, 2));
        var secondId = sameOrder ? firstId : await _database.CreateOrderAsync(_database.Dealer2, true,
            new OrderItemRequest(_database.ChairId, 4), new OrderItemRequest(_database.MonitorId, 2));
        var barrier = new ApprovalBarrier(_database.ChairId);

        async Task<Exception?> ApproveAsync(Guid id)
        {
            await using var db = _database.CreateContext(barrier);
            var service = new OrderService(new UnitOfWork(db));
            return await Record.ExceptionAsync(() => service.TransitionAsync(id,
                new TransitionRequest(OrderStatus.Approved, "Concurrent approval"), _database.Admin, _database.Token));
        }

        var results = await Task.WhenAll(ApproveAsync(firstId), ApproveAsync(secondId));
        Assert.Equal(2, barrier.Arrivals);
        Assert.All(barrier.ReadStocks, stock => Assert.Equal(5, stock));
        var readVersions = barrier.ReadVersions.ToArray();
        Assert.Equal(2, readVersions.Length);
        Assert.Equal(8, readVersions[0].Length);
        Assert.True(readVersions[0].SequenceEqual(readVersions[1]));
        Assert.Single(results, error => error == null);
        var conflict = Assert.IsType<AppException>(Assert.Single(results, error => error != null));
        Assert.Equal(409, conflict.StatusCode);

        await using var verify = _database.CreateContext();
        var products = await verify.Products.ToDictionaryAsync(p => p.Id, _database.Token);
        Assert.Equal(1, products[_database.ChairId].AvailableStock);
        Assert.All(products.Values, p => Assert.True(p.AvailableStock >= 0));
        var orders = await verify.Orders.Include(o => o.History).ToListAsync(_database.Token);
        var winner = Assert.Single(orders, o => o.Status == OrderStatus.Approved);
        Assert.Equal(3, winner.History.Count);
        Assert.Single(winner.History, h => h.NewStatus == OrderStatus.Approved);
        Assert.Equal(1, await verify.OrderStatusHistories.CountAsync(h => h.NewStatus == OrderStatus.Approved, _database.Token));

        if (sameOrder)
        {
            Assert.Single(orders);
            Assert.Equal(8, products[_database.DeskId].AvailableStock);
            Assert.Equal(10, products[_database.MonitorId].AvailableStock);
            await _database.TransitionAsync(firstId, OrderStatus.Approved, _database.Admin);
            await using var afterRetry = _database.CreateContext();
            Assert.Equal(1, (await afterRetry.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
            Assert.Equal(1, await afterRetry.OrderStatusHistories.CountAsync(h => h.NewStatus == OrderStatus.Approved, _database.Token));
        }
        else
        {
            var loser = Assert.Single(orders, o => o.Status == OrderStatus.Submitted);
            Assert.Equal(2, loser.History.Count);
            Assert.DoesNotContain(loser.History, h => h.NewStatus == OrderStatus.Approved);
            Assert.Equal(winner.Id == firstId ? 8 : 10, products[_database.DeskId].AvailableStock);
            Assert.Equal(winner.Id == secondId ? 8 : 10, products[_database.MonitorId].AvailableStock);
        }
    }

    [Fact]
    public async Task Submission_captures_current_prices_and_later_price_changes_do_not_change_the_order()
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, false, new OrderItemRequest(_database.ChairId, 2));
        await using (var update = _database.CreateContext())
        {
            var product = await update.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
            product.UnitPrice = 150;
            await new UnitOfWork(update).SaveAsync(_database.Token);
        }
        var submitted = await _database.TransitionAsync(id, OrderStatus.Submitted, _database.Dealer1);
        Assert.Equal(150m, Assert.Single(submitted.Items).UnitPrice);
        Assert.Equal(300m, submitted.Total);

        await using (var update = _database.CreateContext())
        {
            var product = await update.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
            product.UnitPrice = 200;
            await new UnitOfWork(update).SaveAsync(_database.Token);
        }
        await using (var read = _database.CreateContext())
        {
            var order = await new OrderService(new UnitOfWork(read)).GetAsync(id, _database.Dealer1, _database.Token);
            Assert.Equal(OrderStatus.Submitted, order.Status);
            Assert.Equal(150m, Assert.Single(order.Items).UnitPrice);
            Assert.Equal(300m, order.Total);
            var stored = await LoadOrderAsync(read, id);
            Assert.Equal(150m, Assert.Single(stored.Items).UnitPrice);
            Assert.Equal(300m, stored.Total);
        }
        await _database.TransitionAsync(id, OrderStatus.Approved, _database.Admin);
        await using var verify = _database.CreateContext();
        var approved = await LoadOrderAsync(verify, id);
        Assert.Equal(150m, Assert.Single(approved.Items).UnitPrice);
        Assert.Equal(300m, approved.Total);
        Assert.Equal(200m, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).UnitPrice);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Rejection_requires_a_nonblank_reason(string? remarks)
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, true, new OrderItemRequest(_database.ChairId, 1));
        await Assert.ThrowsAsync<ValidationException>(() =>
            _database.TransitionAsync(id, OrderStatus.Rejected, _database.Admin, remarks));
        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Submitted, order.Status);
        Assert.Equal(2, order.History.Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Owner_can_cancel_a_draft_or_submitted_order_without_changing_stock(bool submit)
    {
        var id = await _database.CreateOrderAsync(_database.Dealer1, submit, new OrderItemRequest(_database.ChairId, 1));
        await _database.TransitionAsync(id, OrderStatus.Cancelled, _database.Dealer1, "No longer required");
        await using var verify = _database.CreateContext();
        var order = await LoadOrderAsync(verify, id);
        Assert.Equal(OrderStatus.Cancelled, order.Status);
        var history = Assert.Single(order.History, h => h.NewStatus == OrderStatus.Cancelled);
        Assert.Equal(submit ? OrderStatus.Submitted : OrderStatus.Draft, history.PreviousStatus);
        Assert.Equal(_database.Dealer1.UserId, history.UserId);
        Assert.Equal("No longer required", history.Remarks);
        Assert.Equal(5, (await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token)).AvailableStock);
    }

    private Task<Order> LoadOrderAsync(DmsDbContext context, Guid id) => context.Orders
        .Include(o => o.Items).Include(o => o.History).AsSplitQuery().SingleAsync(o => o.Id == id, _database.Token);
}

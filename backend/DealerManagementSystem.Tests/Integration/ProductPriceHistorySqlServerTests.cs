using AutoMapper;
using DealerManagementSystem.API.Controllers;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Mapping;
using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;
using DealerManagementSystem.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace DealerManagementSystem.Tests.Integration;

[Collection("SQL Server")]
[Trait("Category", "SqlServer")]
public sealed class ProductPriceHistorySqlServerTests : IAsyncLifetime
{
    private readonly SqlServerTestDatabase _database = new();
    private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<MappingProfile>(), NullLoggerFactory.Instance).CreateMapper();
    public Task InitializeAsync() => _database.InitializeAsync();
    public Task DisposeAsync() => _database.DisposeAsync();
    private ManagementService Service(DmsDbContext db) => new(new UnitOfWork(db), _mapper);

    private static ProductRequest Request(Product product, decimal price) => new(product.Code, product.Name,
        product.Category, price, product.AvailableStock, product.IsActive, Convert.ToBase64String(product.RowVersion));

    private async Task<ProductRequest> CurrentRequestAsync(decimal price)
    {
        await using var db = _database.CreateContext();
        return Request(await db.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token), price);
    }

    [Fact]
    public async Task Price_change_records_authenticated_actor_timestamp_and_old_and_new_prices()
    {
        var request = await CurrentRequestAsync(150);
        var started = DateTimeOffset.UtcNow;
        await using (var db = _database.CreateContext())
        {
            var response = await Service(db).SaveProductAsync(_database.ChairId, request, _database.Admin, _database.Token);
            Assert.Equal(150m, response.UnitPrice);
            Assert.NotEqual(request.RowVersion, response.RowVersion);
        }
        var finished = DateTimeOffset.UtcNow;
        await using var verify = _database.CreateContext();
        var entry = Assert.Single(await verify.ProductPriceHistories.ToListAsync(_database.Token));
        Assert.Equal(_database.ChairId, entry.ProductId);
        Assert.Equal(_database.Admin.UserId, entry.ChangedByUserId);
        Assert.Equal(120m, entry.OldPrice);
        Assert.Equal(150m, entry.NewPrice);
        Assert.InRange(entry.ChangedAt, started, finished);
        var page = await Service(verify).ProductPriceHistoryAsync(_database.ChairId, _database.Admin, 1, 10, _database.Token);
        Assert.Equal("test-admin", Assert.Single(page.Items).ChangedByUsername);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public async Task Creation_and_non_price_edits_do_not_create_price_history()
    {
        await using (var db = _database.CreateContext())
            await Service(db).SaveProductAsync(null, new("NEW", "New product", "Test", 25, 3, true, null),
                _database.Admin, _database.Token);
        var request = (await CurrentRequestAsync(120)) with { Name = "Updated chair", AvailableStock = 4, IsActive = false };
        await using (var db = _database.CreateContext())
            await Service(db).SaveProductAsync(_database.ChairId, request, _database.Admin, _database.Token);
        await using var verify = _database.CreateContext();
        Assert.Empty(await verify.ProductPriceHistories.ToListAsync(_database.Token));
        Assert.Equal("Updated chair", (await verify.Products.FindAsync([_database.ChairId], _database.Token))!.Name);
    }

    [Fact]
    public async Task Stale_update_does_not_change_price_or_add_history()
    {
        var original = await CurrentRequestAsync(150);
        await using (var first = _database.CreateContext())
            await Service(first).SaveProductAsync(_database.ChairId, original, _database.Admin, _database.Token);
        await using (var stale = _database.CreateContext())
        {
            var error = await Assert.ThrowsAsync<AppException>(() => Service(stale).SaveProductAsync(_database.ChairId,
                original with { UnitPrice = 200 }, _database.Admin, _database.Token));
            Assert.Equal(409, error.StatusCode);
        }
        await using var verify = _database.CreateContext();
        Assert.Equal(150m, (await verify.Products.FindAsync([_database.ChairId], _database.Token))!.UnitPrice);
        Assert.Single(await verify.ProductPriceHistories.ToListAsync(_database.Token));
    }

    [Fact]
    public async Task Concurrent_price_updates_commit_only_the_winners_audit_entry()
    {
        var original = await CurrentRequestAsync(150);
        var barrier = new ApprovalBarrier(_database.ChairId);
        async Task<Exception?> UpdateAsync(decimal price)
        {
            await using var db = _database.CreateContext(barrier);
            return await Record.ExceptionAsync(() => Service(db).SaveProductAsync(_database.ChairId,
                original with { UnitPrice = price }, _database.Admin, _database.Token));
        }
        var results = await Task.WhenAll(UpdateAsync(150), UpdateAsync(200));
        Assert.Equal(2, barrier.Arrivals);
        Assert.Single(results, e => e == null);
        Assert.Equal(409, Assert.IsType<AppException>(Assert.Single(results, e => e != null)).StatusCode);
        await using var verify = _database.CreateContext();
        var entry = Assert.Single(await verify.ProductPriceHistories.ToListAsync(_database.Token));
        var product = await verify.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
        Assert.Equal(120m, entry.OldPrice);
        Assert.Equal(product.UnitPrice, entry.NewPrice);
    }

    [Fact]
    public async Task Failure_after_writes_rolls_back_price_and_history_together()
    {
        var request = await CurrentRequestAsync(150);
        var failure = new FailAfterSaveInterceptor();
        await using (var db = _database.CreateContext(failure))
            await Assert.ThrowsAsync<InjectedApprovalException>(() => Service(db).SaveProductAsync(
                _database.ChairId, request, _database.Admin, _database.Token));
        Assert.True(failure.WritesReached);
        await using var verify = _database.CreateContext();
        Assert.Equal(120m, (await verify.Products.FindAsync([_database.ChairId], _database.Token))!.UnitPrice);
        Assert.Empty(await verify.ProductPriceHistories.ToListAsync(_database.Token));
    }

    [Fact]
    public async Task Invalid_price_does_not_create_history()
    {
        var request = await CurrentRequestAsync(0);
        await using (var db = _database.CreateContext())
            await Assert.ThrowsAsync<ValidationException>(() => Service(db).SaveProductAsync(
                _database.ChairId, request, _database.Admin, _database.Token));
        await using var verify = _database.CreateContext();
        Assert.Empty(await verify.ProductPriceHistories.ToListAsync(_database.Token));
        Assert.Equal(120m, (await verify.Products.FindAsync([_database.ChairId], _database.Token))!.UnitPrice);
    }

    [Fact]
    public async Task Dealers_cannot_read_history_or_write_prices()
    {
        var request = await CurrentRequestAsync(150);
        await using var db = _database.CreateContext();
        var read = await Assert.ThrowsAsync<AppException>(() => Service(db).ProductPriceHistoryAsync(
            _database.ChairId, _database.Dealer1, 1, 10, _database.Token));
        var write = await Assert.ThrowsAsync<AppException>(() => Service(db).SaveProductAsync(
            _database.ChairId, request, _database.Dealer1, _database.Token));
        Assert.Equal(403, read.StatusCode);
        Assert.Equal(403, write.StatusCode);
        Assert.Empty(await db.ProductPriceHistories.ToListAsync(_database.Token));
        var endpoint = typeof(ProductsController).GetMethod(nameof(ProductsController.PriceHistory))!;
        Assert.Contains(endpoint.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(),
            attribute => attribute.Roles == Roles.Admin);
    }

    [Fact]
    public async Task History_is_product_scoped_newest_first_and_paginated()
    {
        var earlier = DateTimeOffset.UtcNow.AddMinutes(-2);
        await using (var seed = _database.CreateContext())
        {
            seed.ProductPriceHistories.AddRange(
                new ProductPriceHistory { ProductId = _database.ChairId, ChangedByUserId = _database.Admin.UserId,
                    ChangedAt = earlier, OldPrice = 100, NewPrice = 110 },
                new ProductPriceHistory { ProductId = _database.ChairId, ChangedByUserId = _database.Admin.UserId,
                    ChangedAt = earlier.AddMinutes(1), OldPrice = 110, NewPrice = 120 },
                new ProductPriceHistory { ProductId = _database.DeskId, ChangedByUserId = _database.Admin.UserId,
                    ChangedAt = earlier.AddMinutes(2), OldPrice = 200, NewPrice = 250 });
            await seed.SaveChangesAsync(_database.Token);
        }
        await using var db = _database.CreateContext();
        var first = await Service(db).ProductPriceHistoryAsync(_database.ChairId, _database.Admin, 1, 1, _database.Token);
        var second = await Service(db).ProductPriceHistoryAsync(_database.ChairId, _database.Admin, 2, 1, _database.Token);
        Assert.Equal(2, first.TotalCount);
        Assert.Equal(120m, Assert.Single(first.Items).NewPrice);
        Assert.Equal(110m, Assert.Single(second.Items).NewPrice);
        var empty = await Service(db).ProductPriceHistoryAsync(_database.MonitorId, _database.Admin, 1, 10, _database.Token);
        Assert.Empty(empty.Items);
        Assert.Equal(0, empty.TotalCount);
    }

    [Fact]
    public async Task History_rejects_missing_products_and_invalid_paging()
    {
        await using var db = _database.CreateContext();
        var missing = await Assert.ThrowsAsync<AppException>(() => Service(db).ProductPriceHistoryAsync(
            Guid.NewGuid(), _database.Admin, 1, 10, _database.Token));
        Assert.Equal(404, missing.StatusCode);
        var paging = await Assert.ThrowsAsync<AppException>(() => Service(db).ProductPriceHistoryAsync(
            _database.ChairId, _database.Admin, 0, 10, _database.Token));
        Assert.Equal(400, paging.StatusCode);
    }

    [Fact]
    public async Task Audited_catalog_changes_do_not_change_submitted_order_prices()
    {
        var orderId = await _database.CreateOrderAsync(_database.Dealer1, true,
            new OrderItemRequest(_database.ChairId, 2));
        var request = await CurrentRequestAsync(150);
        await using (var db = _database.CreateContext())
            await Service(db).SaveProductAsync(_database.ChairId, request, _database.Admin, _database.Token);
        await using var verify = _database.CreateContext();
        var order = await new OrderService(new UnitOfWork(verify)).GetAsync(orderId, _database.Dealer1, _database.Token);
        Assert.Equal(120m, Assert.Single(order.Items).UnitPrice);
        Assert.Equal(240m, order.Total);
        Assert.Equal(150m, Assert.Single(await verify.ProductPriceHistories.ToListAsync(_database.Token)).NewPrice);
    }

    [Fact]
    public void Migration_snapshot_matches_the_current_model()
    {
        using var db = _database.CreateContext();
        Assert.False(db.Database.HasPendingModelChanges());
    }
}

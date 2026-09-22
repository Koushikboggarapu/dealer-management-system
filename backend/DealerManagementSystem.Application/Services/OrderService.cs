using DealerManagementSystem.Application.Abstractions;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Validation;
using DealerManagementSystem.Domain.Entities;
using FluentValidation;

namespace DealerManagementSystem.Application.Services;

public class OrderService(IUnitOfWork db)
{
    public async Task<Page<OrderSummary>> ListAsync(Actor actor, string? search, OrderStatus? status,
        int page, int size, CancellationToken ct)
    {
        CheckPaging(page, size);
        Guid? dealerId = actor.IsAdmin ? null : RequireDealer(actor);
        var orders = await db.Orders.SearchAsync(dealerId, search, status, (page - 1) * size, size, ct);
        return new(orders.Select(o => new OrderSummary(o.Id, o.Dealer.CompanyName, o.Status, o.CreatedAt, o.Total)).ToList(),
            await db.Orders.SearchCountAsync(dealerId, search, status, ct), page, size);
    }

    public async Task<OrderResponse> GetAsync(Guid id, Actor actor, CancellationToken ct) =>
        Map(await GetOwnedAsync(id, actor, ct));

    public async Task<OrderResponse> CreateAsync(DraftRequest request, Actor actor, CancellationToken ct)
    {
        var dealer = await ActiveDealerAsync(actor, ct);
        await new DraftValidator().ValidateAndThrowAsync(request, ct);
        var order = new Order { DealerId = dealer.Id, Dealer = dealer };
        await SetItemsAsync(order, request, ct);
        order.History.Add(new OrderStatusHistory { NewStatus = OrderStatus.Draft, UserId = actor.UserId, Remarks = "Draft created" });
        db.Orders.Add(order);
        await db.SaveAsync(ct);
        return await GetAsync(order.Id, actor, ct);
    }

    public async Task<OrderResponse> UpdateAsync(Guid id, DraftRequest request, Actor actor, CancellationToken ct)
    {
        await ActiveDealerAsync(actor, ct);
        var order = await GetOwnedAsync(id, actor, ct);
        if (order.Status != OrderStatus.Draft) throw new AppException(409, "Only draft orders can be edited.");
        await new DraftValidator().ValidateAndThrowAsync(request, ct);
        await SetItemsAsync(order, request, ct);
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveAsync(ct);
        return Map(order);
    }

    public async Task<OrderResponse> TransitionAsync(Guid id, TransitionRequest request, Actor actor, CancellationToken ct)
    {
        await new TransitionValidator().ValidateAndThrowAsync(request, ct);
        await using var transaction = await db.BeginTransactionAsync(ct);
        var order = await GetOwnedAsync(id, actor, ct);
        if (actor.IsAdmin && request.Status == OrderStatus.Approved &&
            order.Status is OrderStatus.Approved or OrderStatus.Dispatched or OrderStatus.Delivered)
            return Map(order);

        if (!CanTransition(order.Status, request.Status, actor.IsAdmin))
            throw new AppException(409, "This status transition is not permitted.");

        if (request.Status == OrderStatus.Submitted)
        {
            await ActiveDealerAsync(actor, ct);
            if (order.Items.Count == 0) throw new AppException(400, "An order must contain at least one item.");
            foreach (var item in order.Items)
            {
                if (!item.Product.IsActive) throw new AppException(409, $"{item.Product.Name} is inactive.");
                item.UnitPrice = item.Product.UnitPrice;
            }
            order.Total = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        }
        if (request.Status == OrderStatus.Approved)
        {
            // Validate the entire order before changing stock. RowVersion protects each subsequent UPDATE.
            foreach (var item in order.Items)
                if (item.Product.AvailableStock < item.Quantity)
                    throw new AppException(409, $"Insufficient stock for {item.Product.Name}.");
            foreach (var item in order.Items.OrderBy(i => i.ProductId))
                item.Product.AvailableStock -= item.Quantity;
        }
        order.History.Add(new OrderStatusHistory
        {
            PreviousStatus = order.Status, NewStatus = request.Status,
            UserId = actor.UserId, Remarks = request.Remarks?.Trim()
        });
        order.Status = request.Status;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(id, actor, ct);
    }

    public static bool CanTransition(OrderStatus from, OrderStatus to, bool admin) => admin
        ? (from, to) is (OrderStatus.Submitted, OrderStatus.Approved or OrderStatus.Rejected)
            or (OrderStatus.Approved, OrderStatus.Dispatched) or (OrderStatus.Dispatched, OrderStatus.Delivered)
        : (from, to) is (OrderStatus.Draft, OrderStatus.Submitted or OrderStatus.Cancelled)
            or (OrderStatus.Submitted, OrderStatus.Cancelled);

    private async Task<Order> GetOwnedAsync(Guid id, Actor actor, CancellationToken ct)
    {
        var order = await db.Orders.GetDetailsAsync(id, ct);
        if (order == null || (!actor.IsAdmin && order.DealerId != RequireDealer(actor)))
            throw new AppException(404, "Order not found.");
        return order;
    }
    private async Task<Dealer> ActiveDealerAsync(Actor actor, CancellationToken ct)
    {
        var dealer = await db.Dealers.GetAsync(RequireDealer(actor), ct);
        if (dealer is not { IsActive: true }) throw new AppException(403, "Inactive dealers cannot place orders.");
        return dealer;
    }
    private static Guid RequireDealer(Actor actor) => actor.Role == Roles.Dealer && actor.DealerId.HasValue
        ? actor.DealerId.Value : throw new AppException(403, "A dealer account is required.");

    private async Task SetItemsAsync(Order order, DraftRequest request, CancellationToken ct)
    {
        foreach (var removed in order.Items.Where(i => request.Items.All(r => r.ProductId != i.ProductId)).ToList())
            order.Items.Remove(removed);
        foreach (var line in request.Items)
        {
            var product = await db.Products.GetAsync(line.ProductId, ct);
            if (product is not { IsActive: true }) throw new AppException(400, "An item references a missing or inactive product.");
            var item = order.Items.SingleOrDefault(i => i.ProductId == line.ProductId);
            if (item == null)
            {
                item = new OrderItem { ProductId = product.Id, Product = product };
                order.Items.Add(item);
            }
            item.Quantity = line.Quantity;
            item.UnitPrice = product.UnitPrice;
        }
        order.Total = order.Items.Sum(i => i.Quantity * i.UnitPrice);
    }
    public static void CheckPaging(int page, int size)
    {
        if (page < 1 || size is < 1 or > 100 || page > 1000000)
            throw new AppException(400, "Page must be positive and page size must be between 1 and 100.");
    }
    private static OrderResponse Map(Order o) => new(o.Id, o.DealerId, o.Dealer.CompanyName, o.Status, o.CreatedAt,
        o.Status == OrderStatus.Draft ? o.Items.Sum(i => i.Product.UnitPrice * i.Quantity) : o.Total,
        o.Items.Select(i => new OrderItemResponse(i.ProductId, i.Product.Name, i.Quantity,
            o.Status == OrderStatus.Draft ? i.Product.UnitPrice : i.UnitPrice,
            i.Quantity * (o.Status == OrderStatus.Draft ? i.Product.UnitPrice : i.UnitPrice))).ToList(),
        o.History.OrderBy(h => h.Timestamp).Select(h => new HistoryResponse(h.PreviousStatus, h.NewStatus,
            h.User?.Username ?? "", h.Timestamp, h.Remarks)).ToList());
}

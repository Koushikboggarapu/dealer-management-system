using AutoMapper;
using DealerManagementSystem.Application.Abstractions;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Validation;
using DealerManagementSystem.Domain.Entities;
using FluentValidation;

namespace DealerManagementSystem.Application.Services;

public class ManagementService(IUnitOfWork db, IMapper mapper)
{
    public async Task<Page<DealerResponse>> DealersAsync(string? search, int page, int size, CancellationToken ct)
    {
        OrderService.CheckPaging(page, size);
        search = search?.Trim();
        System.Linq.Expressions.Expression<Func<Dealer, bool>> filter = d => search == null ||
            d.Code.Contains(search) || d.CompanyName.Contains(search) || d.Email.Contains(search);
        var items = await db.Dealers.ListAsync(filter, (page - 1) * size, size, ct);
        return new(mapper.Map<List<DealerResponse>>(items), await db.Dealers.CountAsync(filter, ct), page, size);
    }
    public async Task<DealerResponse> DealerAsync(Guid id, CancellationToken ct) =>
        mapper.Map<DealerResponse>(await db.Dealers.GetAsync(id, ct) ?? throw new AppException(404, "Dealer not found."));

    public async Task<DealerResponse> SaveDealerAsync(Guid? id, DealerRequest request, CancellationToken ct)
    {
        await new DealerValidator().ValidateAndThrowAsync(request, ct);
        request = request with { Code = request.Code.Trim().ToUpperInvariant(), Email = request.Email.Trim().ToLowerInvariant() };
        if (await db.Dealers.CountAsync(d => d.Id != id && (d.Code == request.Code || d.Email == request.Email), ct) > 0)
            throw new AppException(409, "Dealer code and email must be unique.");
        var entity = id.HasValue ? await db.Dealers.GetAsync(id.Value, ct) ?? throw new AppException(404, "Dealer not found.") : new Dealer();
        mapper.Map(request, entity);
        if (!id.HasValue) db.Dealers.Add(entity);
        await db.SaveAsync(ct);
        return mapper.Map<DealerResponse>(entity);
    }
    public async Task<Page<ProductResponse>> ProductsAsync(bool admin, string? search, int page, int size, CancellationToken ct)
    {
        OrderService.CheckPaging(page, size);
        search = search?.Trim();
        System.Linq.Expressions.Expression<Func<Product, bool>> filter = p => (admin || p.IsActive) &&
            (search == null || p.Name.Contains(search) || p.Code.Contains(search) || p.Category.Contains(search));
        var items = await db.Products.ListAsync(filter, (page - 1) * size, size, ct);
        return new(mapper.Map<List<ProductResponse>>(items), await db.Products.CountAsync(filter, ct), page, size);
    }
    public async Task<ProductResponse> SaveProductAsync(Guid? id, ProductRequest request, Actor actor, CancellationToken ct)
    {
        if (!actor.IsAdmin) throw new AppException(403, "Only administrators can manage products.");
        await new ProductValidator().ValidateAndThrowAsync(request, ct);
        request = request with { Code = request.Code.Trim().ToUpperInvariant() };
        if (await db.Products.CountAsync(p => p.Id != id && p.Code == request.Code, ct) > 0)
            throw new AppException(409, "Product code must be unique.");
        await using var transaction = await db.BeginTransactionAsync(ct);
        var entity = id.HasValue ? await db.Products.GetAsync(id.Value, ct) ?? throw new AppException(404, "Product not found.") : new Product();
        if (id.HasValue && (request.RowVersion == null || request.RowVersion != Convert.ToBase64String(entity.RowVersion)))
            throw new AppException(409, "Product has changed. Reload before saving.");
        if (id.HasValue && entity.UnitPrice != request.UnitPrice)
            db.ProductPriceHistories.Add(new ProductPriceHistory
            {
                ProductId = entity.Id, ChangedByUserId = actor.UserId,
                OldPrice = entity.UnitPrice, NewPrice = request.UnitPrice
            });
        mapper.Map(request, entity);
        if (!id.HasValue) db.Products.Add(entity);
        await db.SaveAsync(ct);
        await transaction.CommitAsync(ct);
        return mapper.Map<ProductResponse>(entity);
    }
    public async Task<Page<ProductPriceHistoryResponse>> ProductPriceHistoryAsync(Guid productId, Actor actor,
        int page, int size, CancellationToken ct)
    {
        if (!actor.IsAdmin) throw new AppException(403, "Only administrators can view product price history.");
        OrderService.CheckPaging(page, size);
        if (await db.Products.GetAsync(productId, ct) == null) throw new AppException(404, "Product not found.");
        var history = await db.ProductPriceHistories.ForProductAsync(productId, (page - 1) * size, size, ct);
        return new(history.Select(h => new ProductPriceHistoryResponse(h.Id, h.ProductId, h.ChangedByUserId,
            h.ChangedByUser.Username, h.ChangedAt, h.OldPrice, h.NewPrice)).ToList(),
            await db.ProductPriceHistories.CountAsync(h => h.ProductId == productId, ct), page, size);
    }
    public async Task<Page<LowStockProductResponse>> LowStockProductsAsync(Actor actor, int page, int size, CancellationToken ct)
    {
        if (!actor.IsAdmin) throw new AppException(403, "Only administrators can view low-stock alerts.");
        OrderService.CheckPaging(page, size);
        System.Linq.Expressions.Expression<Func<Product, bool>> filter = p => p.IsActive && p.AvailableStock <= 5;
        var products = await db.Products.ListAsync(filter, (page - 1) * size, size, ct);
        return new(products.Select(p => new LowStockProductResponse(p.Id, p.Code, p.Name, p.AvailableStock)).ToList(),
            await db.Products.CountAsync(filter, ct), page, size);
    }
    public async Task<DashboardResponse> DashboardAsync(CancellationToken ct)
    {
        var counts = new Dictionary<string, int>();
        foreach (var status in Enum.GetValues<OrderStatus>())
            counts[status.ToString()] = await db.Orders.CountAsync(o => o.Status == status, ct);
        return new(await db.Dealers.CountAsync(_ => true, ct), counts);
    }
}
public class AuthService(IUnitOfWork db, IPasswordService passwords, ITokenService tokens)
{
    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        await new LoginValidator().ValidateAndThrowAsync(request, ct);
        var username = request.Username.Trim().ToLowerInvariant();
        var user = await db.Users.SingleAsync(u => u.Username == username, ct);
        if (user == null || !passwords.Verify(request.Password, user.PasswordHash))
            throw new AppException(401, "Invalid username or password.");
        return tokens.Create(user);
    }
}

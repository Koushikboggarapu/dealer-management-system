using System.Linq.Expressions;
using DealerManagementSystem.Application.Abstractions;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Domain.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DealerManagementSystem.Infrastructure.Persistence;

public class Repository<T>(DmsDbContext context) : IRepository<T> where T : Entity
{
    protected DmsDbContext Context { get; } = context;

    public async Task<T?> GetAsync(Guid id, CancellationToken ct) => await Context.Set<T>().FindAsync([id], ct);
    public Task<T?> SingleAsync(Expression<Func<T, bool>> predicate, CancellationToken ct) => Context.Set<T>().SingleOrDefaultAsync(predicate, ct);
    public async Task<IReadOnlyList<T>> ListAsync(Expression<Func<T, bool>> predicate, int skip, int take, CancellationToken ct) =>
        await Context.Set<T>().Where(predicate).OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync(ct);
    public Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken ct) => Context.Set<T>().CountAsync(predicate, ct);
    public void Add(T entity) => Context.Set<T>().Add(entity);
}
public class OrderRepository(DmsDbContext context) : Repository<Order>(context), IOrderRepository
{
    public Task<Order?> GetDetailsAsync(Guid id, CancellationToken ct) => Context.Orders
        .Include(x => x.Dealer).Include(x => x.Items).ThenInclude(x => x.Product)
        .Include(x => x.History).ThenInclude(x => x.User).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id, ct);
    private IQueryable<Order> Filter(Guid? dealerId, string? search, OrderStatus? status) => Context.Orders
        .Where(o => (!dealerId.HasValue || o.DealerId == dealerId) && (!status.HasValue || o.Status == status) &&
            (search == null || o.Dealer.CompanyName.Contains(search) || o.Id.ToString().Contains(search)));
    public async Task<IReadOnlyList<Order>> SearchAsync(Guid? dealerId, string? search, OrderStatus? status,
        int skip, int take, CancellationToken ct) => await Filter(dealerId, search, status)
            .Include(x => x.Dealer).AsNoTracking().OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip(skip).Take(take).ToListAsync(ct);
    public Task<int> SearchCountAsync(Guid? dealerId, string? search, OrderStatus? status, CancellationToken ct) =>
        Filter(dealerId, search, status).CountAsync(ct);
}
public class ProductPriceHistoryRepository(DmsDbContext context) : Repository<ProductPriceHistory>(context), IProductPriceHistoryRepository
{
    public async Task<IReadOnlyList<ProductPriceHistory>> ForProductAsync(Guid productId, int skip, int take, CancellationToken ct) =>
        await Context.ProductPriceHistories.AsNoTracking().Include(h => h.ChangedByUser)
            .Where(h => h.ProductId == productId).OrderByDescending(h => h.ChangedAt).ThenByDescending(h => h.Id)
            .Skip(skip).Take(take).ToListAsync(ct);
}
public class UnitOfWork(DmsDbContext context) : IUnitOfWork
{
    public IRepository<Dealer> Dealers { get; } = new Repository<Dealer>(context);
    public IRepository<Product> Products { get; } = new Repository<Product>(context);
    public IRepository<User> Users { get; } = new Repository<User>(context);
    public IOrderRepository Orders { get; } = new OrderRepository(context);
    public IProductPriceHistoryRepository ProductPriceHistories { get; } = new ProductPriceHistoryRepository(context);
    public async Task SaveAsync(CancellationToken ct)
    {
        try { await context.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new AppException(409, "The order or product changed concurrently. Reload and retry; no partial changes were committed.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            throw new AppException(409, "A record with this code or email already exists.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 1205 })
        {
            throw new AppException(409, "A concurrent operation conflicted. Reload and retry.");
        }
    }
    public async Task<ITransaction> BeginTransactionAsync(CancellationToken ct) =>
        new Transaction(await context.Database.BeginTransactionAsync(ct));
    private sealed class Transaction(IDbContextTransaction transaction) : ITransaction
    {
        public Task CommitAsync(CancellationToken ct) => transaction.CommitAsync(ct);
        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}

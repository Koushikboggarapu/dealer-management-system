using System.Linq.Expressions;
using DealerManagementSystem.Domain.Entities;

namespace DealerManagementSystem.Application.Abstractions;

public interface IRepository<T> where T : Entity
{
    Task<T?> GetAsync(Guid id, CancellationToken ct);
    Task<T?> SingleAsync(Expression<Func<T, bool>> predicate, CancellationToken ct);
    Task<IReadOnlyList<T>> ListAsync(Expression<Func<T, bool>> predicate, int skip, int take, CancellationToken ct);
    Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken ct);
    void Add(T entity);
}
public interface IOrderRepository : IRepository<Order>
{
    Task<Order?> GetDetailsAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Order>> SearchAsync(Guid? dealerId, string? search, OrderStatus? status,
        int skip, int take, CancellationToken ct);
    Task<int> SearchCountAsync(Guid? dealerId, string? search, OrderStatus? status, CancellationToken ct);
}
public interface IProductPriceHistoryRepository : IRepository<ProductPriceHistory>
{
    Task<IReadOnlyList<ProductPriceHistory>> ForProductAsync(Guid productId, int skip, int take, CancellationToken ct);
}
public interface ITransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct);
}
public interface IUnitOfWork
{
    IRepository<Dealer> Dealers { get; }
    IRepository<Product> Products { get; }
    IRepository<User> Users { get; }
    IOrderRepository Orders { get; }
    IProductPriceHistoryRepository ProductPriceHistories { get; }
    Task SaveAsync(CancellationToken ct);
    Task<ITransaction> BeginTransactionAsync(CancellationToken ct);
}
public interface IPasswordService
{
    bool Verify(string password, string hash);
}
public interface ITokenService
{
    Contracts.LoginResponse Create(User user);
}

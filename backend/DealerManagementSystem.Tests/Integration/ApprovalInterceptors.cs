using System.Collections.Concurrent;
using DealerManagementSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DealerManagementSystem.Tests.Integration;

internal sealed class ApprovalBarrier(Guid sharedProductId) : SaveChangesInterceptor
{
    private readonly TaskCompletionSource _bothReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _arrivals;
    public ConcurrentQueue<int> ReadStocks { get; } = new();
    public ConcurrentQueue<byte[]> ReadVersions { get; } = new();
    public int Arrivals => Volatile.Read(ref _arrivals);

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        var product = eventData.Context!.ChangeTracker.Entries<Product>()
            .Single(e => e.Entity.Id == sharedProductId);
        ReadStocks.Enqueue(product.Property(p => p.AvailableStock).OriginalValue);
        ReadVersions.Enqueue(product.Property(p => p.RowVersion).OriginalValue.ToArray());

        // Both services have read and validated stock; neither has issued its writes yet.
        var arrivals = Interlocked.Increment(ref _arrivals);
        if (arrivals == 2) _bothReady.TrySetResult();
        if (arrivals > 2) throw new InvalidOperationException("This barrier supports exactly two saves.");
        await _bothReady.Task.WaitAsync(TimeSpan.FromSeconds(30), cancellationToken);
        return result;
    }
}

internal sealed class InjectedApprovalException : Exception
{
    public InjectedApprovalException() : base("Simulated failure after database writes but before transaction commit.") { }
}

internal sealed class FailAfterSaveInterceptor : SaveChangesInterceptor
{
    public bool WritesReached { get; private set; }

    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        WritesReached = true;
        throw new InjectedApprovalException();
    }
}

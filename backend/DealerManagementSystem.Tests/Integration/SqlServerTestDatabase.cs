using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;
using DealerManagementSystem.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DealerManagementSystem.Tests.Integration;

[CollectionDefinition("SQL Server", DisableParallelization = true)]
public sealed class SqlServerCollection { }

public sealed class SqlServerTestDatabase : IAsyncLifetime
{
    private const string DatabasePrefix = "DmsTests_";
    private readonly string _databaseName = DatabasePrefix + Guid.NewGuid().ToString("N");
    private readonly string _connectionString;
    private readonly CancellationTokenSource _timeout = new(TimeSpan.FromMinutes(3));
    private bool _creationAttempted;

    public Guid ChairId { get; } = Guid.NewGuid();
    public Guid DeskId { get; } = Guid.NewGuid();
    public Guid MonitorId { get; } = Guid.NewGuid();
    public Actor Admin { get; } = new(Guid.NewGuid(), Roles.Admin, null);
    public Actor Dealer1 { get; } = new(Guid.NewGuid(), Roles.Dealer, Guid.NewGuid());
    public Actor Dealer2 { get; } = new(Guid.NewGuid(), Roles.Dealer, Guid.NewGuid());
    public CancellationToken Token => _timeout.Token;

    public SqlServerTestDatabase()
    {
        var configured = Environment.GetEnvironmentVariable("DMS_TEST_SQLSERVER");
        var connection = new SqlConnectionStringBuilder(string.IsNullOrWhiteSpace(configured)
            ? "Server=(localdb)\\ProjectModels;Integrated Security=True;TrustServerCertificate=True"
            : configured)
        {
            // Never use the caller's database name or attached database file.
            InitialCatalog = _databaseName,
            AttachDBFilename = "",
            Pooling = false,
            ConnectTimeout = 15,
            ConnectRetryCount = 0
        };
        _connectionString = connection.ConnectionString;
    }

    public DmsDbContext CreateContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<DmsDbContext>()
            .UseSqlServer(_connectionString, sql => sql.CommandTimeout(30));
        if (interceptors.Length > 0) options.AddInterceptors(interceptors);
        return new DmsDbContext(options.Options);
    }

    public async Task InitializeAsync()
    {
        _creationAttempted = true;
        try
        {
            await using var db = CreateContext();
            await db.Database.MigrateAsync(Token);

            db.Dealers.AddRange(CreateDealer(Dealer1, "TEST001"), CreateDealer(Dealer2, "TEST002"));
            db.Users.AddRange(CreateUser(Admin, "test-admin"), CreateUser(Dealer1, "test-dealer1"),
                CreateUser(Dealer2, "test-dealer2"));
            db.Products.AddRange(
                new Product { Id = ChairId, Code = "CHAIR", Name = "Chair", Category = "Test", UnitPrice = 120, AvailableStock = 5 },
                new Product { Id = DeskId, Code = "DESK", Name = "Desk", Category = "Test", UnitPrice = 250, AvailableStock = 10 },
                new Product { Id = MonitorId, Code = "MONITOR", Name = "Monitor", Category = "Test", UnitPrice = 300, AvailableStock = 10 });
            await db.SaveChangesAsync(Token);
        }
        catch (Exception error)
        {
            try { await DeleteDatabaseAsync(); }
            catch (Exception cleanupError)
            {
                throw new AggregateException($"Test database initialization and cleanup failed for {_databaseName}. " +
                    "Check the ProjectModels LocalDB instance or DMS_TEST_SQLSERVER and CREATE/DROP DATABASE permissions.",
                    error, cleanupError);
            }
            throw new InvalidOperationException("SQL Server test setup failed. Start (localdb)\\ProjectModels " +
                "or configure DMS_TEST_SQLSERVER for a dedicated test server. Tests require CREATE/DROP DATABASE permissions.", error);
        }
    }

    public async Task<Guid> CreateOrderAsync(Actor owner, bool submit, params OrderItemRequest[] items)
    {
        Guid id;
        await using (var db = CreateContext())
        {
            var created = await new OrderService(new UnitOfWork(db))
                .CreateAsync(new DraftRequest(items.ToList()), owner, Token);
            id = created.Id;
        }
        if (submit)
        {
            await using var db = CreateContext();
            await new OrderService(new UnitOfWork(db)).TransitionAsync(id,
                new TransitionRequest(OrderStatus.Submitted, "Submitted for test"), owner, Token);
        }
        return id;
    }

    public async Task<OrderResponse> TransitionAsync(Guid id, OrderStatus status, Actor actor, string? remarks = "Test action")
    {
        await using var db = CreateContext();
        return await new OrderService(new UnitOfWork(db))
            .TransitionAsync(id, new TransitionRequest(status, remarks), actor, Token);
    }

    public async Task DisposeAsync()
    {
        try { await DeleteDatabaseAsync(); }
        finally { _timeout.Dispose(); }
    }

    private async Task DeleteDatabaseAsync()
    {
        if (!_creationAttempted) return;
        var name = new SqlConnectionStringBuilder(_connectionString).InitialCatalog;
        if (name != _databaseName || !name.StartsWith(DatabasePrefix, StringComparison.Ordinal) ||
            !Guid.TryParseExact(name[DatabasePrefix.Length..], "N", out _))
            throw new InvalidOperationException("Refusing to delete a database not owned by this test instance.");

        using var cleanupTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync(cleanupTimeout.Token);
        _creationAttempted = false;
    }

    private static Dealer CreateDealer(Actor actor, string code) => new()
    {
        Id = actor.DealerId!.Value, Code = code, CompanyName = code, ContactPerson = "Test Contact",
        Email = $"{code.ToLowerInvariant()}@example.test", Phone = "1234567890", Address = "Test address"
    };

    private static User CreateUser(Actor actor, string username) => new()
    {
        Id = actor.UserId, Username = username, Role = actor.Role, DealerId = actor.DealerId,
        PasswordHash = "Not used by service integration tests"
    };
}

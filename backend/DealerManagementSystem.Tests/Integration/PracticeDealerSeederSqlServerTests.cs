using DealerManagementSystem.Domain.Entities;
using DealerManagementSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DealerManagementSystem.Tests.Integration;

[Collection("SQL Server")]
[Trait("Category", "SqlServer")]
public sealed class PracticeDealerSeederSqlServerTests : IAsyncLifetime
{
    private readonly SqlServerTestDatabase _database = new();
    private static readonly Guid PracticeDealerId = Guid.Parse("21517552-D7FC-499F-8299-639F7CCCF75F");
    public Task InitializeAsync() => _database.InitializeAsync();
    public Task DisposeAsync() => _database.DisposeAsync();

    private async Task AddPracticeDealerAsync()
    {
        await using var db = _database.CreateContext();
        db.Dealers.Add(new Dealer
        {
            Id = PracticeDealerId, Code = "PRACTICE01", CompanyName = "Practice Trading Company",
            ContactPerson = "Practice Contact", Email = "practice01@example.com", Phone = "9876543210",
            Address = "Hyderabad, Telangana", IsActive = true
        });
        await db.SaveChangesAsync(_database.Token);
    }

    [Fact]
    public async Task Seeds_a_hashed_login_linked_to_the_existing_profile_without_duplicates()
    {
        await AddPracticeDealerAsync();
        Guid userId;
        string hash;
        await using (var first = _database.CreateContext())
        {
            await DatabaseSeeder.SeedDevelopmentAsync(first, _database.Token);
            var user = await first.Users.SingleAsync(u => u.Username == "dealer3", _database.Token);
            userId = user.Id;
            hash = user.PasswordHash;
            Assert.Equal(PracticeDealerId, user.DealerId);
            Assert.Equal(Roles.Dealer, user.Role);
            Assert.NotEqual("Dealer@123", hash);
            Assert.True(BCrypt.Net.BCrypt.Verify("Dealer@123", hash));
        }
        await using (var again = _database.CreateContext())
            await DatabaseSeeder.SeedDevelopmentAsync(again, _database.Token);
        await using var verify = _database.CreateContext();
        var saved = Assert.Single(await verify.Users.Where(u => u.Username == "dealer3").ToListAsync(_database.Token));
        Assert.Equal(userId, saved.Id);
        Assert.Equal(hash, saved.PasswordHash);
        var dealer = Assert.Single(await verify.Dealers.Where(d => d.Code == "PRACTICE01").ToListAsync(_database.Token));
        Assert.Equal(PracticeDealerId, dealer.Id);
        Assert.Equal("Practice Trading Company", dealer.CompanyName);
    }

    [Fact]
    public async Task Missing_profile_is_not_created_and_does_not_get_a_login()
    {
        await using var db = _database.CreateContext();
        await DatabaseSeeder.SeedDevelopmentAsync(db, _database.Token);
        Assert.False(await db.Users.AnyAsync(u => u.Username == "dealer3", _database.Token));
        Assert.False(await db.Dealers.AnyAsync(d => d.Code == "PRACTICE01", _database.Token));
    }

    [Fact]
    public async Task Existing_username_is_not_reassigned_or_given_a_new_password()
    {
        await AddPracticeDealerAsync();
        var existingId = Guid.NewGuid();
        await using (var setup = _database.CreateContext())
        {
            setup.Users.Add(new User { Id = existingId, Username = "dealer3", Role = Roles.Dealer,
                DealerId = _database.Dealer1.DealerId, PasswordHash = "existing-hash" });
            await setup.SaveChangesAsync(_database.Token);
        }
        await using (var seed = _database.CreateContext())
            await DatabaseSeeder.SeedDevelopmentAsync(seed, _database.Token);
        await using var verify = _database.CreateContext();
        var user = await verify.Users.SingleAsync(u => u.Username == "dealer3", _database.Token);
        Assert.Equal(existingId, user.Id);
        Assert.Equal(_database.Dealer1.DealerId, user.DealerId);
        Assert.Equal("existing-hash", user.PasswordHash);
    }
}

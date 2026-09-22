using DealerManagementSystem.Application.Abstractions;
using DealerManagementSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DealerManagementSystem.Infrastructure.Persistence;

public class PasswordService : IPasswordService
{
    public bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}
public static class DatabaseSeeder
{
    public static async Task SeedDevelopmentAsync(DmsDbContext db, CancellationToken ct = default)
    {
        if (!await db.Users.AnyAsync(u => u.Username == "admin", ct))
            db.Users.Add(new User { Username = "admin", Role = Roles.Admin, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123") });
        if (!await db.Users.AnyAsync(u => u.Username == "dealer1", ct))
        {
            var dealer = await db.Dealers.SingleOrDefaultAsync(d => d.Code == "DLR001", ct);
            if (dealer == null)
            {
                dealer = new Dealer { Code = "DLR001", CompanyName = "Demo Dealer", ContactPerson = "Demo Contact",
                    Email = "dealer1@example.com", Phone = "1234567890", Address = "Demo address" };
                db.Dealers.Add(dealer);
            }
            db.Users.Add(new User { Username = "dealer1", Role = Roles.Dealer, Dealer = dealer,
                DealerId = dealer.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Dealer@123") });
        }
        if (!await db.Users.AnyAsync(u => u.Username == "dealer2", ct))
        {
            var dealer = await db.Dealers.SingleOrDefaultAsync(d => d.Code == "DLR002", ct);
            if (dealer == null)
            {
                dealer = new Dealer { Code = "DLR002", CompanyName = "Second Demo Dealer", ContactPerson = "Second Demo Contact",
                    Email = "dealer2@example.com", Phone = "1234567891", Address = "Second demo address" };
                db.Dealers.Add(dealer);
            }
            db.Users.Add(new User { Username = "dealer2", Role = Roles.Dealer, Dealer = dealer,
                DealerId = dealer.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Dealer@123") });
        }
        if (!await db.Users.AnyAsync(u => u.Username == "dealer3", ct))
        {
            var practiceDealerId = Guid.Parse("21517552-D7FC-499F-8299-639F7CCCF75F");
            var dealer = await db.Dealers.SingleOrDefaultAsync(d => d.Id == practiceDealerId && d.Code == "PRACTICE01", ct);
            if (dealer != null)
                db.Users.Add(new User { Username = "dealer3", Role = Roles.Dealer, Dealer = dealer,
                    DealerId = dealer.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Dealer@123") });
        }
        if (!await db.Products.AnyAsync(ct))
            db.Products.AddRange(
                new Product { Code = "PRD001", Name = "Office Chair", Category = "Furniture", UnitPrice = 120, AvailableStock = 50 },
                new Product { Code = "PRD002", Name = "Office Desk", Category = "Furniture", UnitPrice = 250, AvailableStock = 25 });
        await db.SaveChangesAsync(ct);
    }
}

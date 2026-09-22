using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DealerManagementSystem.Infrastructure.Persistence;

public sealed class DmsDbContextFactory : IDesignTimeDbContextFactory<DmsDbContext>
{
    public DmsDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connection))
            connection = "Server=(localdb)\\ProjectModels;Database=DealerManagementSystem;Trusted_Connection=True;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<DmsDbContext>().UseSqlServer(connection).Options;
        return new DmsDbContext(options);
    }
}

using AutoMapper;
using DealerManagementSystem.API.Controllers;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Mapping;
using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;
using DealerManagementSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace DealerManagementSystem.Tests.Integration;

[Collection("SQL Server")]
[Trait("Category", "SqlServer")]
public sealed class LowStockSqlServerTests : IAsyncLifetime
{
    private readonly SqlServerTestDatabase _database = new();
    private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<MappingProfile>(), NullLoggerFactory.Instance).CreateMapper();
    public Task InitializeAsync() => _database.InitializeAsync();
    public Task DisposeAsync() => _database.DisposeAsync();
    private ManagementService Service(DmsDbContext db) => new(new UnitOfWork(db), _mapper);

    [Theory]
    [InlineData(0, true, true)]
    [InlineData(5, true, true)]
    [InlineData(6, true, false)]
    [InlineData(0, false, false)]
    [InlineData(5, false, false)]
    public async Task Only_active_products_at_or_below_five_are_reported(int stock, bool active, bool expected)
    {
        await using (var update = _database.CreateContext())
        {
            var product = await update.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
            product.AvailableStock = stock;
            product.IsActive = active;
            await update.SaveChangesAsync(_database.Token);
        }
        await using var db = _database.CreateContext();
        var page = await Service(db).LowStockProductsAsync(_database.Admin, 1, 10, _database.Token);
        Assert.Equal(expected ? 1 : 0, page.TotalCount);
        if (expected)
        {
            var product = Assert.Single(page.Items);
            Assert.Equal(_database.ChairId, product.Id);
            Assert.Equal("CHAIR", product.Code);
            Assert.Equal("Chair", product.Name);
            Assert.Equal(stock, product.AvailableStock);
        }
        else Assert.Empty(page.Items);
    }

    [Fact]
    public async Task Results_and_total_are_paginated_using_the_same_filter()
    {
        await using (var update = _database.CreateContext())
        {
            foreach (var product in await update.Products.ToListAsync(_database.Token)) product.AvailableStock = 1;
            await update.SaveChangesAsync(_database.Token);
        }
        await using var db = _database.CreateContext();
        var first = await Service(db).LowStockProductsAsync(_database.Admin, 1, 2, _database.Token);
        var second = await Service(db).LowStockProductsAsync(_database.Admin, 2, 2, _database.Token);
        Assert.Equal(3, first.TotalCount);
        Assert.Equal(3, second.TotalCount);
        Assert.Equal(2, first.Items.Count);
        Assert.Single(second.Items);
        Assert.Equal(3, first.Items.Concat(second.Items).Select(p => p.Id).Distinct().Count());
        var repeated = await Service(db).LowStockProductsAsync(_database.Admin, 1, 2, _database.Token);
        Assert.Equal(first.Items.Select(p => p.Id).ToArray(), repeated.Items.Select(p => p.Id).ToArray());
    }

    [Fact]
    public async Task Refresh_reflects_approval_deduction_and_restocking()
    {
        await using (var update = _database.CreateContext())
        {
            var product = await update.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
            product.AvailableStock = 6;
            await update.SaveChangesAsync(_database.Token);
        }
        await using (var before = _database.CreateContext())
            Assert.Empty((await Service(before).LowStockProductsAsync(_database.Admin, 1, 10, _database.Token)).Items);
        var order = await _database.CreateOrderAsync(_database.Dealer1, true, new OrderItemRequest(_database.ChairId, 1));
        await _database.TransitionAsync(order, OrderStatus.Approved, _database.Admin);
        await using (var after = _database.CreateContext())
        {
            var page = await Service(after).LowStockProductsAsync(_database.Admin, 1, 10, _database.Token);
            Assert.Equal(5, Assert.Single(page.Items).AvailableStock);
            var product = await after.Products.SingleAsync(p => p.Id == _database.ChairId, _database.Token);
            await Service(after).SaveProductAsync(product.Id,
                new ProductRequest(product.Code, product.Name, product.Category, product.UnitPrice, 10,
                    product.IsActive, Convert.ToBase64String(product.RowVersion)), _database.Admin, _database.Token);
        }
        await using var restocked = _database.CreateContext();
        Assert.Empty((await Service(restocked).LowStockProductsAsync(_database.Admin, 1, 10, _database.Token)).Items);
    }

    [Fact]
    public async Task Dealer_access_is_rejected_and_controller_is_admin_only()
    {
        await using var db = _database.CreateContext();
        var error = await Assert.ThrowsAsync<AppException>(() => Service(db).LowStockProductsAsync(
            _database.Dealer1, 1, 10, _database.Token));
        Assert.Equal(403, error.StatusCode);
        Assert.Contains(typeof(DashboardController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(),
            attribute => attribute.Roles == Roles.Admin);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    public async Task Invalid_paging_is_rejected(int page, int size)
    {
        await using var db = _database.CreateContext();
        var error = await Assert.ThrowsAsync<AppException>(() => Service(db).LowStockProductsAsync(
            _database.Admin, page, size, _database.Token));
        Assert.Equal(400, error.StatusCode);
    }
}

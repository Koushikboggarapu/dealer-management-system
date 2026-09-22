using System.Security.Claims;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DealerManagementSystem.API.Controllers;

public abstract class DmsController : ControllerBase
{
    protected Actor Actor => new(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
        User.FindFirstValue(ClaimTypes.Role)!, Guid.TryParse(User.FindFirstValue("dealerId"), out var id) ? id : null);
    protected ActionResult<ApiResponse<T>> Success<T>(T data, string message = "Success") => Ok(new ApiResponse<T>(true, message, data));
}
[ApiController, Route("api/auth")]
public class AuthController(AuthService service) : DmsController
{
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("login")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login(LoginRequest request, CancellationToken ct) =>
        Success(await service.LoginAsync(request, ct));
}
[ApiController, Route("api/dealers"), Authorize(Roles = Roles.Admin)]
public class DealersController(ManagementService service) : DmsController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Page<DealerResponse>>>> List(CancellationToken ct, string? search = null, int page = 1, int size = 20) =>
        Success(await service.DealersAsync(search, page, size, ct));
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DealerResponse>>> Get(Guid id, CancellationToken ct) => Success(await service.DealerAsync(id, ct));
    [HttpPost]
    public async Task<ActionResult<ApiResponse<DealerResponse>>> Create(DealerRequest request, CancellationToken ct)
    {
        var data = await service.SaveDealerAsync(null, request, ct);
        return CreatedAtAction(nameof(Get), new { id = data.Id }, new ApiResponse<DealerResponse>(true, "Dealer created", data));
    }
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DealerResponse>>> Update(Guid id, DealerRequest request, CancellationToken ct) =>
        Success(await service.SaveDealerAsync(id, request, ct));
}
[ApiController, Route("api/products"), Authorize(Roles = Roles.Admin + "," + Roles.Dealer)]
public class ProductsController(ManagementService service) : DmsController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Page<ProductResponse>>>> List(CancellationToken ct, string? search = null, int page = 1, int size = 20) =>
        Success(await service.ProductsAsync(Actor.IsAdmin, search, page, size, ct));
    [HttpPost, Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ApiResponse<ProductResponse>>> Create(ProductRequest request, CancellationToken ct)
    {
        var data = await service.SaveProductAsync(null, request, Actor, ct);
        return StatusCode(201, new ApiResponse<ProductResponse>(true, "Product created", data));
    }
    [HttpPut("{id:guid}"), Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ApiResponse<ProductResponse>>> Update(Guid id, ProductRequest request, CancellationToken ct) =>
        Success(await service.SaveProductAsync(id, request, Actor, ct));
    [HttpGet("{id:guid}/price-history"), Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ApiResponse<Page<ProductPriceHistoryResponse>>>> PriceHistory(Guid id, CancellationToken ct,
        int page = 1, int size = 20) => Success(await service.ProductPriceHistoryAsync(id, Actor, page, size, ct));
}
[ApiController, Route("api/orders"), Authorize(Roles = Roles.Admin + "," + Roles.Dealer)]
public class OrdersController(OrderService service) : DmsController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Page<OrderSummary>>>> List(CancellationToken ct, string? search = null,
        OrderStatus? status = null, int page = 1, int size = 20) => Success(await service.ListAsync(Actor, search, status, page, size, ct));
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderResponse>>> Get(Guid id, CancellationToken ct) => Success(await service.GetAsync(id, Actor, ct));
    [HttpPost, Authorize(Roles = Roles.Dealer)]
    public async Task<ActionResult<ApiResponse<OrderResponse>>> Create(DraftRequest request, CancellationToken ct)
    {
        var data = await service.CreateAsync(request, Actor, ct);
        return CreatedAtAction(nameof(Get), new { id = data.Id }, new ApiResponse<OrderResponse>(true, "Draft created", data));
    }
    [HttpPut("{id:guid}"), Authorize(Roles = Roles.Dealer)]
    public async Task<ActionResult<ApiResponse<OrderResponse>>> Update(Guid id, DraftRequest request, CancellationToken ct) =>
        Success(await service.UpdateAsync(id, request, Actor, ct));
    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<OrderResponse>>> Transition(Guid id, TransitionRequest request, CancellationToken ct) =>
        Success(await service.TransitionAsync(id, request, Actor, ct));
}
[ApiController, Route("api/dashboard"), Authorize(Roles = Roles.Admin)]
public class DashboardController(ManagementService service) : DmsController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<DashboardResponse>>> Get(CancellationToken ct) => Success(await service.DashboardAsync(ct));
    [HttpGet("low-stock")]
    public async Task<ActionResult<ApiResponse<Page<LowStockProductResponse>>>> LowStock(CancellationToken ct,
        int page = 1, int size = 10) => Success(await service.LowStockProductsAsync(Actor, page, size, ct));
}

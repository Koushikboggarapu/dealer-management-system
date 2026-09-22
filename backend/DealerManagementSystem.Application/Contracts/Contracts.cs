using DealerManagementSystem.Domain.Entities;

namespace DealerManagementSystem.Application.Contracts;

public record ApiResponse<T>(bool Success, string Message, T? Data);
public record Page<T>(IReadOnlyList<T> Items, int TotalCount, int PageNumber, int PageSize);
public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, DateTimeOffset ExpiresAt, string Username, string Role);
public record DealerRequest(string Code, string CompanyName, string ContactPerson, string Email,
    string Phone, string Address, bool IsActive);
public record DealerResponse(Guid Id, string Code, string CompanyName, string ContactPerson,
    string Email, string Phone, string Address, bool IsActive);
public record ProductRequest(string Code, string Name, string Category, decimal UnitPrice,
    int AvailableStock, bool IsActive, string? RowVersion);
public record ProductResponse(Guid Id, string Code, string Name, string Category, decimal UnitPrice,
    int AvailableStock, bool IsActive, string RowVersion);
public record ProductPriceHistoryResponse(Guid Id, Guid ProductId, Guid ChangedByUserId, string ChangedByUsername,
    DateTimeOffset ChangedAt, decimal OldPrice, decimal NewPrice);
public record OrderItemRequest(Guid ProductId, int Quantity);
public record DraftRequest(List<OrderItemRequest> Items);
public record TransitionRequest(OrderStatus Status, string? Remarks);
public record OrderItemResponse(Guid ProductId, string ProductName, int Quantity, decimal UnitPrice, decimal Total);
public record HistoryResponse(OrderStatus? PreviousStatus, OrderStatus NewStatus, string Username,
    DateTimeOffset Timestamp, string? Remarks);
public record OrderResponse(Guid Id, Guid DealerId, string CompanyName, OrderStatus Status,
    DateTimeOffset CreatedAt, decimal Total, IReadOnlyList<OrderItemResponse> Items, IReadOnlyList<HistoryResponse> History);
public record OrderSummary(Guid Id, string CompanyName, OrderStatus Status, DateTimeOffset CreatedAt, decimal Total);
public record DashboardResponse(int DealerCount, Dictionary<string, int> OrderCounts);
public record LowStockProductResponse(Guid Id, string Code, string Name, int AvailableStock);
public record Actor(Guid UserId, string Role, Guid? DealerId)
{
    public bool IsAdmin => Role == Roles.Admin;
}
public sealed class AppException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

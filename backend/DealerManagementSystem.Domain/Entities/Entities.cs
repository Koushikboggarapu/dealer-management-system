namespace DealerManagementSystem.Domain.Entities;

public enum OrderStatus { Draft, Submitted, Approved, Dispatched, Delivered, Rejected, Cancelled }
public static class Roles
{
    public const string Admin = "Admin";
    public const string Dealer = "Dealer";
}
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
}
public class User : Entity
{
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = Roles.Dealer;
    public Guid? DealerId { get; set; }
    public Dealer? Dealer { get; set; }
}
public class Dealer : Entity
{
    public string Code { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string ContactPerson { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
public class Product : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int AvailableStock { get; set; }
    public bool IsActive { get; set; } = true;
    public byte[] RowVersion { get; set; } = [];
}
public class ProductPriceHistory : Entity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid ChangedByUserId { get; set; }
    public User ChangedByUser { get; set; } = null!;
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
}
public class Order : Entity
{
    public Guid DealerId { get; set; }
    public Dealer Dealer { get; set; } = null!;
    public OrderStatus Status { get; set; } = OrderStatus.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public decimal Total { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<OrderItem> Items { get; set; } = [];
    public List<OrderStatusHistory> History { get; set; } = [];
}
public class OrderItem : Entity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
public class OrderStatusHistory : Entity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public OrderStatus? PreviousStatus { get; set; }
    public OrderStatus NewStatus { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public string? Remarks { get; set; }
}

using DealerManagementSystem.Application.Contracts;
using FluentValidation;

namespace DealerManagementSystem.Application.Validation;

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(200);
    }
}
public class DealerValidator : AbstractValidator<DealerRequest>
{
    public DealerValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(30);
        RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ContactPerson).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(500);
    }
}
public class ProductValidator : AbstractValidator<ProductRequest>
{
    public ProductValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.UnitPrice).InclusiveBetween(0.01m, 99999999.99m).PrecisionScale(10, 2, true);
        RuleFor(x => x.AvailableStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RowVersion).Must(v => v == null || IsVersion(v)).WithMessage("Invalid row version.");
    }
    private static bool IsVersion(string value)
    {
        try { return Convert.FromBase64String(value).Length == 8; }
        catch (FormatException) { return false; }
    }
}
public class DraftValidator : AbstractValidator<DraftRequest>
{
    public DraftValidator()
    {
        RuleFor(x => x.Items).NotNull().Must(x => x != null && x.Count <= 100).WithMessage("At most 100 items are allowed.");
        RuleFor(x => x.Items).Must(x => x == null || x.Select(i => i.ProductId).Distinct().Count() == x.Count)
            .WithMessage("Each product can only appear once.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty();
            item.RuleFor(x => x.Quantity).InclusiveBetween(1, 1000000);
        });
    }
}
public class TransitionValidator : AbstractValidator<TransitionRequest>
{
    public TransitionValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Remarks).MaximumLength(1000);
        RuleFor(x => x.Remarks).NotEmpty().When(x => x.Status == Domain.Entities.OrderStatus.Rejected);
    }
}

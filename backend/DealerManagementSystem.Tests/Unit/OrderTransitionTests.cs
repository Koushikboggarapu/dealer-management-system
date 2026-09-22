using DealerManagementSystem.Application.Services;
using DealerManagementSystem.Domain.Entities;

namespace DealerManagementSystem.Tests.Unit;

[Trait("Category", "Unit")]
public class OrderTransitionTests
{
    public static IEnumerable<object[]> AllTransitions()
    {
        var adminTransitions = new HashSet<(OrderStatus, OrderStatus)>
        {
            (OrderStatus.Submitted, OrderStatus.Approved),
            (OrderStatus.Submitted, OrderStatus.Rejected),
            (OrderStatus.Approved, OrderStatus.Dispatched),
            (OrderStatus.Dispatched, OrderStatus.Delivered)
        };
        var dealerTransitions = new HashSet<(OrderStatus, OrderStatus)>
        {
            (OrderStatus.Draft, OrderStatus.Submitted),
            (OrderStatus.Draft, OrderStatus.Cancelled),
            (OrderStatus.Submitted, OrderStatus.Cancelled)
        };

        foreach (var admin in new[] { false, true })
        foreach (var from in Enum.GetValues<OrderStatus>())
        foreach (var to in Enum.GetValues<OrderStatus>())
            yield return new object[] { from, to, admin,
                (admin ? adminTransitions : dealerTransitions).Contains((from, to)) };
    }

    [Theory]
    [MemberData(nameof(AllTransitions))]
    public void CanTransition_matches_the_role_specific_workflow(
        OrderStatus from, OrderStatus to, bool admin, bool expected)
    {
        Assert.Equal(expected, OrderService.CanTransition(from, to, admin));
    }
}

using AutoMapper;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Domain.Entities;

namespace DealerManagementSystem.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Dealer, DealerResponse>();
        CreateMap<Product, ProductResponse>().ForCtorParam("RowVersion", o => o.MapFrom(s => Convert.ToBase64String(s.RowVersion)));
        CreateMap<DealerRequest, Dealer>(MemberList.None);
        CreateMap<ProductRequest, Product>(MemberList.None).ForMember(x => x.RowVersion, o => o.Ignore());
    }
}

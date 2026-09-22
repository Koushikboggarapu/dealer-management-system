using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DealerManagementSystem.Application.Abstractions;
using DealerManagementSystem.Application.Contracts;
using DealerManagementSystem.Domain.Entities;
using Microsoft.IdentityModel.Tokens;

namespace DealerManagementSystem.API.Security;

public class JwtTokenService(IConfiguration config) : ITokenService
{
    public LoginResponse Create(User user)
    {
        var expires = DateTimeOffset.UtcNow.AddMinutes(60);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role), new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        if (user.DealerId.HasValue) claims.Add(new("dealerId", user.DealerId.Value.ToString()));
        var token = new JwtSecurityToken(config["Jwt:Issuer"], config["Jwt:Audience"], claims,
            expires: expires.UtcDateTime, signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), expires, user.Username, user.Role);
    }
}

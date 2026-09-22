using DealerManagementSystem.Application.Contracts;
using FluentValidation;

namespace DealerManagementSystem.API.Middleware;

public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            var (status, message) = ex switch
            {
                AppException a => (a.StatusCode, a.Message),
                ValidationException v => (400, string.Join(" ", v.Errors.Select(e => e.ErrorMessage).Distinct())),
                _ => (500, "An unexpected error occurred. Contact support with the request ID: " + context.TraceIdentifier)
            };
            if (status == 500) logger.LogError(ex, "Request {RequestId} failed", context.TraceIdentifier);
            else logger.LogWarning("Request {RequestId} rejected: {Message}", context.TraceIdentifier, message);
            if (context.Response.HasStarted) throw;
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>(false, message, null));
        }
    }
}

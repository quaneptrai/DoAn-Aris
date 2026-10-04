namespace ArisSkyve.Infrastructure.Services;

public interface IEmailService
{
    Task<bool> SendVerificationEmailAsync(string email, string confirmUrl);
}

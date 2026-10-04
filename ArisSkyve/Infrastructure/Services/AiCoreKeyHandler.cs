using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace ArisSkyve.Infrastructure.Services
{
    // Adds the AiCore service key (configuration AiCore:ApiKey, e.g. environment variable
    // AiCore__ApiKey; must equal AICORE_API_KEY on the AiCore side) to requests sent to
    // AiCore:BaseUrl through IHttpClientFactory. Requests to any other host never carry it.
    // The key only proves the caller is this server: controllers must still check that the
    // signed-in user may act on the employee_id they forward.
    public class AiCoreKeyHandler : DelegatingHandler
    {
        public const string HeaderName = "X-AiCore-Key";
        private readonly IConfiguration _config;

        public AiCoreKeyHandler(IConfiguration config)
        {
            _config = config;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var key = _config["AiCore:ApiKey"];
            if (!string.IsNullOrWhiteSpace(key)
                && request.RequestUri != null
                && Uri.TryCreate(_config["AiCore:BaseUrl"], UriKind.Absolute, out var aiCore)
                && Uri.Compare(request.RequestUri, aiCore, UriComponents.SchemeAndServer, UriFormat.Unescaped,
                               StringComparison.OrdinalIgnoreCase) == 0
                && !request.Headers.Contains(HeaderName))
            {
                request.Headers.Add(HeaderName, key.Trim());
            }
            return base.SendAsync(request, cancellationToken);
        }
    }
}

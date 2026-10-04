using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace ArisSkyve.Infrastructure.Services
{
    // Adds the resume parser service key (configuration ResumeEngine:ParserApiKey, e.g. environment
    // variable ResumeEngine__ParserApiKey; must equal RESUME_PARSER_API_KEY on the parser side) to
    // requests sent to ResumeEngine:ParserUrl through IHttpClientFactory. Requests to any other host
    // never carry it. Needed once the parser runs outside localhost (e.g. on FastAPI Cloud).
    public class ResumeParserKeyHandler : DelegatingHandler
    {
        public const string HeaderName = "X-Resume-Parser-Key";
        public const string DefaultParserUrl = "http://127.0.0.1:8765";
        private readonly IConfiguration _config;

        public ResumeParserKeyHandler(IConfiguration config)
        {
            _config = config;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var key = _config["ResumeEngine:ParserApiKey"];
            var parserUrl = _config["ResumeEngine:ParserUrl"] ?? DefaultParserUrl;
            if (!string.IsNullOrWhiteSpace(key)
                && request.RequestUri != null
                && Uri.TryCreate(parserUrl, UriKind.Absolute, out var parser)
                && Uri.Compare(request.RequestUri, parser, UriComponents.SchemeAndServer, UriFormat.Unescaped,
                               StringComparison.OrdinalIgnoreCase) == 0
                && !request.Headers.Contains(HeaderName))
            {
                request.Headers.Add(HeaderName, key.Trim());
            }
            return base.SendAsync(request, cancellationToken);
        }
    }
}

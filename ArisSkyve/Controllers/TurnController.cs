using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace ArisSkyve.Controllers
{
    // Issues short-lived TURN credentials to the browser for WebRTC calls (video interview
    // room + chat calls). The Metered.ca secret key never leaves the server — only the
    // resulting username/password (expiring after an hour) reaches the client.
    [Authorize]
    public class TurnController : Controller
    {
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;

        public TurnController(IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet]
        public async Task<IActionResult> GetIceServers()
        {
            var appName = _config["Metered:AppName"];
            var secretKey = _config["Metered:SecretKey"];

            if (string.IsNullOrWhiteSpace(appName) || string.IsNullOrWhiteSpace(secretKey))
                return Json(new { success = true, iceServers = StunOnlyFallback() });

            try
            {
                var client = _httpClientFactory.CreateClient();
                var body = new StringContent(
                    JsonSerializer.Serialize(new { expiryInSeconds = 3600, label = "aris-call" }),
                    Encoding.UTF8, "application/json");

                var response = await client.PostAsync(
                    $"https://{appName}.metered.live/api/v1/turn/credential?secretKey={secretKey}", body);

                if (!response.IsSuccessStatusCode)
                    return Json(new { success = true, iceServers = StunOnlyFallback() });

                var cred = await response.Content.ReadFromJsonAsync<MeteredCredentialResponse>();
                if (cred?.Username == null || cred.Password == null)
                    return Json(new { success = true, iceServers = StunOnlyFallback() });

                var iceServers = new object[]
                {
                    new { urls = "stun:stun.relay.metered.ca:80" },
                    new { urls = "turn:relay.metered.ca:80", username = cred.Username, credential = cred.Password },
                    new { urls = "turn:relay.metered.ca:80?transport=tcp", username = cred.Username, credential = cred.Password },
                    new { urls = "turn:relay.metered.ca:443", username = cred.Username, credential = cred.Password },
                    new { urls = "turns:relay.metered.ca:443?transport=tcp", username = cred.Username, credential = cred.Password }
                };

                return Json(new { success = true, iceServers });
            }
            catch (Exception)
            {
                return Json(new { success = true, iceServers = StunOnlyFallback() });
            }
        }

        // Used until a Metered SecretKey is configured, and as a safety net if the Metered
        // API call fails — STUN-only still works for calls on the same network.
        private static object[] StunOnlyFallback() => new object[]
        {
            new { urls = new[] { "stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302" } }
        };

        private class MeteredCredentialResponse
        {
            public string? Username { get; set; }
            public string? Password { get; set; }
        }
    }
}

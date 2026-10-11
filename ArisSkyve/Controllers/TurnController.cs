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

        private static readonly TimeSpan MeteredTimeout = TimeSpan.FromSeconds(10);

        // Order: SecretKey (one-hour credential per call) → credential ApiKey (Metered returns the
        // iceServers list) → fixed TurnUsername/TurnCredential from the dashboard → STUN only.
        [HttpGet]
        public async Task<IActionResult> GetIceServers()
        {
            var appName = _config["Metered:AppName"];
            var secretKey = _config["Metered:SecretKey"];
            var apiKey = _config["Metered:ApiKey"];
            var username = _config["Metered:TurnUsername"];
            var password = _config["Metered:TurnCredential"];
            var fallback = string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password)
                ? StunOnlyFallback()
                : RelayServers("global.relay.metered.ca", username, password);

            if (string.IsNullOrWhiteSpace(appName))
                return Json(new { success = true, iceServers = fallback });

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = MeteredTimeout;
                if (!string.IsNullOrWhiteSpace(secretKey))
                {
                    var body = new StringContent(
                        JsonSerializer.Serialize(new { expiryInSeconds = 3600, label = "aris-call" }),
                        Encoding.UTF8, "application/json");
                    var response = await client.PostAsync(
                        $"https://{appName}.metered.live/api/v1/turn/credential?secretKey={Uri.EscapeDataString(secretKey)}", body);
                    var cred = response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<MeteredCredentialResponse>() : null;
                    if (cred?.Username != null && cred.Password != null)
                        return Json(new { success = true, iceServers = RelayServers("relay.metered.ca", cred.Username, cred.Password) });
                }
                else if (!string.IsNullOrWhiteSpace(apiKey))
                {
                    var response = await client.GetAsync(
                        $"https://{appName}.metered.live/api/v1/turn/credentials?apiKey={Uri.EscapeDataString(apiKey)}");
                    var iceServers = response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<JsonElement>() : default;
                    if (iceServers.ValueKind == JsonValueKind.Array && iceServers.GetArrayLength() > 0)
                        return Json(new { success = true, iceServers });
                }
            }
            catch (Exception)
            {
                // Metered unreachable or slow: fall through to the configured fallback.
            }
            return Json(new { success = true, iceServers = fallback });
        }

        private static object[] RelayServers(string host, string username, string password) => new object[]
        {
            new { urls = "stun:stun.relay.metered.ca:80" },
            new { urls = $"turn:{host}:80", username, credential = password },
            new { urls = $"turn:{host}:80?transport=tcp", username, credential = password },
            new { urls = $"turn:{host}:443", username, credential = password },
            new { urls = $"turns:{host}:443?transport=tcp", username, credential = password }
        };

        // Used until Metered is configured, and as a safety net if the Metered API call fails —
        // STUN-only still works for calls on the same network.
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

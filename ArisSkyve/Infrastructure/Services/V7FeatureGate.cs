using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ArisSkyve.Infrastructure.Services
{
    public interface IV7FeatureGate
    {
        bool Enabled { get; }
        bool Stories { get; }
        bool Polls { get; }
        bool SavedJobs { get; }

        // Chat reactions ship in their own migration (AddMessageReactions), so they
        // switch on separately from the V7 social tables.
        bool MessageReactions => Enabled;
    }

    public class V7FeatureGate : BackgroundService, IV7FeatureGate
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<V7FeatureGate> _logger;
        private volatile bool _enabled = false;
        private volatile bool _messageReactions = false;
        private volatile bool _ephemeralDatabase = false;

        public bool Enabled => _enabled;
        public bool Stories => _enabled;
        public bool Polls => _enabled;
        public bool SavedJobs => _enabled;
        public bool MessageReactions => _messageReactions;

        public V7FeatureGate(IServiceProvider serviceProvider, ILogger<V7FeatureGate> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// The disposable in-memory database of local previews and E2E runs is built from
        /// the current model, so every gated table exists there without any migration.
        /// </summary>
        public void EnableForEphemeralDatabase()
        {
            _ephemeralDatabase = true;
            _enabled = true;
            _messageReactions = true;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Initial check on startup + loop every 5 minutes
            while (!stoppingToken.IsCancellationRequested)
            {
                await CheckMigrationStatusAsync();
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task CheckMigrationStatusAsync()
        {
            if (_ephemeralDatabase) return;

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();

                // Set a short timeout (3 seconds) so network latency or unreachability doesn't hang startup
                db.Database.SetCommandTimeout(3);

                var appliedMigrations = (await db.Database.GetAppliedMigrationsAsync()).ToList();
                bool hasV7Social = appliedMigrations.Any(m => m.Contains("V7Social", StringComparison.OrdinalIgnoreCase));
                bool hasReactions = appliedMigrations.Any(m => m.Contains("AddMessageReactions", StringComparison.OrdinalIgnoreCase));

                if (_enabled != hasV7Social || _messageReactions != hasReactions)
                {
                    _enabled = hasV7Social;
                    _messageReactions = hasReactions;
                    _logger.LogInformation("V7FeatureGate state changed: Enabled = {State}, MessageReactions = {Reactions}", _enabled, _messageReactions);
                }
            }
            catch (Exception ex)
            {
                // Unreachable remote DB or timeout: fail-safe to false, never crash the app
                _enabled = false;
                _messageReactions = false;
                _logger.LogDebug("V7FeatureGate check skipped (database unreachable or error): {Message}", ex.Message);
            }
        }
    }
}

using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Infrastructure;
using Jellyfin.Plugin.BingeBuddy.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.BingeBuddy;

/// <summary>
/// Registers Binge Buddy services with the Jellyfin DI container.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<IGroupMembershipService, GroupMembershipService>();
        serviceCollection.AddSingleton<IUserProfileService, UserProfileService>();
        serviceCollection.AddSingleton<IItemWatchProgressService, ItemWatchProgressService>();
        serviceCollection.AddSingleton<IBingeBuddyOverlayService, BingeBuddyOverlayService>();
        serviceCollection.AddSingleton<IWatchTogetherHistoryService, WatchTogetherHistoryService>();
        serviceCollection.AddSingleton<WebScriptInjector>();
        serviceCollection.AddSingleton<IStartupFilter, BingeBuddyScriptInjectorStartup>();
    }
}

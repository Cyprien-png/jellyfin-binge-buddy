using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Plugin.BingeBuddy.Infrastructure;

/// <summary>
/// Registers the Binge Buddy script injector middleware in the ASP.NET pipeline.
/// </summary>
public class BingeBuddyScriptInjectorStartup : IStartupFilter
{
    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.UseMiddleware<BingeBuddyScriptInjectorMiddleware>();
            next(app);
        };
    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together media progress tracked for a single Jellyfin user.
/// </summary>
public class UserWatchProgress
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UserWatchProgress"/> class.
    /// </summary>
    public UserWatchProgress()
    {
        Hosts = new List<WatchTogetherHost>();
    }

    /// <summary>
    /// Gets or sets the Jellyfin user identifier.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Gets or sets watch progress grouped by host device.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<WatchTogetherHost> Hosts { get; set; }

    /// <summary>
    /// Gets or sets a legacy single-host entry kept for older configuration files.
    /// </summary>
    public WatchTogetherHost? Host { get; set; }

    /// <summary>
    /// Gets all host entries, including any legacy single-host data.
    /// </summary>
    /// <returns>The host entries for this user.</returns>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin configuration consumption.")]
    public List<WatchTogetherHost> GetAllHosts()
    {
        var hosts = Hosts ?? new List<WatchTogetherHost>();

        if (Host is not null
            && Host.HostId != Guid.Empty
            && !hosts.Any(entry => entry.HostId == Host.HostId))
        {
            hosts.Add(Host);
        }

        return hosts;
    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress for media watched on a host user's device.
/// </summary>
public class WatchTogetherHost
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchTogetherHost"/> class.
    /// </summary>
    public WatchTogetherHost()
    {
        Movies = new List<WatchedMovie>();
        Shows = new List<WatchedShow>();
    }

    /// <summary>
    /// Gets or sets the Jellyfin user identifier of the host device.
    /// </summary>
    public Guid HostId { get; set; }

    /// <summary>
    /// Gets or sets the movies watched with buddies on this host.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<WatchedMovie> Movies { get; set; }

    /// <summary>
    /// Gets or sets the TV shows watched with buddies on this host.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<WatchedShow> Shows { get; set; }
}

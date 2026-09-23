using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress persisted by the plugin.
/// </summary>
public class WatchTogetherConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchTogetherConfiguration"/> class.
    /// </summary>
    public WatchTogetherConfiguration()
    {
        Users = new List<UserWatchProgress>();
    }

    /// <summary>
    /// Gets or sets watch progress entries keyed by Jellyfin user.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<UserWatchProgress> Users { get; set; }
}

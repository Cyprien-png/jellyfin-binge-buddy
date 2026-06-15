using System;

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
        Host = new WatchTogetherHost();
    }

    /// <summary>
    /// Gets or sets the Jellyfin user identifier.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Gets or sets watch progress scoped to the host device.
    /// </summary>
    public WatchTogetherHost Host { get; set; }
}

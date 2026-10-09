using System;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Per-user plugin preferences.
/// </summary>
public class UserPluginSettings
{
    /// <summary>
    /// Gets or sets the Jellyfin user identifier.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether this user shares the date they last watched a title.
    /// </summary>
    public bool ShareWatchedDates { get; set; }
}

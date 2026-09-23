using System;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress for a TV episode.
/// </summary>
public class WatchedEpisode
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchedEpisode"/> class.
    /// </summary>
    public WatchedEpisode()
    {
        UserData = new UserItemDataSnapshot();
    }

    /// <summary>
    /// Gets or sets the Jellyfin episode item identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the saved Jellyfin user data for this episode.
    /// </summary>
    public UserItemDataSnapshot UserData { get; set; }
}

using System;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress for a movie.
/// </summary>
public class WatchedMovie
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchedMovie"/> class.
    /// </summary>
    public WatchedMovie()
    {
        UserData = new UserItemDataSnapshot();
    }

    /// <summary>
    /// Gets or sets the Jellyfin item identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the saved Jellyfin user data for this movie.
    /// </summary>
    public UserItemDataSnapshot UserData { get; set; }
}

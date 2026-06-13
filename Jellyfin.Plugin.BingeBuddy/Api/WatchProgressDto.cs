namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Jellyfin watch state for a media item.
/// </summary>
public class WatchProgressDto
{
    /// <summary>
    /// Gets or sets a value indicating whether Jellyfin marks the item as played.
    /// </summary>
    public bool Played { get; set; }

    /// <summary>
    /// Gets or sets the saved playback position in Jellyfin ticks.
    /// </summary>
    public long PlaybackPositionTicks { get; set; }

    /// <summary>
    /// Gets or sets the highest started episode index within a season, when applicable.
    /// </summary>
    public int? EpisodeIndexNumber { get; set; }

    /// <summary>
    /// Gets or sets the runtime of <see cref="EpisodeIndexNumber"/> in Jellyfin ticks.
    /// </summary>
    public long EpisodeRunTimeTicks { get; set; }
}

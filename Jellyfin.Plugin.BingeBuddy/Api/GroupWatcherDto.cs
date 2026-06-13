namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Group member watch state for a media item.
/// </summary>
public class GroupWatcherDto : GroupUserDto
{
    /// <summary>
    /// Gets or sets a value indicating whether the user marked the item as played.
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

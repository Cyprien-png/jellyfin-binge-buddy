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
}

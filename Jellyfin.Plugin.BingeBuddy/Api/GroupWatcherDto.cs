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
}

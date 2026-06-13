using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Overlay data for a media item, including buddy watch progress.
/// </summary>
public class ItemOverlayDto
{
    /// <summary>
    /// Gets or sets the item runtime in Jellyfin ticks.
    /// </summary>
    public long RunTimeTicks { get; set; }

    /// <summary>
    /// Gets or sets the authenticated user's watch progress.
    /// </summary>
    public WatchProgressDto CurrentUser { get; set; } = new();

    /// <summary>
    /// Gets or sets group members who have started the item.
    /// </summary>
    public IReadOnlyList<GroupWatcherDto> Watchers { get; set; } = Array.Empty<GroupWatcherDto>();
}

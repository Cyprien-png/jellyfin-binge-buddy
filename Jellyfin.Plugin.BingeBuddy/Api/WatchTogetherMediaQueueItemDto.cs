using System;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// A pending watch-together media item for the web client.
/// </summary>
public class WatchTogetherMediaQueueItemDto
{
    /// <summary>
    /// Gets or sets the media item identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets secondary text shown below the media name.
    /// </summary>
    public string SecondaryText { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the primary image tag when available.
    /// </summary>
    public string? PrimaryImageTag { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the item has a primary image.
    /// </summary>
    public bool HasPrimaryImage { get; set; }

    /// <summary>
    /// Gets or sets the relative image URL for the web client.
    /// </summary>
    public string? ImageUrl { get; set; }

    /// <summary>
    /// Gets or sets the media type label.
    /// </summary>
    public string MediaType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets when the item was watched together.
    /// </summary>
    public DateTime? WatchedAt { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the item is marked as played.
    /// </summary>
    public bool Played { get; set; }

    /// <summary>
    /// Gets or sets the saved playback position in Jellyfin ticks.
    /// </summary>
    public long PlaybackPositionTicks { get; set; }

    /// <summary>
    /// Gets or sets the media runtime in Jellyfin ticks.
    /// </summary>
    public long RunTimeTicks { get; set; }
}

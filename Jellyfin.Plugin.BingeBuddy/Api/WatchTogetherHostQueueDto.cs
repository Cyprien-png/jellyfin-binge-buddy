using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Pending watch-together media for a single host.
/// </summary>
public class WatchTogetherHostQueueDto
{
    /// <summary>
    /// Gets or sets the host user identifier.
    /// </summary>
    public Guid HostId { get; set; }

    /// <summary>
    /// Gets or sets the host display name.
    /// </summary>
    public string HostName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether the host has a profile image.
    /// </summary>
    public bool HostHasPrimaryImage { get; set; }

    /// <summary>
    /// Gets or sets the relative profile image URL for the host.
    /// </summary>
    public string? HostImageUrl { get; set; }

    /// <summary>
    /// Gets or sets the pending media items for this host.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for JSON serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for JSON serialization.")]
    public List<WatchTogetherMediaQueueItemDto> Media { get; set; } = new();
}

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Client payload for acknowledging pending watch-together media from a host.
/// </summary>
public class AcknowledgeWatchTogetherQueueRequest
{
    /// <summary>
    /// Gets or sets the host user identifier whose pending media is being reviewed.
    /// </summary>
    public Guid HostId { get; set; }

    /// <summary>
    /// Gets or sets the media item identifiers to apply to the current user's Jellyfin history.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for JSON deserialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for JSON deserialization.")]
    public List<Guid> SelectedMediaIds { get; set; } = new();
}

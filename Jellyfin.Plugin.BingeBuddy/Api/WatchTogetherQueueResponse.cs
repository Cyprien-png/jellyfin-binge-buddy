using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Pending watch-together media grouped by host.
/// </summary>
public class WatchTogetherQueueResponse
{
    /// <summary>
    /// Gets or sets the host queues for the current user.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for JSON serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for JSON serialization.")]
    public List<WatchTogetherHostQueueDto> Hosts { get; set; } = new();
}

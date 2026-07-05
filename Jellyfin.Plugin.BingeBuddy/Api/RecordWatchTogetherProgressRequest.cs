using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Client payload for recording watch-together progress.
/// </summary>
public class RecordWatchTogetherProgressRequest
{
    /// <summary>
    /// Gets or sets the buddy user identifiers in the active session.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for JSON deserialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for JSON deserialization.")]
    public List<Guid> BuddyUserIds { get; set; } = new();

    /// <summary>
    /// Gets or sets the movie item identifier when applicable.
    /// </summary>
    public Guid? MovieId { get; set; }

    /// <summary>
    /// Gets or sets the episode context when applicable.
    /// </summary>
    public WatchTogetherEpisodeRequest? Episode { get; set; }

    /// <summary>
    /// Gets or sets playback progress from the host player state.
    /// </summary>
    public UserItemDataSnapshotDto? UserData { get; set; }
}

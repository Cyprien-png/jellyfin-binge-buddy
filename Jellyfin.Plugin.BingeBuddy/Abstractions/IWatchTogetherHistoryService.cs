using System;
using System.Collections.Generic;
using Jellyfin.Plugin.BingeBuddy.Api;

namespace Jellyfin.Plugin.BingeBuddy.Abstractions;

/// <summary>
/// Persists watch-together session history in plugin configuration.
/// </summary>
public interface IWatchTogetherHistoryService
{
    /// <summary>
    /// Records or updates watch-together progress for each buddy in the session.
    /// </summary>
    /// <param name="hostUserId">The user who hosted playback on their device.</param>
    /// <param name="request">The media and progress payload.</param>
    void RecordProgress(Guid hostUserId, RecordWatchTogetherProgressRequest request);
}

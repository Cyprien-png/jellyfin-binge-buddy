using System;
using System.Collections.Generic;
using Jellyfin.Plugin.BingeBuddy.Api;

namespace Jellyfin.Plugin.BingeBuddy.Abstractions;

/// <summary>
/// Determines which group members have started watching media items.
/// </summary>
public interface IItemWatchProgressService
{
    /// <summary>
    /// Gets group members who have started the specified items.
    /// </summary>
    /// <param name="currentUserId">The authenticated user identifier.</param>
    /// <param name="itemIds">The media item identifiers.</param>
    /// <returns>Overlay data keyed by item identifier.</returns>
    IReadOnlyDictionary<Guid, ItemOverlayDto> GetItemOverlays(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds);
}

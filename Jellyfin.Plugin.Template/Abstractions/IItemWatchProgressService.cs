using System;
using System.Collections.Generic;
using Jellyfin.Plugin.Template.Api;

namespace Jellyfin.Plugin.Template.Abstractions;

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
    /// <returns>Watchers keyed by item identifier.</returns>
    IReadOnlyDictionary<Guid, IReadOnlyList<GroupUserDto>> GetWatchersForItems(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds);
}

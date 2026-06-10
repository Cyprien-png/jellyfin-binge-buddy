using System;
using System.Collections.Generic;
using Jellyfin.Plugin.Template.Api;

namespace Jellyfin.Plugin.Template.Abstractions;

/// <summary>
/// Builds overlay data for the web client.
/// </summary>
public interface IBingeBuddyOverlayService
{
    /// <summary>
    /// Gets watcher avatars for the requested items and user.
    /// </summary>
    /// <param name="userId">The authenticated user identifier.</param>
    /// <param name="itemIds">The media item identifiers.</param>
    /// <returns>Watchers keyed by item identifier.</returns>
    IReadOnlyDictionary<Guid, IReadOnlyList<GroupUserDto>> GetOverlaysForUser(Guid userId, IReadOnlyList<Guid> itemIds);
}

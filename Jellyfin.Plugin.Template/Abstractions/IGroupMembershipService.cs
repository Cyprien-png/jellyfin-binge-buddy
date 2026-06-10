using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.Template.Abstractions;

/// <summary>
/// Resolves group membership for binge-watching groups.
/// </summary>
public interface IGroupMembershipService
{
    /// <summary>
    /// Gets the distinct user identifiers of group members visible to the current user.
    /// </summary>
    /// <param name="currentUserId">The authenticated user identifier.</param>
    /// <returns>Distinct member identifiers excluding the current user.</returns>
    IReadOnlyList<Guid> GetVisibleMemberIds(Guid currentUserId);
}

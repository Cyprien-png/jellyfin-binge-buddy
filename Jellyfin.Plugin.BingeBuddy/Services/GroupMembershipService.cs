using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.BingeBuddy.Abstractions;

namespace Jellyfin.Plugin.BingeBuddy.Services;

/// <summary>
/// Resolves visible group members from plugin configuration.
/// </summary>
public class GroupMembershipService : IGroupMembershipService
{
    /// <inheritdoc />
    public IReadOnlyList<Guid> GetVisibleMemberIds(Guid currentUserId)
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration?.Groups is null || configuration.Groups.Count == 0)
        {
            return Array.Empty<Guid>();
        }

        var memberIds = new HashSet<Guid>();

        foreach (var group in configuration.Groups)
        {
            if (group.MemberUserIds is null || group.MemberUserIds.Count == 0)
            {
                continue;
            }

            if (!group.MemberUserIds.Contains(currentUserId))
            {
                continue;
            }

            foreach (var memberId in group.MemberUserIds)
            {
                if (memberId != currentUserId)
                {
                    memberIds.Add(memberId);
                }
            }
        }

        return memberIds.OrderBy(id => id).ToList();
    }
}

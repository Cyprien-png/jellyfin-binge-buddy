using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.Template.Abstractions;
using Jellyfin.Plugin.Template.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using Microsoft.EntityFrameworkCore;

namespace Jellyfin.Plugin.Template.Services;

/// <summary>
/// Resolves group members who have started watching media items.
/// </summary>
public class ItemWatchProgressService : IItemWatchProgressService
{
    private const int OverlayAvatarSize = 64;

    private readonly IGroupMembershipService _groupMembershipService;
    private readonly IUserProfileService _userProfileService;
    private readonly ILibraryManager _libraryManager;
    private readonly IDbContextFactory<JellyfinDbContext> _dbContextFactory;

    /// <summary>
    /// Initializes a new instance of the <see cref="ItemWatchProgressService"/> class.
    /// </summary>
    /// <param name="groupMembershipService">The group membership service.</param>
    /// <param name="userProfileService">The user profile service.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <param name="dbContextFactory">The Jellyfin database context factory.</param>
    public ItemWatchProgressService(
        IGroupMembershipService groupMembershipService,
        IUserProfileService userProfileService,
        ILibraryManager libraryManager,
        IDbContextFactory<JellyfinDbContext> dbContextFactory)
    {
        _groupMembershipService = groupMembershipService;
        _userProfileService = userProfileService;
        _libraryManager = libraryManager;
        _dbContextFactory = dbContextFactory;
    }

    /// <inheritdoc />
    public IReadOnlyDictionary<Guid, IReadOnlyList<GroupUserDto>> GetWatchersForItems(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds)
    {
        var result = new Dictionary<Guid, IReadOnlyList<GroupUserDto>>();
        if (itemIds.Count == 0)
        {
            return result;
        }

        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(currentUserId);
        if (visibleMemberIds.Count == 0)
        {
            foreach (var itemId in itemIds.Distinct())
            {
                result[itemId] = Array.Empty<GroupUserDto>();
            }

            return result;
        }

        var distinctItemIds = itemIds.Distinct().ToList();
        var supportedItemIds = distinctItemIds
            .Where(itemId => TryGetSupportedItem(itemId, currentUserId, out _))
            .ToList();

        foreach (var unsupportedItemId in distinctItemIds.Except(supportedItemIds))
        {
            result[unsupportedItemId] = Array.Empty<GroupUserDto>();
        }

        if (supportedItemIds.Count == 0)
        {
            return result;
        }

        var startedMembersByItem = LoadStartedMembersByItem(supportedItemIds, visibleMemberIds);

        foreach (var itemId in supportedItemIds)
        {
            var startedMemberIds = startedMembersByItem.GetValueOrDefault(itemId) ?? Array.Empty<Guid>();
            var watchers = startedMemberIds
                .Select(memberId => _userProfileService.MapUser(memberId, OverlayAvatarSize))
                .Where(watcher => watcher is not null)
                .Select(watcher => watcher!)
                .OrderBy(watcher => watcher.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            result[itemId] = watchers;
        }

        return result;
    }

    private Dictionary<Guid, IReadOnlyList<Guid>> LoadStartedMembersByItem(
        IReadOnlyList<Guid> itemIds,
        IReadOnlyList<Guid> memberIds)
    {
        using var context = _dbContextFactory.CreateDbContext();

        var rows = context.UserData
            .AsNoTracking()
            .Where(userData => itemIds.Contains(userData.ItemId) && memberIds.Contains(userData.UserId))
            .ToList();

        var startedMembersByItem = itemIds.ToDictionary(itemId => itemId, _ => new HashSet<Guid>());

        foreach (var row in rows)
        {
            if (!HasStartedWatching(row))
            {
                continue;
            }

            if (startedMembersByItem.TryGetValue(row.ItemId, out var memberSet))
            {
                memberSet.Add(row.UserId);
            }
        }

        return startedMembersByItem.ToDictionary(
            entry => entry.Key,
            entry => (IReadOnlyList<Guid>)entry.Value.OrderBy(id => id).ToList());
    }

    private bool TryGetSupportedItem(Guid itemId, Guid currentUserId, out BaseItem item)
    {
        item = null!;

        BaseItem? resolvedItem;
        try
        {
            resolvedItem = _libraryManager.GetItemById<BaseItem>(itemId, currentUserId);
        }
        catch (Exception)
        {
            return false;
        }

        if (resolvedItem is null)
        {
            return false;
        }

        if (resolvedItem is Movie or Episode)
        {
            item = resolvedItem;
            return true;
        }

        return false;
    }

    private static bool HasStartedWatching(UserData userData)
    {
        return userData.Played
            || userData.PlayCount > 0
            || userData.PlaybackPositionTicks > 0
            || userData.LastPlayedDate.HasValue;
    }
}

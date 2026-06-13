using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using Microsoft.EntityFrameworkCore;

namespace Jellyfin.Plugin.BingeBuddy.Services;

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
    public IReadOnlyDictionary<Guid, IReadOnlyList<GroupWatcherDto>> GetWatchersForItems(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds)
    {
        var result = new Dictionary<Guid, IReadOnlyList<GroupWatcherDto>>();
        if (itemIds.Count == 0)
        {
            return result;
        }

        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(currentUserId);
        if (visibleMemberIds.Count == 0)
        {
            foreach (var itemId in itemIds.Distinct())
            {
                result[itemId] = Array.Empty<GroupWatcherDto>();
            }

            return result;
        }

        var distinctItemIds = itemIds.Distinct().ToList();
        var supportedItemIds = distinctItemIds
            .Where(itemId => TryGetSupportedItem(itemId, currentUserId, out _))
            .ToList();

        foreach (var unsupportedItemId in distinctItemIds.Except(supportedItemIds))
        {
            result[unsupportedItemId] = Array.Empty<GroupWatcherDto>();
        }

        if (supportedItemIds.Count == 0)
        {
            return result;
        }

        var watcherProgressByItem = LoadWatcherProgressByItem(supportedItemIds, visibleMemberIds);

        foreach (var itemId in supportedItemIds)
        {
            var watcherProgress = watcherProgressByItem.GetValueOrDefault(itemId) ?? Array.Empty<MemberWatchProgress>();
            var watchers = watcherProgress
                .Select(progress => _userProfileService.MapWatcher(
                    progress.UserId,
                    progress.Played,
                    progress.PlaybackPositionTicks,
                    OverlayAvatarSize))
                .Where(watcher => watcher is not null)
                .Select(watcher => watcher!)
                .OrderBy(watcher => watcher.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            result[itemId] = watchers;
        }

        return result;
    }

    private Dictionary<Guid, IReadOnlyList<MemberWatchProgress>> LoadWatcherProgressByItem(
        IReadOnlyList<Guid> itemIds,
        IReadOnlyList<Guid> memberIds)
    {
        using var context = _dbContextFactory.CreateDbContext();

        var rows = context.UserData
            .AsNoTracking()
            .Where(userData => itemIds.Contains(userData.ItemId) && memberIds.Contains(userData.UserId))
            .ToList();

        var progressByItem = itemIds.ToDictionary(itemId => itemId, _ => new Dictionary<Guid, MemberWatchProgress>());

        foreach (var row in rows)
        {
            if (!HasStartedWatching(row))
            {
                continue;
            }

            if (!progressByItem.TryGetValue(row.ItemId, out var progressByUser))
            {
                continue;
            }

            progressByUser[row.UserId] = new MemberWatchProgress(
                row.UserId,
                row.Played,
                row.PlaybackPositionTicks);
        }

        return progressByItem.ToDictionary(
            entry => entry.Key,
            entry => (IReadOnlyList<MemberWatchProgress>)entry.Value.Values
                .OrderBy(progress => progress.UserId)
                .ToList());
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

    private sealed record MemberWatchProgress(Guid UserId, bool Played, long PlaybackPositionTicks);
}

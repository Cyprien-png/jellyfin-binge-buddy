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
    public IReadOnlyDictionary<Guid, ItemOverlayDto> GetItemOverlays(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds)
    {
        var result = new Dictionary<Guid, ItemOverlayDto>();
        if (itemIds.Count == 0)
        {
            return result;
        }

        var distinctItemIds = itemIds.Distinct().ToList();
        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(currentUserId);
        var runTimeTicksByItem = new Dictionary<Guid, long>();

        foreach (var itemId in distinctItemIds)
        {
            if (!TryGetSupportedItem(itemId, currentUserId, out var item))
            {
                result[itemId] = CreateEmptyOverlay();
                continue;
            }

            runTimeTicksByItem[itemId] = item.RunTimeTicks ?? 0;
        }

        if (runTimeTicksByItem.Count == 0)
        {
            return result;
        }

        var overlayProgress = LoadOverlayProgress(
            runTimeTicksByItem.Keys.ToList(),
            visibleMemberIds,
            currentUserId);

        foreach (var itemId in runTimeTicksByItem.Keys)
        {
            var progress = overlayProgress.GetValueOrDefault(itemId);
            var currentUserProgress = progress?.CurrentUser ?? new WatchProgressDto();
            var watcherProgress = progress?.Watchers.Values.ToList() ?? new List<MemberWatchProgress>();

            var watchers = watcherProgress
                .Select(memberProgress => _userProfileService.MapWatcher(
                    memberProgress.UserId,
                    memberProgress.Played,
                    memberProgress.PlaybackPositionTicks,
                    OverlayAvatarSize))
                .Where(watcher => watcher is not null)
                .Select(watcher => watcher!)
                .OrderBy(watcher => watcher.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            result[itemId] = new ItemOverlayDto
            {
                RunTimeTicks = runTimeTicksByItem[itemId],
                CurrentUser = currentUserProgress,
                Watchers = watchers
            };
        }

        return result;
    }

    private static ItemOverlayDto CreateEmptyOverlay()
    {
        return new ItemOverlayDto
        {
            RunTimeTicks = 0,
            CurrentUser = new WatchProgressDto(),
            Watchers = Array.Empty<GroupWatcherDto>()
        };
    }

    private Dictionary<Guid, ItemProgressSnapshot> LoadOverlayProgress(
        IReadOnlyList<Guid> itemIds,
        IReadOnlyList<Guid> memberIds,
        Guid currentUserId)
    {
        using var context = _dbContextFactory.CreateDbContext();

        var trackedUserIds = memberIds
            .Append(currentUserId)
            .Distinct()
            .ToList();

        var rows = context.UserData
            .AsNoTracking()
            .Where(userData => itemIds.Contains(userData.ItemId) && trackedUserIds.Contains(userData.UserId))
            .ToList();

        var snapshots = itemIds.ToDictionary(
            itemId => itemId,
            _ => new ItemProgressSnapshot());

        foreach (var row in rows)
        {
            if (!snapshots.TryGetValue(row.ItemId, out var snapshot))
            {
                continue;
            }

            if (row.UserId == currentUserId)
            {
                snapshot.CurrentUser = MapWatchProgress(row);
                continue;
            }

            if (!HasStartedWatching(row))
            {
                continue;
            }

            snapshot.Watchers[row.UserId] = new MemberWatchProgress(
                row.UserId,
                row.Played,
                row.PlaybackPositionTicks);
        }

        return snapshots;
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

    private static WatchProgressDto MapWatchProgress(UserData userData)
    {
        return new WatchProgressDto
        {
            Played = userData.Played,
            PlaybackPositionTicks = userData.PlaybackPositionTicks
        };
    }

    private static bool HasStartedWatching(UserData userData)
    {
        return userData.Played
            || userData.PlayCount > 0
            || userData.PlaybackPositionTicks > 0
            || userData.LastPlayedDate.HasValue;
    }

    private sealed record MemberWatchProgress(Guid UserId, bool Played, long PlaybackPositionTicks);

    private sealed class ItemProgressSnapshot
    {
        public WatchProgressDto CurrentUser { get; set; } = new();

        public Dictionary<Guid, MemberWatchProgress> Watchers { get; } = new();
    }
}

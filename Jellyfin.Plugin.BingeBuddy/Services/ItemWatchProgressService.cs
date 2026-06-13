using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using MediaBrowser.Controller.Dto;
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
    private readonly IUserManager _userManager;
    private readonly IDbContextFactory<JellyfinDbContext> _dbContextFactory;

    /// <summary>
    /// Initializes a new instance of the <see cref="ItemWatchProgressService"/> class.
    /// </summary>
    /// <param name="groupMembershipService">The group membership service.</param>
    /// <param name="userProfileService">The user profile service.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <param name="userManager">The Jellyfin user manager.</param>
    /// <param name="dbContextFactory">The Jellyfin database context factory.</param>
    public ItemWatchProgressService(
        IGroupMembershipService groupMembershipService,
        IUserProfileService userProfileService,
        ILibraryManager libraryManager,
        IUserManager userManager,
        IDbContextFactory<JellyfinDbContext> dbContextFactory)
    {
        _groupMembershipService = groupMembershipService;
        _userProfileService = userProfileService;
        _libraryManager = libraryManager;
        _userManager = userManager;
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
        var itemContexts = new Dictionary<Guid, OverlayItemContext>();

        foreach (var itemId in distinctItemIds)
        {
            if (!TryResolveOverlayItem(itemId, currentUserId, out _, out var context))
            {
                result[itemId] = CreateEmptyOverlay();
                continue;
            }

            itemContexts[itemId] = context;
        }

        if (itemContexts.Count == 0)
        {
            return result;
        }

        var overlayProgress = LoadOverlayProgress(itemContexts, visibleMemberIds, currentUserId);

        foreach (var (itemId, context) in itemContexts)
        {
            var progress = overlayProgress.GetValueOrDefault(itemId);
            var currentUserProgress = progress?.CurrentUser ?? new WatchProgressDto();
            var watcherProgress = progress?.Watchers.Values.ToList() ?? new List<MemberWatchProgress>();

            var watchers = watcherProgress
                .Select(memberProgress => _userProfileService.MapWatcher(
                    memberProgress.UserId,
                    memberProgress.Played,
                    memberProgress.PlaybackPositionTicks,
                    OverlayAvatarSize,
                    memberProgress.EpisodeIndexNumber,
                    memberProgress.EpisodeRunTimeTicks))
                .Where(watcher => watcher is not null)
                .Select(watcher => watcher!)
                .OrderBy(watcher => watcher.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            result[itemId] = new ItemOverlayDto
            {
                IsSeason = context.IsSeason,
                RunTimeTicks = context.RunTimeTicks,
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
        IReadOnlyDictionary<Guid, OverlayItemContext> itemContexts,
        IReadOnlyList<Guid> memberIds,
        Guid currentUserId)
    {
        using var context = _dbContextFactory.CreateDbContext();

        var trackedUserIds = memberIds
            .Append(currentUserId)
            .Distinct()
            .ToList();

        var progressItemToOverlayIds = new Dictionary<Guid, List<Guid>>();
        foreach (var (overlayItemId, overlayContext) in itemContexts)
        {
            foreach (var progressItemId in overlayContext.ProgressItemIds)
            {
                if (!progressItemToOverlayIds.TryGetValue(progressItemId, out var overlayItemIds))
                {
                    overlayItemIds = new List<Guid>();
                    progressItemToOverlayIds[progressItemId] = overlayItemIds;
                }

                overlayItemIds.Add(overlayItemId);
            }
        }

        var progressItemIds = progressItemToOverlayIds.Keys.ToList();
        if (progressItemIds.Count == 0)
        {
            return itemContexts.Keys.ToDictionary(itemId => itemId, _ => new ItemProgressSnapshot());
        }

        var rows = context.UserData
            .AsNoTracking()
            .Where(userData => progressItemIds.Contains(userData.ItemId) && trackedUserIds.Contains(userData.UserId))
            .ToList();

        var snapshots = itemContexts.Keys.ToDictionary(
            itemId => itemId,
            _ => new ItemProgressSnapshot());

        foreach (var row in rows)
        {
            if (!progressItemToOverlayIds.TryGetValue(row.ItemId, out var overlayItemIds))
            {
                continue;
            }

            foreach (var overlayItemId in overlayItemIds)
            {
                if (!snapshots.TryGetValue(overlayItemId, out var snapshot))
                {
                    continue;
                }

                if (!itemContexts.TryGetValue(overlayItemId, out var overlayContext))
                {
                    continue;
                }

                if (overlayContext.IsSeason)
                {
                    ApplySeasonRow(snapshot, row, overlayContext, currentUserId);
                    continue;
                }

                if (row.UserId == currentUserId)
                {
                    snapshot.CurrentUser = MergeWatchProgress(snapshot.CurrentUser, MapWatchProgress(row));
                    continue;
                }

                if (!HasStartedWatching(row))
                {
                    continue;
                }

                var incoming = new MemberWatchProgress(
                    row.UserId,
                    row.Played,
                    row.PlaybackPositionTicks,
                    null,
                    0);

                snapshot.Watchers[row.UserId] = snapshot.Watchers.TryGetValue(row.UserId, out var existing)
                    ? MergeMemberProgress(existing, incoming)
                    : incoming;
            }
        }

        return snapshots;
    }

    private static void ApplySeasonRow(
        ItemProgressSnapshot snapshot,
        UserData row,
        OverlayItemContext overlayContext,
        Guid currentUserId)
    {
        if (!overlayContext.EpisodeMetadataById.TryGetValue(row.ItemId, out var episodeMetadata))
        {
            return;
        }

        if (row.UserId == currentUserId)
        {
            if (!HasStartedWatching(row))
            {
                return;
            }

            snapshot.CurrentUser = MergeSeasonWatchProgress(
                snapshot.CurrentUser,
                MapSeasonWatchProgress(row, episodeMetadata));
            return;
        }

        if (!HasStartedWatching(row))
        {
            return;
        }

        var incoming = new MemberWatchProgress(
            row.UserId,
            row.Played,
            row.PlaybackPositionTicks,
            episodeMetadata.IndexNumber,
            episodeMetadata.RunTimeTicks);

        snapshot.Watchers[row.UserId] = snapshot.Watchers.TryGetValue(row.UserId, out var existing)
            ? MergeSeasonMemberProgress(existing, incoming)
            : incoming;
    }

    private bool TryResolveOverlayItem(
        Guid itemId,
        Guid currentUserId,
        out BaseItem item,
        out OverlayItemContext context)
    {
        item = null!;
        context = null!;

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

        if (resolvedItem is Movie movie)
        {
            item = movie;
            context = new OverlayItemContext
            {
                RunTimeTicks = movie.RunTimeTicks ?? 0,
                ProgressItemIds = new[] { itemId }
            };
            return true;
        }

        if (resolvedItem is Episode episode)
        {
            item = episode;
            context = new OverlayItemContext
            {
                RunTimeTicks = episode.RunTimeTicks ?? 0,
                ProgressItemIds = new[] { itemId }
            };
            return true;
        }

        if (resolvedItem is Season season)
        {
            item = season;
            var episodes = GetSeasonEpisodes(season, currentUserId);
            context = new OverlayItemContext
            {
                IsSeason = true,
                RunTimeTicks = 0,
                ProgressItemIds = episodes.Select(episode => episode.Id).ToList(),
                EpisodeMetadataById = BuildEpisodeMetadata(episodes)
            };
            return true;
        }

        return false;
    }

    private List<BaseItem> GetSeasonEpisodes(Season season, Guid userId)
    {
        var user = _userManager.GetUserById(userId);
        return season.GetEpisodes(user, new DtoOptions(true), shouldIncludeMissingEpisodes: true);
    }

    private static Dictionary<Guid, EpisodeMetadata> BuildEpisodeMetadata(IReadOnlyList<BaseItem> episodes)
    {
        var orderedEpisodes = episodes
            .OrderBy(episode => episode.IndexNumber ?? int.MaxValue)
            .ThenBy(episode => episode.SortName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(episode => episode.Id)
            .ToList();

        var metadata = new Dictionary<Guid, EpisodeMetadata>();
        for (var i = 0; i < orderedEpisodes.Count; i++)
        {
            var episode = orderedEpisodes[i];
            metadata[episode.Id] = new EpisodeMetadata(
                ResolveEpisodeNumber(episode, i + 1),
                episode.RunTimeTicks ?? 0);
        }

        return metadata;
    }

    private static int ResolveEpisodeNumber(BaseItem episode, int fallbackNumber)
    {
        if (episode.IndexNumber is > 0)
        {
            return episode.IndexNumber.Value;
        }

        return fallbackNumber;
    }

    private static WatchProgressDto MapWatchProgress(UserData userData)
    {
        return new WatchProgressDto
        {
            Played = userData.Played,
            PlaybackPositionTicks = userData.PlaybackPositionTicks
        };
    }

    private static WatchProgressDto MapSeasonWatchProgress(UserData userData, EpisodeMetadata episodeMetadata)
    {
        return new WatchProgressDto
        {
            Played = userData.Played,
            PlaybackPositionTicks = userData.PlaybackPositionTicks,
            EpisodeIndexNumber = episodeMetadata.IndexNumber,
            EpisodeRunTimeTicks = episodeMetadata.RunTimeTicks
        };
    }

    private static WatchProgressDto MergeWatchProgress(WatchProgressDto existing, WatchProgressDto incoming)
    {
        if (incoming.Played)
        {
            return incoming;
        }

        if (existing.Played)
        {
            return existing;
        }

        return incoming.PlaybackPositionTicks > existing.PlaybackPositionTicks
            ? incoming
            : existing;
    }

    private static WatchProgressDto MergeSeasonWatchProgress(WatchProgressDto existing, WatchProgressDto incoming)
    {
        var existingIndex = existing.EpisodeIndexNumber ?? -1;
        var incomingIndex = incoming.EpisodeIndexNumber ?? -1;

        if (incomingIndex > existingIndex)
        {
            return incoming;
        }

        if (incomingIndex < existingIndex)
        {
            return existing;
        }

        if (incoming.Played)
        {
            return incoming;
        }

        if (existing.Played)
        {
            return existing;
        }

        return incoming.PlaybackPositionTicks > existing.PlaybackPositionTicks
            ? incoming
            : existing;
    }

    private static MemberWatchProgress MergeMemberProgress(MemberWatchProgress existing, MemberWatchProgress incoming)
    {
        if (incoming.Played)
        {
            return incoming;
        }

        if (existing.Played)
        {
            return existing;
        }

        return incoming.PlaybackPositionTicks > existing.PlaybackPositionTicks
            ? incoming
            : existing;
    }

    private static MemberWatchProgress MergeSeasonMemberProgress(MemberWatchProgress existing, MemberWatchProgress incoming)
    {
        var existingIndex = existing.EpisodeIndexNumber ?? -1;
        var incomingIndex = incoming.EpisodeIndexNumber ?? -1;

        if (incomingIndex > existingIndex)
        {
            return incoming;
        }

        if (incomingIndex < existingIndex)
        {
            return existing;
        }

        if (incoming.Played)
        {
            return incoming;
        }

        if (existing.Played)
        {
            return existing;
        }

        return incoming.PlaybackPositionTicks > existing.PlaybackPositionTicks
            ? incoming
            : existing;
    }

    private static bool HasStartedWatching(UserData userData)
    {
        return userData.Played
            || userData.PlayCount > 0
            || userData.PlaybackPositionTicks > 0
            || userData.LastPlayedDate.HasValue;
    }

    private sealed record EpisodeMetadata(int IndexNumber, long RunTimeTicks);

    private sealed record MemberWatchProgress(
        Guid UserId,
        bool Played,
        long PlaybackPositionTicks,
        int? EpisodeIndexNumber,
        long EpisodeRunTimeTicks);

    private sealed class OverlayItemContext
    {
        public bool IsSeason { get; init; }

        public long RunTimeTicks { get; init; }

        public IReadOnlyList<Guid> ProgressItemIds { get; init; } = Array.Empty<Guid>();

        public Dictionary<Guid, EpisodeMetadata> EpisodeMetadataById { get; init; } = new();
    }

    private sealed class ItemProgressSnapshot
    {
        public WatchProgressDto CurrentUser { get; set; } = new();

        public Dictionary<Guid, MemberWatchProgress> Watchers { get; } = new();
    }
}

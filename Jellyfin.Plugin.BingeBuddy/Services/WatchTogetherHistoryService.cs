using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Jellyfin.Database.Implementations;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using Jellyfin.Plugin.BingeBuddy.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Microsoft.EntityFrameworkCore;

namespace Jellyfin.Plugin.BingeBuddy.Services;

/// <summary>
/// Persists watch-together session history in plugin configuration.
/// </summary>
public class WatchTogetherHistoryService : IWatchTogetherHistoryService
{
    private readonly IGroupMembershipService _groupMembershipService;
    private readonly IDbContextFactory<JellyfinDbContext> _dbContextFactory;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="WatchTogetherHistoryService"/> class.
    /// </summary>
    /// <param name="groupMembershipService">The group membership service.</param>
    /// <param name="dbContextFactory">The Jellyfin database context factory.</param>
    /// <param name="userManager">The Jellyfin user manager.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <param name="userDataManager">The Jellyfin user data manager.</param>
    public WatchTogetherHistoryService(
        IGroupMembershipService groupMembershipService,
        IDbContextFactory<JellyfinDbContext> dbContextFactory,
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager)
    {
        _groupMembershipService = groupMembershipService;
        _dbContextFactory = dbContextFactory;
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
    }

    /// <inheritdoc />
    public void RecordProgress(Guid hostUserId, RecordWatchTogetherProgressRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.BuddyUserIds.Count == 0)
        {
            return;
        }

        if (!TryResolveMediaContext(request, out var mediaContext))
        {
            return;
        }

        var allowedBuddyIds = FilterAllowedBuddyIds(hostUserId, request.BuddyUserIds);
        if (allowedBuddyIds.Count == 0)
        {
            return;
        }

        var snapshot = BuildSnapshot(hostUserId, mediaContext.ItemId, request.UserData);
        if (!WatchTogetherProgressRules.QualifiesForApproval(snapshot))
        {
            return;
        }

        WatchTogetherProgressRules.RunLocked(() =>
        {
            var plugin = Plugin.Instance;
            if (plugin is null)
            {
                return;
            }

            var configuration = plugin.Configuration;
            configuration.WatchTogether ??= new WatchTogetherConfiguration();

            foreach (var buddyUserId in allowedBuddyIds)
            {
                ApplyProgress(configuration.WatchTogether, buddyUserId, hostUserId, mediaContext, snapshot);
            }

            plugin.SaveConfiguration();
        });
    }

    /// <inheritdoc />
    public void AcknowledgeHostQueue(Guid buddyUserId, AcknowledgeWatchTogetherQueueRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.HostId == Guid.Empty)
        {
            return;
        }

        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(buddyUserId).ToHashSet();
        if (!visibleMemberIds.Contains(request.HostId))
        {
            return;
        }

        var user = _userManager.GetUserById(buddyUserId);
        if (user is null)
        {
            return;
        }

        var selectedMediaIds = (request.SelectedMediaIds ?? new List<Guid>())
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        WatchTogetherProgressRules.RunLocked(() =>
        {
            var plugin = Plugin.Instance;
            if (plugin is null)
            {
                return;
            }

            var configuration = plugin.Configuration;
            configuration.WatchTogether ??= new WatchTogetherConfiguration();

            var userProgress = configuration.WatchTogether.Users
                .FirstOrDefault(entry => entry.UserId == buddyUserId);
            if (userProgress is null)
            {
                return;
            }

            var hostEntry = FindMutableHostEntry(userProgress, request.HostId);
            if (hostEntry is null)
            {
                return;
            }

            ApplySelectedSnapshots(user, buddyUserId, hostEntry, selectedMediaIds);
            RemoveHostEntry(userProgress, request.HostId);
            plugin.SaveConfiguration();
        });
    }

    private void ApplySelectedSnapshots(
        Jellyfin.Database.Implementations.Entities.User user,
        Guid buddyUserId,
        WatchTogetherHost hostEntry,
        HashSet<Guid> selectedMediaIds)
    {
        foreach (var movie in hostEntry.Movies)
        {
            if (!selectedMediaIds.Contains(movie.Id))
            {
                continue;
            }

            TryApplySnapshot(user, buddyUserId, movie.Id, movie.UserData);
        }

        foreach (var show in hostEntry.Shows)
        {
            foreach (var season in show.Seasons)
            {
                foreach (var episode in season.Episodes)
                {
                    if (!selectedMediaIds.Contains(episode.Id))
                    {
                        continue;
                    }

                    TryApplySnapshot(user, buddyUserId, episode.Id, episode.UserData);
                }
            }
        }
    }

    private void TryApplySnapshot(
        Jellyfin.Database.Implementations.Entities.User user,
        Guid buddyUserId,
        Guid itemId,
        UserItemDataSnapshot snapshot)
    {
        if (!WatchTogetherProgressRules.TryGetAccessibleMedia(itemId, buddyUserId, _libraryManager, out var item))
        {
            return;
        }

        var userData = _userDataManager.GetUserData(user, item) ?? new UserItemData
        {
            Key = item.GetUserDataKeys()[0]
        };

        if (!ShouldApplySnapshot(userData, snapshot))
        {
            return;
        }

        MergeSnapshotIntoUserItemData(userData, snapshot);

        var saveReason = snapshot.Played
            ? UserDataSaveReason.PlaybackFinished
            : UserDataSaveReason.PlaybackProgress;

        _userDataManager.SaveUserData(user, item, userData, saveReason, CancellationToken.None);
    }

    private static bool ShouldApplySnapshot(
        MediaBrowser.Controller.Entities.UserItemData userData,
        UserItemDataSnapshot snapshot)
    {
        if (snapshot.Played && !userData.Played)
        {
            return true;
        }

        return snapshot.PlaybackPositionTicks > userData.PlaybackPositionTicks;
    }

    private static void MergeSnapshotIntoUserItemData(
        MediaBrowser.Controller.Entities.UserItemData userData,
        UserItemDataSnapshot snapshot)
    {
        userData.PlaybackPositionTicks = Math.Max(userData.PlaybackPositionTicks, snapshot.PlaybackPositionTicks);
        userData.PlayCount = Math.Max(userData.PlayCount, Math.Max(snapshot.PlayCount, 1));
        userData.Played = userData.Played || snapshot.Played;
        userData.LastPlayedDate = snapshot.LastPlayedDate
            ?? snapshot.WatchedAt
            ?? userData.LastPlayedDate
            ?? DateTime.UtcNow;

        if (snapshot.AudioStreamIndex.HasValue)
        {
            userData.AudioStreamIndex = snapshot.AudioStreamIndex;
        }

        if (snapshot.SubtitleStreamIndex.HasValue)
        {
            userData.SubtitleStreamIndex = snapshot.SubtitleStreamIndex;
        }
    }

    private static WatchTogetherHost? FindMutableHostEntry(UserWatchProgress userProgress, Guid hostId)
    {
        userProgress.Hosts ??= new List<WatchTogetherHost>();

        var host = userProgress.Hosts.FirstOrDefault(entry => entry.HostId == hostId);
        if (host is not null)
        {
            return host;
        }

        if (userProgress.Host?.HostId == hostId)
        {
            return userProgress.Host;
        }

        return null;
    }

    private static void RemoveHostEntry(UserWatchProgress userProgress, Guid hostId)
    {
        userProgress.Hosts ??= new List<WatchTogetherHost>();
        userProgress.Hosts.RemoveAll(entry => entry.HostId == hostId);

        if (userProgress.Host?.HostId == hostId)
        {
            userProgress.Host = null;
        }
    }

    private List<Guid> FilterAllowedBuddyIds(Guid hostUserId, IEnumerable<Guid> buddyUserIds)
    {
        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(hostUserId)
            .ToHashSet();

        return buddyUserIds
            .Where(id => id != hostUserId && id != Guid.Empty && visibleMemberIds.Contains(id))
            .Distinct()
            .ToList();
    }

    private UserItemDataSnapshot BuildSnapshot(Guid hostUserId, Guid itemId, UserItemDataSnapshotDto? clientData)
    {
        var snapshot = TryLoadSnapshotFromDatabase(hostUserId, itemId)
            ?? MapClientSnapshot(clientData)
            ?? new UserItemDataSnapshot();

        var clientSnapshot = MapClientSnapshot(clientData);
        if (clientSnapshot is not null && clientSnapshot.PlaybackPositionTicks > snapshot.PlaybackPositionTicks)
        {
            snapshot.PlaybackPositionTicks = clientSnapshot.PlaybackPositionTicks;
            snapshot.PlayCount = Math.Max(snapshot.PlayCount, clientSnapshot.PlayCount);
            snapshot.Played = clientSnapshot.Played;
            snapshot.AudioStreamIndex = clientSnapshot.AudioStreamIndex;
            snapshot.SubtitleStreamIndex = clientSnapshot.SubtitleStreamIndex;

            if (clientSnapshot.LastPlayedDate.HasValue)
            {
                snapshot.LastPlayedDate = clientSnapshot.LastPlayedDate;
            }
        }

        var now = DateTime.UtcNow;
        snapshot.WatchedAt = now;
        snapshot.LastPlayedDate ??= now;

        return snapshot;
    }

    private UserItemDataSnapshot? TryLoadSnapshotFromDatabase(Guid hostUserId, Guid itemId)
    {
        using var context = _dbContextFactory.CreateDbContext();
        var row = context.UserData
            .AsNoTracking()
            .FirstOrDefault(userData => userData.UserId == hostUserId && userData.ItemId == itemId);

        return row is null ? null : UserItemDataSnapshot.FromUserData(row);
    }

    private static UserItemDataSnapshot? MapClientSnapshot(UserItemDataSnapshotDto? clientData)
    {
        if (clientData is null)
        {
            return null;
        }

        return new UserItemDataSnapshot
        {
            PlaybackPositionTicks = clientData.PlaybackPositionTicks,
            PlayCount = clientData.PlayCount,
            LastPlayedDate = clientData.LastPlayedDate,
            Played = clientData.Played,
            AudioStreamIndex = clientData.AudioStreamIndex,
            SubtitleStreamIndex = clientData.SubtitleStreamIndex
        };
    }

    private static void ApplyProgress(
        WatchTogetherConfiguration watchTogether,
        Guid buddyUserId,
        Guid hostUserId,
        MediaContext mediaContext,
        UserItemDataSnapshot snapshot)
    {
        var userProgress = watchTogether.Users.FirstOrDefault(entry => entry.UserId == buddyUserId);
        if (userProgress is null)
        {
            userProgress = new UserWatchProgress
            {
                UserId = buddyUserId
            };
            watchTogether.Users.Add(userProgress);
        }

        userProgress.Hosts ??= new List<WatchTogetherHost>();
        var hostEntry = userProgress.Hosts.FirstOrDefault(entry => entry.HostId == hostUserId);
        if (hostEntry is null)
        {
            hostEntry = new WatchTogetherHost
            {
                HostId = hostUserId
            };
            userProgress.Hosts.Add(hostEntry);
        }

        if (mediaContext.IsMovie)
        {
            UpsertMovie(hostEntry, mediaContext.MovieId!.Value, snapshot);
            return;
        }

        UpsertEpisode(
            hostEntry,
            mediaContext.SeriesId!.Value,
            mediaContext.SeasonId!.Value,
            mediaContext.EpisodeId!.Value,
            snapshot);
    }

    private static void UpsertMovie(WatchTogetherHost host, Guid movieId, UserItemDataSnapshot snapshot)
    {
        var movie = host.Movies.FirstOrDefault(entry => entry.Id == movieId);
        if (movie is null)
        {
            host.Movies.Add(new WatchedMovie
            {
                Id = movieId,
                UserData = CopySnapshot(snapshot)
            });
            return;
        }

        MergeSnapshot(movie.UserData, snapshot);
    }

    private static void UpsertEpisode(
        WatchTogetherHost host,
        Guid seriesId,
        Guid seasonId,
        Guid episodeId,
        UserItemDataSnapshot snapshot)
    {
        var show = host.Shows.FirstOrDefault(entry => entry.Id == seriesId);
        if (show is null)
        {
            show = new WatchedShow { Id = seriesId };
            host.Shows.Add(show);
        }

        var season = show.Seasons.FirstOrDefault(entry => entry.Id == seasonId);
        if (season is null)
        {
            season = new WatchedSeason { Id = seasonId };
            show.Seasons.Add(season);
        }

        var episode = season.Episodes.FirstOrDefault(entry => entry.Id == episodeId);
        if (episode is null)
        {
            season.Episodes.Add(new WatchedEpisode
            {
                Id = episodeId,
                UserData = CopySnapshot(snapshot)
            });
            return;
        }

        MergeSnapshot(episode.UserData, snapshot);
    }

    private static void MergeSnapshot(UserItemDataSnapshot existing, UserItemDataSnapshot incoming)
    {
        existing.WatchedAt = incoming.WatchedAt;

        if (incoming.PlaybackPositionTicks >= existing.PlaybackPositionTicks)
        {
            existing.PlaybackPositionTicks = incoming.PlaybackPositionTicks;
            existing.PlayCount = incoming.PlayCount;
            existing.LastPlayedDate = incoming.LastPlayedDate;
            existing.Played = incoming.Played;
            existing.AudioStreamIndex = incoming.AudioStreamIndex;
            existing.SubtitleStreamIndex = incoming.SubtitleStreamIndex;
        }
    }

    private static UserItemDataSnapshot CopySnapshot(UserItemDataSnapshot snapshot)
    {
        return new UserItemDataSnapshot
        {
            PlaybackPositionTicks = snapshot.PlaybackPositionTicks,
            PlayCount = snapshot.PlayCount,
            LastPlayedDate = snapshot.LastPlayedDate,
            WatchedAt = snapshot.WatchedAt,
            Played = snapshot.Played,
            AudioStreamIndex = snapshot.AudioStreamIndex,
            SubtitleStreamIndex = snapshot.SubtitleStreamIndex
        };
    }

    private static bool TryResolveMediaContext(RecordWatchTogetherProgressRequest request, out MediaContext mediaContext)
    {
        mediaContext = default;

        if (request.MovieId.HasValue && request.MovieId.Value != Guid.Empty)
        {
            mediaContext = new MediaContext
            {
                IsMovie = true,
                MovieId = request.MovieId.Value,
                ItemId = request.MovieId.Value
            };
            return true;
        }

        var episode = request.Episode;
        if (episode is null
            || episode.EpisodeId == Guid.Empty
            || episode.SeasonId == Guid.Empty
            || episode.SeriesId == Guid.Empty)
        {
            return false;
        }

        mediaContext = new MediaContext
        {
            IsMovie = false,
            EpisodeId = episode.EpisodeId,
            SeasonId = episode.SeasonId,
            SeriesId = episode.SeriesId,
            ItemId = episode.EpisodeId
        };
        return true;
    }

    private readonly struct MediaContext
    {
        public bool IsMovie { get; init; }

        public Guid ItemId { get; init; }

        public Guid? MovieId { get; init; }

        public Guid? EpisodeId { get; init; }

        public Guid? SeasonId { get; init; }

        public Guid? SeriesId { get; init; }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using Jellyfin.Plugin.BingeBuddy.Configuration;
using Microsoft.EntityFrameworkCore;

namespace Jellyfin.Plugin.BingeBuddy.Services;

/// <summary>
/// Persists watch-together session history in plugin configuration.
/// </summary>
public class WatchTogetherHistoryService : IWatchTogetherHistoryService
{
    private static readonly object ConfigurationLock = new();

    private readonly IGroupMembershipService _groupMembershipService;
    private readonly IDbContextFactory<JellyfinDbContext> _dbContextFactory;

    /// <summary>
    /// Initializes a new instance of the <see cref="WatchTogetherHistoryService"/> class.
    /// </summary>
    /// <param name="groupMembershipService">The group membership service.</param>
    /// <param name="dbContextFactory">The Jellyfin database context factory.</param>
    public WatchTogetherHistoryService(
        IGroupMembershipService groupMembershipService,
        IDbContextFactory<JellyfinDbContext> dbContextFactory)
    {
        _groupMembershipService = groupMembershipService;
        _dbContextFactory = dbContextFactory;
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

        lock (ConfigurationLock)
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

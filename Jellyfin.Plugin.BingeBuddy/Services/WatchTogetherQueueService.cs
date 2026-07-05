using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using Jellyfin.Plugin.BingeBuddy.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.BingeBuddy.Services;

/// <summary>
/// Resolves pending watch-together media queues for the web client.
/// </summary>
public class WatchTogetherQueueService : IWatchTogetherQueueService
{
    private const int MediaThumbnailWidth = 213;
    private const int MediaThumbnailHeight = 120;
    private const int SeriesLogoMaxWidth = 320;
    private const int SeriesLogoMaxHeight = 80;
    private const int SeriesBackdropMaxWidth = 1280;

    private readonly IUserProfileService _userProfileService;
    private readonly ILibraryManager _libraryManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="WatchTogetherQueueService"/> class.
    /// </summary>
    /// <param name="userProfileService">The user profile service.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    public WatchTogetherQueueService(
        IUserProfileService userProfileService,
        ILibraryManager libraryManager)
    {
        _userProfileService = userProfileService;
        _libraryManager = libraryManager;
    }

    /// <inheritdoc />
    public WatchTogetherQueueResponse GetQueueForUser(Guid userId)
    {
        return WatchTogetherProgressRules.RunLocked(() =>
        {
            var response = new WatchTogetherQueueResponse();
            var plugin = Plugin.Instance;
            var userProgress = plugin?.Configuration.WatchTogether?.Users
                .FirstOrDefault(entry => entry.UserId == userId);

            if (userProgress is null)
            {
                return response;
            }

            if (WatchTogetherProgressRules.PruneUserProgress(userProgress, userId, _libraryManager))
            {
                plugin!.SaveConfiguration();
            }

            foreach (var host in userProgress.GetAllHosts())
            {
                if (host.HostId == Guid.Empty)
                {
                    continue;
                }

                var mediaItems = BuildMediaItems(host, userId);
                if (mediaItems.Count == 0)
                {
                    continue;
                }

                var hostProfile = _userProfileService.MapUser(host.HostId);
                response.Hosts.Add(new WatchTogetherHostQueueDto
                {
                    HostId = host.HostId,
                    HostName = hostProfile?.Name ?? "Unknown user",
                    Media = mediaItems
                });
            }

            return response;
        });
    }

    private List<WatchTogetherMediaQueueItemDto> BuildMediaItems(WatchTogetherHost host, Guid userId)
    {
        var mediaItems = new List<WatchTogetherMediaQueueItemDto>();

        foreach (var movie in host.Movies)
        {
            if (movie.Id == Guid.Empty)
            {
                continue;
            }

            if (!WatchTogetherProgressRules.QualifiesForApproval(movie.UserData))
            {
                continue;
            }

            var item = MapMediaItem(movie.Id, movie.UserData, "Movie", userId);
            if (item is not null)
            {
                mediaItems.Add(item);
            }
        }

        foreach (var show in host.Shows)
        {
            foreach (var season in show.Seasons)
            {
                foreach (var episode in season.Episodes)
                {
                    if (episode.Id == Guid.Empty)
                    {
                        continue;
                    }

                    if (!WatchTogetherProgressRules.QualifiesForApproval(episode.UserData))
                    {
                        continue;
                    }

                    var item = MapMediaItem(episode.Id, episode.UserData, "Episode", userId);
                    if (item is not null)
                    {
                        mediaItems.Add(item);
                    }
                }
            }
        }

        return mediaItems
            .OrderBy(item => item.WatchedAt ?? DateTime.MaxValue)
            .ThenBy(item => item.SeasonIndexNumber ?? int.MaxValue)
            .ThenBy(item => item.EpisodeIndexNumber ?? int.MaxValue)
            .ThenBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private WatchTogetherMediaQueueItemDto? MapMediaItem(
        Guid itemId,
        UserItemDataSnapshot? userData,
        string mediaType,
        Guid userId)
    {
        var watchedAt = userData?.WatchedAt;
        var played = userData?.Played ?? false;
        var playbackPositionTicks = userData?.PlaybackPositionTicks ?? 0;

        if (!WatchTogetherProgressRules.TryGetAccessibleMedia(itemId, userId, _libraryManager, out var item))
        {
            return null;
        }

        var runTimeTicks = item.RunTimeTicks ?? 0;
        var imageInfo = item.GetImageInfo(ImageType.Primary, 0);
        var hasPrimaryImage = imageInfo is not null;
        string? imageUrl = null;

        if (hasPrimaryImage)
        {
            imageUrl = BuildImageUrl(itemId);
        }

        var dto = new WatchTogetherMediaQueueItemDto
        {
            Id = itemId,
            Name = BuildDisplayName(item),
            SecondaryText = FormatFriendlyDateTime(watchedAt),
            HasPrimaryImage = hasPrimaryImage,
            ImageUrl = imageUrl,
            MediaType = mediaType,
            WatchedAt = watchedAt,
            Played = played,
            PlaybackPositionTicks = playbackPositionTicks,
            RunTimeTicks = runTimeTicks
        };

        if (item is Episode episode)
        {
            ApplySeriesMetadata(dto, episode);
        }

        return dto;
    }

    private void ApplySeriesMetadata(WatchTogetherMediaQueueItemDto dto, Episode episode)
    {
        dto.SeasonIndexNumber = episode.ParentIndexNumber;
        dto.EpisodeIndexNumber = episode.IndexNumber;
        dto.SeriesId = episode.SeriesId == Guid.Empty ? null : episode.SeriesId;
        dto.Name = BuildEpisodeDisplayName(episode);

        var series = episode.Series;
        if (series is null && dto.SeriesId.HasValue)
        {
            series = _libraryManager.GetItemById(dto.SeriesId.Value) as Series;
        }

        if (series is null)
        {
            return;
        }

        dto.SeriesName = series.Name;
        var logoImageInfo = series.GetImageInfo(ImageType.Logo, 0);
        dto.SeriesHasLogo = logoImageInfo is not null;

        if (dto.SeriesHasLogo)
        {
            dto.SeriesLogoUrl = BuildLogoImageUrl(series.Id);
        }

        var backdropImageInfo = series.GetImageInfo(ImageType.Backdrop, 0);
        dto.SeriesHasBackdrop = backdropImageInfo is not null;

        if (dto.SeriesHasBackdrop)
        {
            dto.SeriesBackdropUrl = BuildBackdropImageUrl(series.Id);
        }
    }

    private static string BuildBackdropImageUrl(Guid itemId)
    {
        return string.Format(
            CultureInfo.InvariantCulture,
            "/Items/{0}/Images/Backdrop/0?maxWidth={1}&quality=80",
            itemId,
            SeriesBackdropMaxWidth);
    }

    private static string BuildLogoImageUrl(Guid itemId)
    {
        return string.Format(
            CultureInfo.InvariantCulture,
            "/Items/{0}/Images/Logo?maxHeight={1}&maxWidth={2}&quality=90",
            itemId,
            SeriesLogoMaxHeight,
            SeriesLogoMaxWidth);
    }

    private static string BuildImageUrl(Guid itemId)
    {
        return string.Format(
            CultureInfo.InvariantCulture,
            "/Items/{0}/Images/Primary?maxHeight={1}&maxWidth={2}",
            itemId,
            MediaThumbnailHeight,
            MediaThumbnailWidth);
    }

    private static string BuildDisplayName(BaseItem item)
    {
        if (item is Episode episode)
        {
            return BuildEpisodeDisplayName(episode);
        }

        return item.Name ?? "Unknown media";
    }

    private static string BuildEpisodeDisplayName(Episode episode)
    {
        if (episode.ParentIndexNumber.HasValue && episode.IndexNumber.HasValue)
        {
            var episodeLabel = string.Format(
                CultureInfo.InvariantCulture,
                "S{0:D2}E{1:D2}",
                episode.ParentIndexNumber.Value,
                episode.IndexNumber.Value);

            if (!string.IsNullOrWhiteSpace(episode.Name))
            {
                episodeLabel += " - " + episode.Name;
            }

            return episodeLabel;
        }

        return episode.Name ?? "Unknown episode";
    }

    private static string FormatFriendlyDateTime(DateTime? value)
    {
        if (!value.HasValue)
        {
            return string.Empty;
        }

        var localValue = value.Value;
        if (localValue.Kind == DateTimeKind.Utc)
        {
            localValue = localValue.ToLocalTime();
        }

        return localValue.ToString("f", CultureInfo.CurrentCulture);
    }
}

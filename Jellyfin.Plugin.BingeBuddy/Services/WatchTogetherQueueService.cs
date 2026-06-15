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
        var response = new WatchTogetherQueueResponse();
        var configuration = Plugin.Instance?.Configuration;
        var userProgress = configuration?.WatchTogether?.Users
            .FirstOrDefault(entry => entry.UserId == userId);

        if (userProgress is null)
        {
            return response;
        }

        foreach (var host in userProgress.GetAllHosts())
        {
            if (host.HostId == Guid.Empty)
            {
                continue;
            }

            var mediaItems = BuildMediaItems(host);
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
    }

    private List<WatchTogetherMediaQueueItemDto> BuildMediaItems(WatchTogetherHost host)
    {
        var mediaItems = new List<WatchTogetherMediaQueueItemDto>();

        foreach (var movie in host.Movies)
        {
            if (movie.Id == Guid.Empty)
            {
                continue;
            }

            var item = MapMediaItem(movie.Id, movie.UserData, "Movie");
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

                    var item = MapMediaItem(episode.Id, episode.UserData, "Episode");
                    if (item is not null)
                    {
                        mediaItems.Add(item);
                    }
                }
            }
        }

        return mediaItems
            .OrderByDescending(item => item.WatchedAt ?? DateTime.MinValue)
            .ThenBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private WatchTogetherMediaQueueItemDto? MapMediaItem(Guid itemId, UserItemDataSnapshot? userData, string mediaType)
    {
        var watchedAt = userData?.WatchedAt;
        var played = userData?.Played ?? false;
        var playbackPositionTicks = userData?.PlaybackPositionTicks ?? 0;
        var item = _libraryManager.GetItemById(itemId);
        var runTimeTicks = item?.RunTimeTicks ?? 0;

        if (item is null)
        {
            return new WatchTogetherMediaQueueItemDto
            {
                Id = itemId,
                Name = "Unknown media",
                SecondaryText = FormatFriendlyDateTime(watchedAt),
                MediaType = mediaType,
                WatchedAt = watchedAt,
                Played = played,
                PlaybackPositionTicks = playbackPositionTicks,
                RunTimeTicks = runTimeTicks
            };
        }

        var imageInfo = item.GetImageInfo(ImageType.Primary, 0);
        var hasPrimaryImage = imageInfo is not null;
        string? imageUrl = null;

        if (hasPrimaryImage)
        {
            imageUrl = string.Format(
                CultureInfo.InvariantCulture,
                "/Items/{0}/Images/Primary?maxHeight={1}&maxWidth={2}",
                itemId,
                MediaThumbnailHeight,
                MediaThumbnailWidth);
        }

        return new WatchTogetherMediaQueueItemDto
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
    }

    private static string BuildDisplayName(BaseItem item)
    {
        if (item is Episode episode)
        {
            var seriesName = episode.SeriesName;
            if (string.IsNullOrWhiteSpace(seriesName))
            {
                seriesName = episode.Series?.Name;
            }

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

                if (!string.IsNullOrWhiteSpace(seriesName))
                {
                    return seriesName + " - " + episodeLabel;
                }

                return episodeLabel;
            }

            if (!string.IsNullOrWhiteSpace(seriesName))
            {
                return seriesName + " - " + episode.Name;
            }
        }

        return item.Name ?? "Unknown media";
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

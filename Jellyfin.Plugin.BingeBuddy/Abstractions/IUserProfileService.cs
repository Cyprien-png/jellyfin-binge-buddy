using System;
using System.Collections.Generic;
using Jellyfin.Plugin.BingeBuddy.Api;

namespace Jellyfin.Plugin.BingeBuddy.Abstractions;

/// <summary>
/// Maps Jellyfin users to profile DTOs for the plugin UI.
/// </summary>
public interface IUserProfileService
{
    /// <summary>
    /// Gets all users for the admin group settings page.
    /// </summary>
    /// <returns>A sorted list of users.</returns>
    IReadOnlyList<GroupUserDto> GetUsersForGroupSettings();

    /// <summary>
    /// Maps a Jellyfin user to a group user DTO with avatar metadata.
    /// </summary>
    /// <param name="userId">The Jellyfin user identifier.</param>
    /// <param name="avatarSize">The avatar size in pixels.</param>
    /// <returns>The mapped DTO, if the user exists.</returns>
    GroupUserDto? MapUser(Guid userId, int avatarSize = 88);

    /// <summary>
    /// Maps a Jellyfin user and watch progress to a watcher DTO.
    /// </summary>
    /// <param name="userId">The Jellyfin user identifier.</param>
    /// <param name="played">Whether the user marked the item as played.</param>
    /// <param name="playbackPositionTicks">The saved playback position in Jellyfin ticks.</param>
    /// <param name="avatarSize">The avatar size in pixels.</param>
    /// <param name="episodeIndexNumber">The highest started episode index within a season, when applicable.</param>
    /// <param name="episodeRunTimeTicks">The runtime of the referenced episode in Jellyfin ticks.</param>
    /// <param name="seasonIndexNumber">The season index for <paramref name="episodeIndexNumber"/>, when applicable.</param>
    /// <returns>The mapped DTO, if the user exists.</returns>
    GroupWatcherDto? MapWatcher(
        Guid userId,
        bool played,
        long playbackPositionTicks,
        int avatarSize = 88,
        int? episodeIndexNumber = null,
        long episodeRunTimeTicks = 0,
        int? seasonIndexNumber = null);
}

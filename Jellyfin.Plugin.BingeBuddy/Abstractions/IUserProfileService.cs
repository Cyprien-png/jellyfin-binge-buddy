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
}

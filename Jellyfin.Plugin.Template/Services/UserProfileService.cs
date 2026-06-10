using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Jellyfin.Data.Entities;
using Jellyfin.Plugin.Template.Api;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Template.Services;

/// <summary>
/// Resolves Jellyfin users and profile images for group settings.
/// </summary>
public class UserProfileService
{
    private readonly IUserManager _userManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="UserProfileService"/> class.
    /// </summary>
    /// <param name="userManager">The Jellyfin user manager.</param>
    public UserProfileService(IUserManager userManager)
    {
        _userManager = userManager;
    }

    /// <summary>
    /// Gets all users with profile image metadata for the group settings UI.
    /// </summary>
    /// <returns>A sorted list of users.</returns>
    public IReadOnlyList<GroupUserDto> GetUsersForGroupSettings()
    {
        return _userManager.Users
            .OrderBy(user => user.Username, StringComparer.OrdinalIgnoreCase)
            .Select(MapToGroupUserDto)
            .ToList();
    }

    /// <summary>
    /// Gets a user by identifier.
    /// </summary>
    /// <param name="userId">The user identifier.</param>
    /// <returns>The user, if found.</returns>
    public User? GetUser(Guid userId)
    {
        return _userManager.GetUserById(userId);
    }

    private GroupUserDto MapToGroupUserDto(User user)
    {
        try
        {
            var dto = _userManager.GetUserDto(user);
            var hasPrimaryImage = !string.IsNullOrEmpty(dto.PrimaryImageTag);

            string? imageUrl = null;
            if (hasPrimaryImage && !string.IsNullOrEmpty(dto.PrimaryImageTag))
            {
                imageUrl = string.Create(
                    CultureInfo.InvariantCulture,
                    $"/Users/{user.Id}/Images/Primary?tag={Uri.EscapeDataString(dto.PrimaryImageTag)}&maxHeight=88&maxWidth=88");
            }

            return new GroupUserDto
            {
                Id = user.Id,
                Name = user.Username,
                PrimaryImageTag = dto.PrimaryImageTag,
                HasPrimaryImage = hasPrimaryImage,
                ImageUrl = imageUrl
            };
        }
        catch
        {
            return new GroupUserDto
            {
                Id = user.Id,
                Name = user.Username,
                HasPrimaryImage = false
            };
        }
    }
}

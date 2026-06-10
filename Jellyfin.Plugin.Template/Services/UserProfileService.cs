using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Jellyfin.Plugin.Template.Abstractions;
using Jellyfin.Plugin.Template.Api;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Template.Services;

/// <summary>
/// Resolves Jellyfin users and profile images for the plugin.
/// </summary>
public class UserProfileService : IUserProfileService
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

    /// <inheritdoc />
    public IReadOnlyList<GroupUserDto> GetUsersForGroupSettings()
    {
        return _userManager.GetUsers()
            .OrderBy(user => user.Username, StringComparer.OrdinalIgnoreCase)
            .Select(user => MapUser(user.Id))
            .Where(user => user is not null)
            .Select(user => user!)
            .ToList();
    }

    /// <inheritdoc />
    public GroupUserDto? MapUser(Guid userId, int avatarSize = 88)
    {
        var user = _userManager.GetUserById(userId);
        if (user is null)
        {
            return null;
        }

        var dto = _userManager.GetUserDto(user);
        var hasPrimaryImage = !string.IsNullOrEmpty(dto.PrimaryImageTag);

        string? imageUrl = null;
        if (hasPrimaryImage && !string.IsNullOrEmpty(dto.PrimaryImageTag))
        {
            imageUrl = string.Create(
                CultureInfo.InvariantCulture,
                $"/Users/{user.Id}/Images/Primary?tag={Uri.EscapeDataString(dto.PrimaryImageTag)}&maxHeight={avatarSize}&maxWidth={avatarSize}");
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
}

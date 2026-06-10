using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.Template.Abstractions;
using Jellyfin.Plugin.Template.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Template.Services;

/// <summary>
/// Resolves group members who have started watching media items.
/// </summary>
public class ItemWatchProgressService : IItemWatchProgressService
{
    private const int OverlayAvatarSize = 64;

    private readonly IGroupMembershipService _groupMembershipService;
    private readonly IUserProfileService _userProfileService;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="ItemWatchProgressService"/> class.
    /// </summary>
    /// <param name="groupMembershipService">The group membership service.</param>
    /// <param name="userProfileService">The user profile service.</param>
    /// <param name="userManager">The Jellyfin user manager.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <param name="userDataManager">The Jellyfin user data manager.</param>
    public ItemWatchProgressService(
        IGroupMembershipService groupMembershipService,
        IUserProfileService userProfileService,
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager)
    {
        _groupMembershipService = groupMembershipService;
        _userProfileService = userProfileService;
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
    }

    /// <inheritdoc />
    public IReadOnlyDictionary<Guid, IReadOnlyList<GroupUserDto>> GetWatchersForItems(
        Guid currentUserId,
        IReadOnlyList<Guid> itemIds)
    {
        var result = new Dictionary<Guid, IReadOnlyList<GroupUserDto>>();
        if (itemIds.Count == 0)
        {
            return result;
        }

        var visibleMemberIds = _groupMembershipService.GetVisibleMemberIds(currentUserId);
        if (visibleMemberIds.Count == 0)
        {
            foreach (var itemId in itemIds.Distinct())
            {
                result[itemId] = Array.Empty<GroupUserDto>();
            }

            return result;
        }

        foreach (var itemId in itemIds.Distinct())
        {
            if (!TryGetSupportedItem(itemId, currentUserId, out var item))
            {
                result[itemId] = Array.Empty<GroupUserDto>();
                continue;
            }

            var watchers = new List<GroupUserDto>();
            foreach (var memberId in visibleMemberIds)
            {
                if (!HasStartedWatching(memberId, item))
                {
                    continue;
                }

                var watcher = _userProfileService.MapUser(memberId, OverlayAvatarSize);
                if (watcher is not null)
                {
                    watchers.Add(watcher);
                }
            }

            watchers.Sort((left, right) => string.Compare(left.Name, right.Name, StringComparison.OrdinalIgnoreCase));
            result[itemId] = watchers;
        }

        return result;
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

    private bool HasStartedWatching(Guid userId, BaseItem item)
    {
        var user = _userManager.GetUserById(userId);
        if (user is null)
        {
            return false;
        }

        var userData = _userDataManager.GetUserData(user, item);
        if (userData is null)
        {
            return false;
        }

        return userData.Played
            || userData.PlayCount > 0
            || userData.PlaybackPositionTicks > 0;
    }
}

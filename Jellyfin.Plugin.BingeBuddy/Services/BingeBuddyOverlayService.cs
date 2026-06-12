using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;

namespace Jellyfin.Plugin.BingeBuddy.Services;

/// <summary>
/// Builds overlay data for the web client.
/// </summary>
public class BingeBuddyOverlayService : IBingeBuddyOverlayService
{
    private const int MaxItemsPerRequest = 50;

    private readonly IItemWatchProgressService _itemWatchProgressService;

    /// <summary>
    /// Initializes a new instance of the <see cref="BingeBuddyOverlayService"/> class.
    /// </summary>
    /// <param name="itemWatchProgressService">The item watch progress service.</param>
    public BingeBuddyOverlayService(IItemWatchProgressService itemWatchProgressService)
    {
        _itemWatchProgressService = itemWatchProgressService;
    }

    /// <inheritdoc />
    public IReadOnlyDictionary<Guid, IReadOnlyList<GroupUserDto>> GetOverlaysForUser(Guid userId, IReadOnlyList<Guid> itemIds)
    {
        if (itemIds.Count == 0 || userId == Guid.Empty)
        {
            return new Dictionary<Guid, IReadOnlyList<GroupUserDto>>();
        }

        var limitedItemIds = itemIds.Count <= MaxItemsPerRequest
            ? itemIds
            : itemIds.Take(MaxItemsPerRequest).ToList();

        return _itemWatchProgressService.GetWatchersForItems(userId, limitedItemIds);
    }
}

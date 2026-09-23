using System;
using System.Collections.Generic;
using System.Linq;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Shared rules for watch-together stored progress and approval queues.
/// </summary>
internal static class WatchTogetherProgressRules
{
    /// <summary>
    /// Minimum watched duration required before a media item appears in the approval queue.
    /// </summary>
    internal const long MinimumApprovalWatchTicks = TimeSpan.TicksPerSecond * 10;

    private static readonly object SyncRoot = new();

    /// <summary>
    /// Executes an action while holding the watch-together configuration lock.
    /// </summary>
    /// <param name="action">The action to execute.</param>
    internal static void RunLocked(Action action)
    {
        ArgumentNullException.ThrowIfNull(action);

        lock (SyncRoot)
        {
            action();
        }
    }

    /// <summary>
    /// Executes a function while holding the watch-together configuration lock.
    /// </summary>
    /// <typeparam name="T">The result type.</typeparam>
    /// <param name="action">The function to execute.</param>
    /// <returns>The function result.</returns>
    internal static T RunLocked<T>(Func<T> action)
    {
        ArgumentNullException.ThrowIfNull(action);

        lock (SyncRoot)
        {
            return action();
        }
    }

    /// <summary>
    /// Determines whether stored progress is meaningful enough to keep or show for approval.
    /// </summary>
    /// <param name="userData">The stored playback snapshot.</param>
    /// <returns><c>true</c> when the item should be retained.</returns>
    internal static bool QualifiesForApproval(UserItemDataSnapshot? userData)
    {
        if (userData is null)
        {
            return false;
        }

        return userData.Played || userData.PlaybackPositionTicks >= MinimumApprovalWatchTicks;
    }

    /// <summary>
    /// Removes stale watch-together entries from a user's stored progress.
    /// </summary>
    /// <param name="userProgress">The user progress entry to prune.</param>
    /// <param name="userId">The Jellyfin user identifier.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <returns><c>true</c> when any stored entry was removed.</returns>
    internal static bool PruneUserProgress(
        UserWatchProgress userProgress,
        Guid userId,
        ILibraryManager libraryManager)
    {
        ArgumentNullException.ThrowIfNull(userProgress);
        ArgumentNullException.ThrowIfNull(libraryManager);

        var changed = false;
        userProgress.Hosts ??= new List<WatchTogetherHost>();

        foreach (var host in userProgress.Hosts.ToList())
        {
            if (host.HostId == Guid.Empty)
            {
                userProgress.Hosts.Remove(host);
                changed = true;
                continue;
            }

            changed |= PruneHost(host, userId, libraryManager);

            if (host.Movies.Count == 0 && host.Shows.Count == 0)
            {
                userProgress.Hosts.Remove(host);
                changed = true;
            }
        }

        if (userProgress.Host is not null)
        {
            if (userProgress.Host.HostId == Guid.Empty)
            {
                userProgress.Host = null;
                changed = true;
            }
            else
            {
                changed |= PruneHost(userProgress.Host, userId, libraryManager);

                if (userProgress.Host.Movies.Count == 0 && userProgress.Host.Shows.Count == 0)
                {
                    userProgress.Host = null;
                    changed = true;
                }
            }
        }

        return changed;
    }

    /// <summary>
    /// Determines whether a media item is accessible to the user.
    /// </summary>
    /// <param name="itemId">The media item identifier.</param>
    /// <param name="userId">The Jellyfin user identifier.</param>
    /// <param name="libraryManager">The Jellyfin library manager.</param>
    /// <param name="item">The resolved media item when accessible.</param>
    /// <returns><c>true</c> when the item can be resolved for the user.</returns>
    internal static bool TryGetAccessibleMedia(
        Guid itemId,
        Guid userId,
        ILibraryManager libraryManager,
        out BaseItem item)
    {
        item = null!;

        if (itemId == Guid.Empty)
        {
            return false;
        }

        try
        {
            var resolvedItem = libraryManager.GetItemById<BaseItem>(itemId, userId);
            if (resolvedItem is Movie or Episode)
            {
                item = resolvedItem;
                return true;
            }
        }
        catch (Exception)
        {
            return false;
        }

        return false;
    }

    private static bool ShouldRemoveStoredEntry(
        Guid itemId,
        UserItemDataSnapshot userData,
        Guid userId,
        ILibraryManager libraryManager)
    {
        if (!QualifiesForApproval(userData))
        {
            return true;
        }

        return !TryGetAccessibleMedia(itemId, userId, libraryManager, out _);
    }

    private static bool PruneHost(WatchTogetherHost host, Guid userId, ILibraryManager libraryManager)
    {
        var changed = false;

        changed |= host.Movies.RemoveAll(movie =>
            ShouldRemoveStoredEntry(movie.Id, movie.UserData, userId, libraryManager)) > 0;

        foreach (var show in host.Shows.ToList())
        {
            foreach (var season in show.Seasons.ToList())
            {
                changed |= season.Episodes.RemoveAll(episode =>
                    ShouldRemoveStoredEntry(episode.Id, episode.UserData, userId, libraryManager)) > 0;

                if (season.Episodes.Count == 0)
                {
                    show.Seasons.Remove(season);
                    changed = true;
                }
            }

            if (show.Seasons.Count == 0)
            {
                host.Shows.Remove(show);
                changed = true;
            }
        }

        return changed;
    }
}

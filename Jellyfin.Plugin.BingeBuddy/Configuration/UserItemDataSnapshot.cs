using System;
using Jellyfin.Database.Implementations.Entities;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Playback progress stored in the same shape as Jellyfin <see cref="UserData"/>.
/// </summary>
public class UserItemDataSnapshot
{
    /// <summary>
    /// Gets or sets the playback position ticks.
    /// </summary>
    public long PlaybackPositionTicks { get; set; }

    /// <summary>
    /// Gets or sets the play count.
    /// </summary>
    public int PlayCount { get; set; }

    /// <summary>
    /// Gets or sets the last played date.
    /// </summary>
    public DateTime? LastPlayedDate { get; set; }

    /// <summary>
    /// Gets or sets when this watch-together progress was recorded.
    /// </summary>
    public DateTime? WatchedAt { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the item is played.
    /// </summary>
    public bool Played { get; set; }

    /// <summary>
    /// Gets or sets the index of the audio stream.
    /// </summary>
    public int? AudioStreamIndex { get; set; }

    /// <summary>
    /// Gets or sets the index of the subtitle stream.
    /// </summary>
    public int? SubtitleStreamIndex { get; set; }

    /// <summary>
    /// Creates a snapshot from Jellyfin user item data.
    /// </summary>
    /// <param name="userData">The Jellyfin user data row.</param>
    /// <returns>A configuration snapshot.</returns>
    public static UserItemDataSnapshot FromUserData(UserData userData)
    {
        ArgumentNullException.ThrowIfNull(userData);

        return new UserItemDataSnapshot
        {
            PlaybackPositionTicks = userData.PlaybackPositionTicks,
            PlayCount = userData.PlayCount,
            LastPlayedDate = userData.LastPlayedDate,
            WatchedAt = userData.LastPlayedDate ?? DateTime.UtcNow,
            Played = userData.Played,
            AudioStreamIndex = userData.AudioStreamIndex,
            SubtitleStreamIndex = userData.SubtitleStreamIndex
        };
    }

    /// <summary>
    /// Applies this snapshot onto an existing Jellyfin user data row.
    /// </summary>
    /// <param name="userData">The Jellyfin user data row to update.</param>
    public void ApplyTo(UserData userData)
    {
        ArgumentNullException.ThrowIfNull(userData);

        userData.PlaybackPositionTicks = PlaybackPositionTicks;
        userData.PlayCount = PlayCount;
        userData.LastPlayedDate = LastPlayedDate;
        userData.Played = Played;
        userData.AudioStreamIndex = AudioStreamIndex;
        userData.SubtitleStreamIndex = SubtitleStreamIndex;
    }
}

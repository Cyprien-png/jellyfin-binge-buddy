using System;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Playback progress sent from the web client.
/// </summary>
public class UserItemDataSnapshotDto
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
}

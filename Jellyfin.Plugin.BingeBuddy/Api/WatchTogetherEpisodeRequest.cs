using System;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Episode context for watch-together progress.
/// </summary>
public class WatchTogetherEpisodeRequest
{
    /// <summary>
    /// Gets or sets the episode item identifier.
    /// </summary>
    public Guid EpisodeId { get; set; }

    /// <summary>
    /// Gets or sets the season item identifier.
    /// </summary>
    public Guid SeasonId { get; set; }

    /// <summary>
    /// Gets or sets the series item identifier.
    /// </summary>
    public Guid SeriesId { get; set; }
}

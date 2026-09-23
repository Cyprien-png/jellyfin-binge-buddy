using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress for a TV season.
/// </summary>
public class WatchedSeason
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchedSeason"/> class.
    /// </summary>
    public WatchedSeason()
    {
        Episodes = new List<WatchedEpisode>();
    }

    /// <summary>
    /// Gets or sets the Jellyfin season item identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the episodes watched in this season.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<WatchedEpisode> Episodes { get; set; }
}

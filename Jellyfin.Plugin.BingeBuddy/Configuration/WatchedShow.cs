using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Watch-together progress for a TV series.
/// </summary>
public class WatchedShow
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WatchedShow"/> class.
    /// </summary>
    public WatchedShow()
    {
        Seasons = new List<WatchedSeason>();
    }

    /// <summary>
    /// Gets or sets the Jellyfin series item identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the seasons watched for this series.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<WatchedSeason> Seasons { get; set; }
}

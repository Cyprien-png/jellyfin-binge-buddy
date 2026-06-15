using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// Plugin configuration.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        Groups = new List<BingeGroup>();
        WatchTogether = new WatchTogetherConfiguration();
    }

    /// <summary>
    /// Gets or sets the binge-watching groups managed by the plugin.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<BingeGroup> Groups { get; set; }

    /// <summary>
    /// Gets or sets watch-together progress tracked for group members.
    /// </summary>
    public WatchTogetherConfiguration WatchTogether { get; set; }
}

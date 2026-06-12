using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Jellyfin.Plugin.BingeBuddy.Configuration;

/// <summary>
/// A binge-watching group with a name and selected members.
/// </summary>
public class BingeGroup
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BingeGroup"/> class.
    /// </summary>
    public BingeGroup()
    {
        Id = Guid.NewGuid();
        Name = string.Empty;
        MemberUserIds = new List<Guid>();
    }

    /// <summary>
    /// Gets or sets the unique identifier for this group.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the display name of the group.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// Gets or sets the Jellyfin user IDs that belong to this group.
    /// </summary>
    [SuppressMessage("Design", "CA1002:Do not expose generic lists", Justification = "Required for plugin XML configuration serialization.")]
    [SuppressMessage("Usage", "CA2227:Collection properties should be read only", Justification = "Required for plugin XML configuration serialization.")]
    public List<Guid> MemberUserIds { get; set; }
}

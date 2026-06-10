using System;

namespace Jellyfin.Plugin.Template.Api;

/// <summary>
/// User entry for the group settings member picker.
/// </summary>
public class GroupUserDto
{
    /// <summary>
    /// Gets or sets the user identifier.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the primary image tag when available.
    /// </summary>
    public string? PrimaryImageTag { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the user has a profile image.
    /// </summary>
    public bool HasPrimaryImage { get; set; }

    /// <summary>
    /// Gets or sets the relative profile image URL for the web client.
    /// </summary>
    public string? ImageUrl { get; set; }
}

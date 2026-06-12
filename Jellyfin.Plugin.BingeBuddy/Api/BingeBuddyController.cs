using System.Collections.Generic;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using MediaBrowser.Common.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// API endpoints for Binge Buddy plugin settings.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.RequiresElevation)]
[Route("BingeBuddy")]
[Produces("application/json")]
public class BingeBuddyController : ControllerBase
{
    private readonly IUserProfileService _userProfileService;

    /// <summary>
    /// Initializes a new instance of the <see cref="BingeBuddyController"/> class.
    /// </summary>
    /// <param name="userProfileService">The user profile service.</param>
    public BingeBuddyController(IUserProfileService userProfileService)
    {
        _userProfileService = userProfileService;
    }

    /// <summary>
    /// Gets all users with profile image metadata for group member selection.
    /// </summary>
    /// <returns>A list of users.</returns>
    [HttpGet("Users")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<GroupUserDto>> GetUsers()
    {
        return Ok(_userProfileService.GetUsersForGroupSettings());
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Jellyfin.Plugin.BingeBuddy.Abstractions;
using Jellyfin.Plugin.BingeBuddy.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.BingeBuddy.Api;

/// <summary>
/// Client-facing API endpoints and static assets for Binge Buddy overlays.
/// </summary>
[ApiController]
[Route("BingeBuddy")]
public class BingeBuddyClientController : ControllerBase
{
    private const string JellyfinUserIdClaim = "Jellyfin-UserId";

    private readonly IBingeBuddyOverlayService _overlayService;
    private readonly ILogger<BingeBuddyClientController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="BingeBuddyClientController"/> class.
    /// </summary>
    /// <param name="overlayService">The overlay service.</param>
    /// <param name="logger">The logger.</param>
    public BingeBuddyClientController(
        IBingeBuddyOverlayService overlayService,
        ILogger<BingeBuddyClientController> logger)
    {
        _overlayService = overlayService;
        _logger = logger;
    }

    /// <summary>
    /// Gets the bootstrap script for the web client.
    /// </summary>
    /// <returns>The JavaScript bootstrap file.</returns>
    [HttpGet("script")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    public ActionResult GetBootstrapScript()
    {
        return ServeEmbeddedResource("Web.js.plugin.js");
    }

    /// <summary>
    /// Gets an embedded client asset.
    /// </summary>
    /// <param name="path">The relative asset path.</param>
    /// <returns>The requested asset.</returns>
    [HttpGet("js/{**path}")]
    [AllowAnonymous]
    public ActionResult GetClientAsset(string path)
    {
        var normalizedPath = path.Replace('/', '.');
        var resourceName = $"Web.js.{normalizedPath}";

        if (normalizedPath.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
        {
            return ServeEmbeddedResource(resourceName, "text/css");
        }

        return ServeEmbeddedResource(resourceName, "application/javascript");
    }

    /// <summary>
    /// Gets watcher overlays for the requested media items.
    /// </summary>
    /// <param name="itemIds">The media item identifiers.</param>
    /// <returns>Watchers keyed by item identifier.</returns>
    [HttpGet("Overlays")]
    [Authorize]
    [Produces("application/json")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<IReadOnlyDictionary<string, IReadOnlyList<GroupUserDto>>> GetOverlays([FromQuery] Guid[] itemIds)
    {
        var userId = GetAuthenticatedUserId();
        if (userId == Guid.Empty)
        {
            return Unauthorized();
        }

        try
        {
            var overlays = _overlayService.GetOverlaysForUser(userId, itemIds ?? Array.Empty<Guid>());
            var response = overlays.ToDictionary(
                entry => entry.Key.ToString("N"),
                entry => entry.Value);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build overlays for user {UserId}", userId);
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private Guid GetAuthenticatedUserId()
    {
        var userIdClaim = User.Claims
            .FirstOrDefault(claim => claim.Type.Equals(JellyfinUserIdClaim, StringComparison.OrdinalIgnoreCase))
            ?.Value;

        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    private ActionResult ServeEmbeddedResource(string resourceSuffix, string contentType = "application/javascript")
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith(resourceSuffix, StringComparison.Ordinal));

        if (resourceName is null)
        {
            return NotFound();
        }

        var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            return NotFound();
        }

        return File(stream, contentType);
    }
}

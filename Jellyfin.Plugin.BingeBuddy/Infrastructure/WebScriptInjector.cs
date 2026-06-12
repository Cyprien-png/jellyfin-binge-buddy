using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.BingeBuddy.Infrastructure;

/// <summary>
/// Injects the Binge Buddy client script into the Jellyfin web index page.
/// </summary>
public partial class WebScriptInjector
{
    private const string ScriptMarker = "plugin=\"BingeBuddy\"";
    private const string ScriptSrc = "/BingeBuddy/script";
    private const string ScriptTag = "<script plugin=\"BingeBuddy\" src=\"/BingeBuddy/script\" defer></script>";

    private readonly IApplicationPaths _applicationPaths;
    private readonly ILogger<WebScriptInjector> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="WebScriptInjector"/> class.
    /// </summary>
    /// <param name="applicationPaths">The Jellyfin application paths.</param>
    /// <param name="logger">The logger.</param>
    public WebScriptInjector(IApplicationPaths applicationPaths, ILogger<WebScriptInjector> logger)
    {
        _applicationPaths = applicationPaths;
        _logger = logger;
    }

    /// <summary>
    /// Ensures the client script tag is present in index.html.
    /// </summary>
    public void EnsureInjected()
    {
        try
        {
            var indexPath = Path.Combine(_applicationPaths.WebPath, "index.html");
            if (!File.Exists(indexPath))
            {
                _logger.LogWarning("Unable to inject BingeBuddy script because index.html was not found at {IndexPath}", indexPath);
                return;
            }

            var html = File.ReadAllText(indexPath);
            if (html.Contains(ScriptMarker, StringComparison.Ordinal))
            {
                var normalizedHtml = NormalizeExistingScriptTag(html);
                if (!string.Equals(normalizedHtml, html, StringComparison.Ordinal))
                {
                    File.WriteAllText(indexPath, normalizedHtml);
                    _logger.LogInformation("Updated BingeBuddy client script tag in {IndexPath}", indexPath);
                }

                return;
            }

            var updatedHtml = html.Replace("</body>", ScriptTag + Environment.NewLine + "</body>", StringComparison.Ordinal);
            File.WriteAllText(indexPath, updatedHtml);
            _logger.LogInformation("Injected BingeBuddy client script into {IndexPath}", indexPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to inject BingeBuddy client script into index.html");
        }
    }

    /// <summary>
    /// Removes the client script tag from index.html.
    /// </summary>
    public void Remove()
    {
        try
        {
            var indexPath = Path.Combine(_applicationPaths.WebPath, "index.html");
            if (!File.Exists(indexPath))
            {
                return;
            }

            var html = File.ReadAllText(indexPath);
            if (!html.Contains(ScriptMarker, StringComparison.Ordinal))
            {
                return;
            }

            var lines = html.Split('\n');
            var filtered = lines.Where(line => !line.Contains(ScriptMarker, StringComparison.Ordinal)).ToArray();
            File.WriteAllText(indexPath, string.Join('\n', filtered));
            _logger.LogInformation("Removed BingeBuddy client script from {IndexPath}", indexPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove BingeBuddy client script from index.html");
        }
    }

    private static string NormalizeExistingScriptTag(string html)
    {
        return BingeBuddyScriptTagRegex().Replace(
            html,
            match => match.Value.Contains(ScriptSrc, StringComparison.Ordinal)
                ? match.Value
                : match.Value.Replace(match.Groups["src"].Value, ScriptSrc, StringComparison.Ordinal));
    }

    [GeneratedRegex("(?<tag><script[^>]*plugin=\"BingeBuddy\"[^>]*src=\")(?<src>[^\"]+)(\"[^>]*></script>)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BingeBuddyScriptTagRegex();
}

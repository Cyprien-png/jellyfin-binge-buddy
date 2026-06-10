using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Template.Infrastructure;

/// <summary>
/// Injects the Binge Buddy client script into index.html responses at request time.
/// </summary>
public class BingeBuddyScriptInjectorMiddleware
{
    private const string ScriptMarker = "plugin=\"BingeBuddy\"";
    private const string ScriptTag = "<script plugin=\"BingeBuddy\" src=\"/BingeBuddy/script\" defer></script>";

    private readonly RequestDelegate _next;
    private readonly ILogger<BingeBuddyScriptInjectorMiddleware> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="BingeBuddyScriptInjectorMiddleware"/> class.
    /// </summary>
    /// <param name="next">The next middleware in the pipeline.</param>
    /// <param name="logger">The logger.</param>
    public BingeBuddyScriptInjectorMiddleware(RequestDelegate next, ILogger<BingeBuddyScriptInjectorMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Processes the HTTP request and injects the script into index.html responses.
    /// </summary>
    /// <param name="context">The HTTP context.</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (!IsIndexHtmlRequest(path))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        context.Features.Set<IHttpsCompressionFeature>(null);
        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("If-None-Match");
        context.Request.Headers.Remove("If-Modified-Since");

        var originalBodyStream = context.Response.Body;
        using var memoryStream = new MemoryStream();
        context.Response.Body = memoryStream;

        await _next(context).ConfigureAwait(false);

        if (context.Response.StatusCode is StatusCodes.Status304NotModified or StatusCodes.Status204NoContent)
        {
            context.Response.Body = originalBodyStream;
            return;
        }

        if (context.Response.StatusCode < 200 || context.Response.StatusCode >= 300)
        {
            memoryStream.Seek(0, SeekOrigin.Begin);
            context.Response.Body = originalBodyStream;
            await memoryStream.CopyToAsync(originalBodyStream).ConfigureAwait(false);
            return;
        }

        memoryStream.Seek(0, SeekOrigin.Begin);

        var contentType = context.Response.ContentType ?? string.Empty;
        if (!contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase))
        {
            memoryStream.Seek(0, SeekOrigin.Begin);
            context.Response.Body = originalBodyStream;
            await memoryStream.CopyToAsync(originalBodyStream).ConfigureAwait(false);
            return;
        }

        var body = await new StreamReader(memoryStream, Encoding.UTF8).ReadToEndAsync().ConfigureAwait(false);

        if (!body.Contains(ScriptMarker, StringComparison.Ordinal))
        {
            var bodyCloseIndex = body.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyCloseIndex != -1)
            {
                body = body.Insert(bodyCloseIndex, ScriptTag + Environment.NewLine);
                _logger.LogDebug("Injected BingeBuddy script into index.html response for {Path}", path);
            }
        }

        var resultBytes = Encoding.UTF8.GetBytes(body);

        context.Response.Headers.Remove("Content-Encoding");
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        context.Response.Headers["Pragma"] = "no-cache";
        context.Response.Headers["Expires"] = "-1";

        context.Response.Body = originalBodyStream;
        context.Response.ContentLength = resultBytes.Length;
        await originalBodyStream.WriteAsync(resultBytes).ConfigureAwait(false);
    }

    private static bool IsIndexHtmlRequest(string path)
    {
        return path.Equals("/", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web", StringComparison.OrdinalIgnoreCase);
    }
}

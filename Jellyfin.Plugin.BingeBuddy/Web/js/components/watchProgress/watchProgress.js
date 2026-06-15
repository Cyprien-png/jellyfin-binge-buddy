(function () {
    'use strict';

    if (window.BingeBuddyWatchProgress) {
        return;
    }

    let STYLES_ID = 'binge-buddy-watch-progress-styles';
    let TICKS_PER_SECOND = 10000000;

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function parseProgress(raw) {
        if (!raw) {
            return {
                played: false,
                playbackPositionTicks: 0,
                episodeIndexNumber: null,
                episodeRunTimeTicks: 0
            };
        }

        let episodeIndexNumber = raw.episodeIndexNumber ?? raw.EpisodeIndexNumber;

        return {
            played: !!(raw.played || raw.Played),
            playbackPositionTicks: Number(raw.playbackPositionTicks || raw.PlaybackPositionTicks || 0),
            episodeIndexNumber: episodeIndexNumber === undefined || episodeIndexNumber === null
                ? null
                : Number(episodeIndexNumber),
            episodeRunTimeTicks: Number(raw.episodeRunTimeTicks || raw.EpisodeRunTimeTicks || 0)
        };
    }

    function getProgressRuntime(progress, fallbackRunTimeTicks) {
        if (progress && progress.episodeRunTimeTicks > 0) {
            return progress.episodeRunTimeTicks;
        }

        return fallbackRunTimeTicks || 0;
    }

    function getProgressPercent(played, playbackPositionTicks, runTimeTicks) {
        if (played) {
            return 100;
        }

        if (!runTimeTicks || runTimeTicks <= 0) {
            return 0;
        }

        return Math.min(100, Math.round((playbackPositionTicks / runTimeTicks) * 100));
    }

    function formatWatchedDuration(playbackPositionTicks) {
        let totalSeconds = Math.max(0, Math.floor(playbackPositionTicks / TICKS_PER_SECOND));
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        if (hours >= 1) {
            return hours + 'h ' + minutes + 'm ' + seconds + 's';
        }

        return minutes + 'm ' + seconds + 's';
    }

    function formatCompactStatus(played, playbackPositionTicks, runTimeTicks) {
        if (played) {
            return 'Finished';
        }

        let watched = formatWatchedDuration(playbackPositionTicks);
        let percent = getProgressPercent(false, playbackPositionTicks, runTimeTicks);
        return watched + ' (' + percent + '%)';
    }

    function formatProgressStatus(played, playbackPositionTicks, runTimeTicks) {
        if (played) {
            return 'Finished';
        }

        let watched = formatWatchedDuration(playbackPositionTicks);
        let percent = getProgressPercent(false, playbackPositionTicks, runTimeTicks);
        return watched + ' watched (' + percent + '%)';
    }

    function ensureStyles() {
        if (document.getElementById(STYLES_ID)) {
            return;
        }

        let link = document.createElement('link');
        link.id = STYLES_ID;
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/watchProgress/watchProgress.css');
        document.head.appendChild(link);
    }

    function createRow(options) {
        options = options || {};

        let progress = parseProgress(options.progress);
        let runTimeTicks = getProgressRuntime(progress, options.runTimeTicks || 0);
        let variant = options.variant || 'you';
        let showStatus = options.showStatus !== false;
        let labelText = options.labelText || '';

        if (!labelText) {
            labelText = formatCompactStatus(
                progress.played,
                progress.playbackPositionTicks,
                runTimeTicks
            );
        }

        let row = document.createElement('div');
        row.className = 'bb-detail-progress-row';

        let meta = document.createElement('div');
        meta.className = 'bb-detail-progress-meta';

        let label = document.createElement('span');
        label.className = 'bb-detail-progress-label';
        label.textContent = labelText;

        meta.appendChild(label);

        if (showStatus) {
            let status = document.createElement('span');
            status.className = 'bb-detail-progress-status';
            status.textContent = options.statusText || formatProgressStatus(
                progress.played,
                progress.playbackPositionTicks,
                runTimeTicks
            );
            meta.appendChild(status);
        }

        row.appendChild(meta);

        if (options.showEpisodeLine
            && progress.episodeIndexNumber !== null
            && progress.episodeIndexNumber !== undefined) {
            let episodeLine = document.createElement('div');
            episodeLine.className = 'bb-detail-progress-episode';
            episodeLine.textContent = 'Episode ' + progress.episodeIndexNumber;
            row.appendChild(episodeLine);
        }

        let track = document.createElement('div');
        track.className = 'bb-detail-progress-track';

        let fill = document.createElement('div');
        fill.className = 'bb-detail-progress-fill bb-detail-progress-fill-' + variant;
        fill.style.width = getProgressPercent(
            progress.played,
            progress.playbackPositionTicks,
            runTimeTicks
        ) + '%';

        track.appendChild(fill);
        row.appendChild(track);

        return row;
    }

    function createSectionHeading(text) {
        let heading = document.createElement('div');
        heading.className = 'bb-detail-progress-heading';
        heading.textContent = text || 'Progress';
        return heading;
    }

    window.BingeBuddyWatchProgress = {
        TICKS_PER_SECOND: TICKS_PER_SECOND,
        parseProgress: parseProgress,
        getProgressRuntime: getProgressRuntime,
        getProgressPercent: getProgressPercent,
        formatWatchedDuration: formatWatchedDuration,
        formatCompactStatus: formatCompactStatus,
        formatProgressStatus: formatProgressStatus,
        ensureStyles: ensureStyles,
        createRow: createRow,
        createSectionHeading: createSectionHeading
    };
})();

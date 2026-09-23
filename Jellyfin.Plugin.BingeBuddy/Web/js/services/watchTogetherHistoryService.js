(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherHistoryService) {
        return;
    }

    let pendingByMediaKey = {};
    let flushTimer = null;
    let FLUSH_DELAY_MS = 300;

    function buildUserDataSnapshot(state) {
        let playState = (state && state.PlayState) || {};
        let item = state && state.NowPlayingItem;
        let positionTicks = Number(playState.PositionTicks || 0);
        let runTimeTicks = Number(item && item.RunTimeTicks || 0);
        let played = !!playState.Played;

        if (!played && runTimeTicks > 0 && positionTicks >= runTimeTicks * 0.9) {
            played = true;
        }

        return {
            playbackPositionTicks: positionTicks,
            playCount: Number(playState.PlayCount || 0),
            lastPlayedDate: new Date().toISOString(),
            played: played,
            audioStreamIndex: playState.AudioStreamIndex != null ? playState.AudioStreamIndex : null,
            subtitleStreamIndex: playState.SubtitleStreamIndex != null ? playState.SubtitleStreamIndex : null
        };
    }

    function buildMediaPayload(state) {
        let item = state && state.NowPlayingItem;
        if (!item || !item.Id) {
            return null;
        }

        let itemType = item.Type || item.type;
        if (itemType === 'Movie') {
            return {
                mediaKey: 'movie:' + item.Id,
                movieId: item.Id
            };
        }

        if (itemType === 'Episode') {
            let episodeId = item.Id;
            let seasonId = item.SeasonId || item.seasonId;
            let seriesId = item.SeriesId || item.seriesId;

            if (!episodeId || !seasonId || !seriesId) {
                return null;
            }

            return {
                mediaKey: 'episode:' + episodeId,
                episode: {
                    episodeId: episodeId,
                    seasonId: seasonId,
                    seriesId: seriesId
                }
            };
        }

        return null;
    }

    function buildRequestPayload(state, buddyUserIds) {
        let media = buildMediaPayload(state);
        if (!media || !buddyUserIds || !buddyUserIds.length) {
            return null;
        }

        let payload = {
            buddyUserIds: buddyUserIds,
            userData: buildUserDataSnapshot(state)
        };

        if (media.movieId) {
            payload.movieId = media.movieId;
        }

        if (media.episode) {
            payload.episode = media.episode;
        }

        return {
            mediaKey: media.mediaKey,
            payload: payload
        };
    }

    function flushQueue() {
        flushTimer = null;

        let entries = Object.keys(pendingByMediaKey).map(function (key) {
            return pendingByMediaKey[key];
        });

        pendingByMediaKey = {};

        if (!entries.length || typeof ApiClient === 'undefined' || !ApiClient.ajax) {
            return;
        }

        entries.forEach(function (entry) {
            ApiClient.ajax({
                type: 'POST',
                url: ApiClient.getUrl('BingeBuddy/WatchTogether/Progress'),
                data: JSON.stringify(entry.payload),
                contentType: 'application/json'
            }).catch(function (error) {
                console.warn('[BingeBuddy] Failed to record watch together progress.', error);
            });
        });
    }

    function queueProgress(state, buddyUserIds) {
        let built = buildRequestPayload(state, buddyUserIds);
        if (!built) {
            return;
        }

        pendingByMediaKey[built.mediaKey] = built;

        if (flushTimer) {
            clearTimeout(flushTimer);
        }

        flushTimer = setTimeout(flushQueue, FLUSH_DELAY_MS);
    }

    window.BingeBuddyWatchTogetherHistoryService = {
        queueProgress: queueProgress,
        flushQueue: flushQueue
    };
})();

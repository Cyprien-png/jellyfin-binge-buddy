(function () {
    'use strict';

    if (window.BingeBuddyPlaybackStopService) {
        return;
    }

    let isStarted = false;
    let stopHandlersBound = false;
    let historyModulePromise = null;

    function getContext() {
        return window.BingeBuddyWatchTogetherContext;
    }

    function isGateInProgress() {
        return !!(window.BingeBuddyPlaybackGateService
            && window.BingeBuddyPlaybackGateService.isGateInProgress
            && window.BingeBuddyPlaybackGateService.isGateInProgress());
    }

    function getMediaTypeFromState(state) {
        return state && state.NowPlayingItem && state.NowPlayingItem.MediaType;
    }

    function ensureHistoryModule() {
        if (window.BingeBuddyWatchTogetherHistoryService) {
            return Promise.resolve();
        }

        if (historyModulePromise) {
            return historyModulePromise;
        }

        historyModulePromise = new Promise(function (resolve, reject) {
            let scriptId = 'binge-buddy-watch-together-history-script';
            let existing = document.getElementById(scriptId);

            if (existing) {
                existing.addEventListener('load', function () { resolve(); }, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            let script = document.createElement('script');
            script.id = scriptId;
            script.src = (window.BingeBuddyAssets
                ? BingeBuddyAssets.getUrl('services/watchTogetherHistoryService.js')
                : ApiClient.getUrl('BingeBuddy/js/services/watchTogetherHistoryService.js'));
            script.addEventListener('load', function () { resolve(); }, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });

        return historyModulePromise;
    }

    function handleMediaStopped(state) {
        if (isGateInProgress()) {
            return;
        }

        let context = getContext();
        if (!context) {
            return;
        }

        let mediaType = getMediaTypeFromState(state);
        if (!context.isSupportedMediaType(mediaType)) {
            return;
        }

        context.resolveActiveBuddyIds()
            .then(function (activeBuddyIds) {
                if (!activeBuddyIds.length) {
                    return;
                }

                return ensureHistoryModule().then(function () {
                    if (window.BingeBuddyWatchTogetherHistoryService) {
                        BingeBuddyWatchTogetherHistoryService.queueProgress(state, activeBuddyIds);
                    }
                });
            })
            .catch(function (error) {
                console.warn('[BingeBuddy] Watch together stop handler failed.', error);
            });
    }

    function bindPlayerPause(playbackManager, player) {
        if (!player || !window.Events || player.__bbWatchTogetherPauseBound) {
            return;
        }

        player.__bbWatchTogetherPauseBound = true;

        Events.on(player, 'pause', function () {
            if (!playbackManager || typeof playbackManager.getPlayerState !== 'function') {
                return;
            }

            handleMediaStopped(playbackManager.getPlayerState(player));
        });
    }

    function bindPlaybackManager(playbackManager) {
        if (stopHandlersBound || !playbackManager || !window.Events) {
            return;
        }

        stopHandlersBound = true;

        Events.on(playbackManager, 'playbackstop', function (event, stopInfo) {
            handleMediaStopped(stopInfo && stopInfo.state);
        });

        Events.on(playbackManager, 'playbackstart', function (event, player) {
            bindPlayerPause(playbackManager, player);
        });

        let currentPlayer = playbackManager.getCurrentPlayer && playbackManager.getCurrentPlayer();
        if (currentPlayer) {
            bindPlayerPause(playbackManager, currentPlayer);
        }
    }

    function ensureContextModule() {
        if (window.BingeBuddyWatchTogetherContext) {
            return Promise.resolve();
        }

        return new Promise(function (resolve, reject) {
            let scriptId = 'binge-buddy-watch-together-context-script';
            let existing = document.getElementById(scriptId);

            if (existing) {
                existing.addEventListener('load', function () { resolve(); }, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            let script = document.createElement('script');
            script.id = scriptId;
            script.src = (window.BingeBuddyAssets
                ? BingeBuddyAssets.getUrl('services/watchTogetherContext.js')
                : ApiClient.getUrl('BingeBuddy/js/services/watchTogetherContext.js'));
            script.addEventListener('load', function () { resolve(); }, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    function onJellyfinInstanceDiscovered(kind, instance) {
        if (kind === 'playbackManager') {
            ensureContextModule()
                .then(function () {
                    bindPlaybackManager(instance);
                })
                .catch(function (error) {
                    console.warn('[BingeBuddy] Could not start playback stop service.', error);
                });
        }
    }

    function start() {
        if (isStarted) {
            return;
        }

        isStarted = true;

        ensureContextModule()
            .then(function () {
                bindPlaybackManager(window.__bbPlaybackManager);
            })
            .catch(function (error) {
                console.warn('[BingeBuddy] Could not initialize playback stop service.', error);
            });

        let attempts = 0;
        let timer = setInterval(function () {
            bindPlaybackManager(window.__bbPlaybackManager);

            if (stopHandlersBound || ++attempts >= 60) {
                clearInterval(timer);
            }
        }, 500);
    }

    window.BingeBuddyPlaybackStopService = {
        start: start,
        onJellyfinInstanceDiscovered: onJellyfinInstanceDiscovered,
        handleMediaStopped: handleMediaStopped
    };
})();

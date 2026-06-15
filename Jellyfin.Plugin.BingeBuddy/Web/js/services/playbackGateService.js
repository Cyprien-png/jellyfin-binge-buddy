(function () {
    'use strict';

    if (window.BingeBuddyPlaybackGateService) {
        return;
    }

    let PREPLAY_TYPE = 'preplayintercept';
    let PREPLAY_ID = 'binge-buddy-watch-together-gate';
    let isStarted = false;
    let interceptorRegistered = false;
    let fallbackBound = false;
    let gatePromise = null;
    let gateInProgress = false;

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function loadScriptModule(scriptId, scriptPath, isReady) {
        return new Promise(function (resolve, reject) {
            if (isReady()) {
                resolve();
                return;
            }

            let existing = document.getElementById(scriptId);
            if (existing) {
                existing.addEventListener('load', function () { resolve(); }, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            let script = document.createElement('script');
            script.id = scriptId;
            script.src = getAssetUrl(scriptPath);
            script.addEventListener('load', function () { resolve(); }, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    function ensureWatchTogetherDialogModule() {
        return loadScriptModule(
            'binge-buddy-watch-together-dialog-script',
            'components/watchTogether/watchTogetherDialog.js',
            function () { return window.BingeBuddyWatchTogetherDialog; }
        );
    }

    function ensureDependencies() {
        if (gatePromise) {
            return gatePromise;
        }

        gatePromise = Promise.all([
            ensureWatchTogetherDialogModule(),
            loadScriptModule(
                'binge-buddy-watch-together-session-script',
                'services/watchTogetherSession.js',
                function () { return window.BingeBuddyWatchTogetherSession; }
            ),
            loadScriptModule(
                'binge-buddy-user-select-script',
                'components/userSelect/userSelect.js',
                function () { return window.BingeBuddyUserSelect; }
            )
        ]).then(function () {
            BingeBuddyUserSelect.ensureStyles();
            tryRegisterPreplayInterceptor(window.__bbPluginManager);
        });

        return gatePromise;
    }

    function isSupportedMediaType(mediaType) {
        return mediaType === 'Video' || mediaType === 'Audio';
    }

    function handlePrePlayIntercept(options) {
        if (!options || !isSupportedMediaType(options.mediaType)) {
            return Promise.resolve();
        }

        if (gateInProgress) {
            return Promise.resolve();
        }

        gateInProgress = true;

        return ensureDependencies()
            .then(function () {
                return BingeBuddyUserSelect.loadBuddies();
            })
            .then(function (buddies) {
                let activeBuddyIds = BingeBuddyWatchTogetherSession.pruneToKnownBuddies(buddies);

                if (!activeBuddyIds.length) {
                    return Promise.resolve();
                }

                return BingeBuddyWatchTogetherDialog.show({
                    stillWatching: true
                }).then(function (result) {
                    if (result && result.action === 'continue') {
                        return Promise.resolve();
                    }

                    return Promise.reject(new Error('Watch together confirmation dismissed'));
                });
            })
            .catch(function (error) {
                if (error && error.message === 'Watch together confirmation dismissed') {
                    return Promise.reject(error);
                }

                console.warn('[BingeBuddy] Watch together playback gate failed open.', error);
                return Promise.resolve();
            })
            .finally(function () {
                gateInProgress = false;
            });
    }

    function createPreplayInterceptor() {
        return {
            name: 'Binge Buddy Watch Together Gate',
            id: PREPLAY_ID,
            type: PREPLAY_TYPE,
            order: 100,
            intercept: function (options) {
                return handlePrePlayIntercept(options);
            }
        };
    }

    function tryRegisterPreplayInterceptor(pluginManager) {
        if (interceptorRegistered || !pluginManager || typeof pluginManager.ofType !== 'function') {
            return interceptorRegistered;
        }

        let existing = pluginManager.ofType(PREPLAY_TYPE).some(function (plugin) {
            return plugin && plugin.id === PREPLAY_ID;
        });

        if (existing) {
            interceptorRegistered = true;
            return true;
        }

        pluginManager.pluginsList.push(createPreplayInterceptor());
        interceptorRegistered = true;
        return true;
    }

    function bindPlaybackManagerFallback(playbackManager) {
        if (fallbackBound || !playbackManager || !window.Events) {
            return;
        }

        fallbackBound = true;

        Events.on(playbackManager, 'playbackstart', function (event, player, state) {
            if (interceptorRegistered || gateInProgress) {
                return;
            }

            let mediaType = state && state.NowPlayingItem && state.NowPlayingItem.MediaType;
            if (!isSupportedMediaType(mediaType)) {
                return;
            }

            ensureDependencies()
                .then(function () {
                    return BingeBuddyUserSelect.loadBuddies();
                })
                .then(function (buddies) {
                    let activeBuddyIds = BingeBuddyWatchTogetherSession.pruneToKnownBuddies(buddies);

                    if (!activeBuddyIds.length) {
                        return null;
                    }

                    playbackManager.pause(player);

                    return BingeBuddyWatchTogetherDialog.show({
                        stillWatching: true
                    }).then(function (result) {
                        if (result && result.action === 'continue') {
                            playbackManager.unpause(player);
                            return;
                        }

                        playbackManager.stop(player);
                    });
                })
                .catch(function (error) {
                    console.warn('[BingeBuddy] Watch together playback fallback gate failed open.', error);
                });
        });
    }

    function onJellyfinInstanceDiscovered(kind, instance) {
        if (kind === 'pluginManager') {
            tryRegisterPreplayInterceptor(instance);
        }

        if (kind === 'playbackManager') {
            bindPlaybackManagerFallback(instance);
        }
    }

    function start() {
        if (isStarted) {
            return;
        }

        isStarted = true;
        ensureDependencies();
        tryRegisterPreplayInterceptor(window.__bbPluginManager);
        bindPlaybackManagerFallback(window.__bbPlaybackManager);

        let attempts = 0;
        let timer = setInterval(function () {
            tryRegisterPreplayInterceptor(window.__bbPluginManager);
            bindPlaybackManagerFallback(window.__bbPlaybackManager);

            if ((interceptorRegistered || fallbackBound) || ++attempts >= 60) {
                clearInterval(timer);
            }
        }, 500);
    }

    window.BingeBuddyPlaybackGateService = {
        start: start,
        onJellyfinInstanceDiscovered: onJellyfinInstanceDiscovered,
        handlePrePlayIntercept: handlePrePlayIntercept
    };
})();

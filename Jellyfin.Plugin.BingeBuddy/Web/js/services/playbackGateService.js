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
    let gateInProgress = false;

    function getContext() {
        return window.BingeBuddyWatchTogetherContext;
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

    function ensureDependencies() {
        return ensureContextModule().then(function () {
            return getContext().ensureGateModules();
        });
    }

    function handlePrePlayIntercept(options) {
        let context = getContext();
        if (!options || !context || !context.isSupportedMediaType(options.mediaType)) {
            return Promise.resolve();
        }

        if (gateInProgress) {
            return Promise.resolve();
        }

        gateInProgress = true;

        return ensureDependencies()
            .then(function () {
                return context.resolveActiveBuddyIds();
            })
            .then(function (activeBuddyIds) {
                if (!activeBuddyIds.length) {
                    return Promise.resolve();
                }

                return BingeBuddyWatchTogetherDialog.show({
                    stillWatching: true,
                    requireContinue: true
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
            let context = getContext();
            if (interceptorRegistered || gateInProgress || !context) {
                return;
            }

            let mediaType = state && state.NowPlayingItem && state.NowPlayingItem.MediaType;
            if (!context.isSupportedMediaType(mediaType)) {
                return;
            }

            ensureDependencies()
                .then(function () {
                    return context.resolveActiveBuddyIds();
                })
                .then(function (activeBuddyIds) {
                    if (!activeBuddyIds.length) {
                        return null;
                    }

                    playbackManager.pause(player);

                    return BingeBuddyWatchTogetherDialog.show({
                        stillWatching: true,
                        requireContinue: true
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
        handlePrePlayIntercept: handlePrePlayIntercept,
        isGateInProgress: function () {
            return gateInProgress;
        }
    };
})();

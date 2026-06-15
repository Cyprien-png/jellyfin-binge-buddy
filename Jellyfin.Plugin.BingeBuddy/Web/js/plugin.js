(function () {
    'use strict';

    let BOOTSTRAP_FLAG = '__bingeBuddyBootstrapped';

    if (window[BOOTSTRAP_FLAG]) {
        return;
    }

    function runWhenApiClientReady(callback) {
        if (typeof ApiClient !== 'undefined') {
            callback();
            return;
        }

        let attempts = 0;
        let timer = setInterval(function () {
            if (typeof ApiClient !== 'undefined') {
                clearInterval(timer);
                callback();
                return;
            }

            if (++attempts >= 240) {
                clearInterval(timer);
            }
        }, 50);
    }

    function loadJellyfinHooks(callback) {
        if (window.__bbJellyfinHooksInstalled) {
            callback();
            return;
        }

        if (document.getElementById('binge-buddy-jellyfin-hooks-script')) {
            document.getElementById('binge-buddy-jellyfin-hooks-script').addEventListener('load', callback, { once: true });
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-jellyfin-hooks-script';
        script.src = ApiClient.getUrl('BingeBuddy/js/utils/jellyfinHooks.js');
        script.addEventListener('load', callback, { once: true });
        document.head.appendChild(script);
    }

    function loadWatchTogetherQueueService() {
        if (document.getElementById('binge-buddy-watch-together-queue-script')) {
            if (window.BingeBuddyWatchTogetherQueueService) {
                BingeBuddyWatchTogetherQueueService.start();
            }
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-watch-together-queue-script';
        script.src = (window.BingeBuddyAssets
            ? BingeBuddyAssets.getUrl('services/watchTogetherQueueService.js')
            : ApiClient.getUrl('BingeBuddy/js/services/watchTogetherQueueService.js'));
        script.addEventListener('load', function () {
            if (window.BingeBuddyWatchTogetherQueueService) {
                BingeBuddyWatchTogetherQueueService.start();
            }
        }, { once: true });
        document.head.appendChild(script);
    }

    function loadPlaybackStopService() {
        if (document.getElementById('binge-buddy-playback-stop-script')) {
            if (window.BingeBuddyPlaybackStopService) {
                BingeBuddyPlaybackStopService.start();
            }
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-playback-stop-script';
        script.src = (window.BingeBuddyAssets
            ? BingeBuddyAssets.getUrl('services/playbackStopService.js')
            : ApiClient.getUrl('BingeBuddy/js/services/playbackStopService.js'));
        script.addEventListener('load', function () {
            if (window.BingeBuddyPlaybackStopService) {
                BingeBuddyPlaybackStopService.start();
            }
        }, { once: true });
        document.head.appendChild(script);
    }

    function loadPlaybackGateService() {
        if (document.getElementById('binge-buddy-playback-gate-script')) {
            if (window.BingeBuddyPlaybackGateService) {
                BingeBuddyPlaybackGateService.start();
            }
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-playback-gate-script';
        script.src = (window.BingeBuddyAssets
            ? BingeBuddyAssets.getUrl('services/playbackGateService.js')
            : ApiClient.getUrl('BingeBuddy/js/services/playbackGateService.js'));
        script.addEventListener('load', function () {
            if (window.BingeBuddyPlaybackGateService) {
                BingeBuddyPlaybackGateService.start();
            }
        }, { once: true });
        document.head.appendChild(script);
    }

    function loadAssetUtils(callback) {
        if (window.BingeBuddyAssets) {
            callback();
            return;
        }

        if (document.getElementById('binge-buddy-asset-utils-script')) {
            document.getElementById('binge-buddy-asset-utils-script').addEventListener('load', callback, { once: true });
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-asset-utils-script';
        script.src = ApiClient.getUrl('BingeBuddy/js/utils/assetUrl.js');
        script.addEventListener('load', callback, { once: true });
        document.head.appendChild(script);
    }

    function loadStylesheet() {
        if (!document.getElementById('binge-buddy-overlay-styles')) {
            let link = document.createElement('link');
            link.id = 'binge-buddy-overlay-styles';
            link.rel = 'stylesheet';
            link.href = (window.BingeBuddyAssets ? BingeBuddyAssets.getUrl('components/overlays/overlays.css') : ApiClient.getUrl('BingeBuddy/js/components/overlays/overlays.css'));
            document.head.appendChild(link);
        }

        if (!document.getElementById('binge-buddy-watch-progress-styles')) {
            let progressLink = document.createElement('link');
            progressLink.id = 'binge-buddy-watch-progress-styles';
            progressLink.rel = 'stylesheet';
            progressLink.href = (window.BingeBuddyAssets
                ? BingeBuddyAssets.getUrl('components/watchProgress/watchProgress.css')
                : ApiClient.getUrl('BingeBuddy/js/components/watchProgress/watchProgress.css'));
            document.head.appendChild(progressLink);
        }
    }

    function loadNavbarModule() {
        if (document.getElementById('binge-buddy-navbar-script')) {
            return;
        }

        var script = document.createElement('script');
        script.id = 'binge-buddy-navbar-script';
        script.src = (window.BingeBuddyAssets ? BingeBuddyAssets.getUrl('components/navbar/navbar.js') : ApiClient.getUrl('BingeBuddy/js/components/navbar/navbar.js'));
        document.head.appendChild(script);
    }

    function loadWatchProgressModule(callback) {
        function finish() {
            if (window.BingeBuddyWatchProgress) {
                BingeBuddyWatchProgress.ensureStyles();
            }

            callback();
        }

        if (window.BingeBuddyWatchProgress) {
            finish();
            return;
        }

        let existing = document.getElementById('binge-buddy-watch-progress-script');
        if (existing) {
            existing.addEventListener('load', finish, { once: true });
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-watch-progress-script';
        script.src = (window.BingeBuddyAssets
            ? BingeBuddyAssets.getUrl('components/watchProgress/watchProgress.js')
            : ApiClient.getUrl('BingeBuddy/js/components/watchProgress/watchProgress.js'));
        script.addEventListener('load', finish, { once: true });
        document.head.appendChild(script);
    }

    function loadOverlayModule() {
        if (document.getElementById('binge-buddy-overlay-script')) {
            loadWatchProgressModule(function () { });
            return;
        }

        loadWatchProgressModule(function () {
            loadStylesheet();

            let script = document.createElement('script');
            script.id = 'binge-buddy-overlay-script';
            script.src = (window.BingeBuddyAssets ? BingeBuddyAssets.getUrl('components/overlays/overlays.js') : ApiClient.getUrl('BingeBuddy/js/components/overlays/overlays.js'));
            document.head.appendChild(script);
        });
    }

    function userIsAuthenticated() {
        return ApiClient.getCurrentUserId && !!ApiClient.getCurrentUserId();
    }

    function tryStart() {
        if (!userIsAuthenticated()) {
            return false;
        }

        window[BOOTSTRAP_FLAG] = true;
        loadOverlayModule();
        loadPlaybackGateService();
        loadPlaybackStopService();
        loadWatchTogetherQueueService();
        return true;
    }

    function bindAuthWaiters() {
        function onViewShow() {
            if (tryStart()) {
                document.removeEventListener('viewshow', onViewShow);
            }
        }

        document.addEventListener('viewshow', onViewShow);

        if (typeof Events !== 'undefined') {
            Events.on(document, 'viewshow', function () {
                tryStart();
            });
        }
    }

    runWhenApiClientReady(function () {
        loadJellyfinHooks(function () {
            loadAssetUtils(function () {
                loadNavbarModule();

                if (!tryStart()) {
                    bindAuthWaiters();
                }
            });
        });
    });
})();

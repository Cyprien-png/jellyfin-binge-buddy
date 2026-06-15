(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherContext) {
        return;
    }

    let sessionDepsPromise = null;
    let gateDepsPromise = null;

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

    function ensureSessionModules() {
        if (sessionDepsPromise) {
            return sessionDepsPromise;
        }

        sessionDepsPromise = Promise.all([
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
        });

        return sessionDepsPromise;
    }

    function ensureGateModules() {
        if (gateDepsPromise) {
            return gateDepsPromise;
        }

        gateDepsPromise = ensureSessionModules().then(function () {
            return loadScriptModule(
                'binge-buddy-watch-together-dialog-script',
                'components/watchTogether/watchTogetherDialog.js',
                function () { return window.BingeBuddyWatchTogetherDialog; }
            );
        });

        return gateDepsPromise;
    }

    function resolveActiveBuddyIds() {
        return ensureSessionModules()
            .then(function () {
                return BingeBuddyUserSelect.loadBuddies();
            })
            .then(function (buddies) {
                return BingeBuddyWatchTogetherSession.pruneToKnownBuddies(buddies);
            });
    }

    function isSupportedMediaType(mediaType) {
        return mediaType === 'Video' || mediaType === 'Audio';
    }

    window.BingeBuddyWatchTogetherContext = {
        ensureSessionModules: ensureSessionModules,
        ensureGateModules: ensureGateModules,
        resolveActiveBuddyIds: resolveActiveBuddyIds,
        isSupportedMediaType: isSupportedMediaType
    };
})();

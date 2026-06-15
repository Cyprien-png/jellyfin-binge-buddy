(function () {
    'use strict';

    if (window.__bbJellyfinHooksInstalled) {
        return;
    }

    function notifyDiscovery(kind, instance) {
        if (!instance) {
            return;
        }

        if (kind === 'pluginManager') {
            window.__bbPluginManager = instance;
        }

        if (kind === 'playbackManager') {
            window.__bbPlaybackManager = instance;
        }

        if (window.BingeBuddyPlaybackGateService) {
            window.BingeBuddyPlaybackGateService.onJellyfinInstanceDiscovered(kind, instance);
        }
    }

    function looksLikePluginManager(obj) {
        return !!(obj && Array.isArray(obj.pluginsList) && typeof obj.ofType === 'function');
    }

    function looksLikePlaybackManager(obj) {
        return !!(obj && typeof obj.pause === 'function' && typeof obj.getCurrentPlayer === 'function' && obj._playQueueManager);
    }

    function installHooks() {
        if (window.__bbJellyfinHooksInstalled || !window.Events) {
            return !!window.__bbJellyfinHooksInstalled;
        }

        let originalOn = Events.on.bind(Events);
        let originalTrigger = Events.trigger.bind(Events);

        Events.on = function (obj, type, fn) {
            if (looksLikePluginManager(obj)) {
                notifyDiscovery('pluginManager', obj);
            }

            if (looksLikePlaybackManager(obj)) {
                notifyDiscovery('playbackManager', obj);
            }

            return originalOn(obj, type, fn);
        };

        Events.trigger = function (obj, type, args) {
            if (looksLikePluginManager(obj)) {
                notifyDiscovery('pluginManager', obj);
            }

            if (looksLikePlaybackManager(obj)) {
                notifyDiscovery('playbackManager', obj);
            }

            return originalTrigger(obj, type, args);
        };

        window.__bbJellyfinHooksInstalled = true;
        return true;
    }

    function waitForEvents() {
        if (installHooks()) {
            return;
        }

        let attempts = 0;
        let timer = setInterval(function () {
            if (installHooks() || ++attempts >= 240) {
                clearInterval(timer);
            }
        }, 50);
    }

    waitForEvents();
})();

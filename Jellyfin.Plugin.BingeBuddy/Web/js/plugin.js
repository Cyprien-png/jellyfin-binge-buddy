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
        if (document.getElementById('binge-buddy-overlay-styles')) {
            return;
        }

        let link = document.createElement('link');
        link.id = 'binge-buddy-overlay-styles';
        link.rel = 'stylesheet';
        link.href = (window.BingeBuddyAssets ? BingeBuddyAssets.getUrl('components/overlays/overlays.css') : ApiClient.getUrl('BingeBuddy/js/components/overlays/overlays.css'));
        document.head.appendChild(link);
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

    function loadOverlayModule() {
        if (document.getElementById('binge-buddy-overlay-script')) {
            return;
        }

        loadStylesheet();

        let script = document.createElement('script');
        script.id = 'binge-buddy-overlay-script';
        script.src = (window.BingeBuddyAssets ? BingeBuddyAssets.getUrl('components/overlays/overlays.js') : ApiClient.getUrl('BingeBuddy/js/components/overlays/overlays.js'));
        document.head.appendChild(script);
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
        loadAssetUtils(function () {
            loadNavbarModule();

            if (!tryStart()) {
                bindAuthWaiters();
            }
        });
    });
})();

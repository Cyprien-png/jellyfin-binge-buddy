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

    function loadStylesheet() {
        if (document.getElementById('binge-buddy-overlay-styles')) {
            return;
        }

        let link = document.createElement('link');
        link.id = 'binge-buddy-overlay-styles';
        link.rel = 'stylesheet';
        link.href = ApiClient.getUrl('BingeBuddy/js/overlays.css');
        document.head.appendChild(link);
    }

    function loadNavbarModule() {
        if (document.getElementById('binge-buddy-navbar-script')) {
            return;
        }

        var script = document.createElement('script');
        script.id = 'binge-buddy-navbar-script';
        script.src = ApiClient.getUrl('BingeBuddy/js/navbar.js');
        document.head.appendChild(script);
    }

    function loadOverlayModule() {
        if (document.getElementById('binge-buddy-overlay-script')) {
            return;
        }

        loadStylesheet();

        let script = document.createElement('script');
        script.id = 'binge-buddy-overlay-script';
        script.src = ApiClient.getUrl('BingeBuddy/js/overlays.js');
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
        loadNavbarModule();

        if (!tryStart()) {
            bindAuthWaiters();
        }
    });
})();

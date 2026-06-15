(function () {
    'use strict';

    if (window.BingeBuddyAssets) {
        return;
    }

    function getAssetUrl(relativePath) {
        let path = (relativePath || '').replace(/^\/+/, '');

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    window.BingeBuddyAssets = {
        getUrl: getAssetUrl
    };
})();

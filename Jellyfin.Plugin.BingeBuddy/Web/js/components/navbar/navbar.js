(function () {
    'use strict';

    if (window.__bingeBuddyNavbarBootstrapped) {
        return;
    }

    window.__bingeBuddyNavbarBootstrapped = true;

    let NAVBAR_BUTTON_CLASS = 'bb-navbar-button';
    let HEADER_RENDERED_EVENT = 'HEADER_RENDERED';
    let BUDDY_ICON_SVG = '<svg class="bb-navbar-icon" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"></path><path fill="currentColor" fill-rule="evenodd" d="M8.905 4.25h6.19c.838 0 1.372 0 1.832.091a4.75 4.75 0 0 1 3.732 3.732l-.736.147l.736-.147c.07.35.086.743.09 1.28A2.75 2.75 0 0 1 22.75 12v2.444c0 1.53-.798 2.874-2 3.637V19a.75.75 0 0 1-1.5 0v-.325q-.392.075-.806.075H5.556q-.414 0-.806-.075V19a.75.75 0 0 1-1.5 0v-.919a4.3 4.3 0 0 1-2-3.636V12c0-1.26.846-2.32 2.001-2.647c.004-.537.02-.93.09-1.28a4.75 4.75 0 0 1 3.732-3.732c.46-.091.994-.091 1.832-.091M4.752 9.354A2.75 2.75 0 0 1 6.75 12v1.2c0 .028.022.05.05.05h10.4a.05.05 0 0 0 .05-.05V12c0-1.258.845-2.319 1.998-2.646c-.004-.51-.017-.77-.06-.988a3.25 3.25 0 0 0-2.554-2.554c-.296-.058-.669-.062-1.634-.062H9c-.965 0-1.338.004-1.634.062a3.25 3.25 0 0 0-2.554 2.554c-.043.218-.056.479-.06.988M4 10.75c-.69 0-1.25.56-1.25 1.25v2.444a2.806 2.806 0 0 0 2.806 2.806h12.888a2.806 2.806 0 0 0 2.806-2.806V12a1.25 1.25 0 0 0-2.5 0v1.2a1.55 1.55 0 0 1-1.55 1.55H6.8a1.55 1.55 0 0 1-1.55-1.55V12c0-.69-.56-1.25-1.25-1.25" clip-rule="evenodd"></path></svg>';

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function loadStylesheet() {
        if (document.getElementById('binge-buddy-navbar-styles')) {
            return;
        }

        let link = document.createElement('link');
        link.id = 'binge-buddy-navbar-styles';
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/navbar/navbar.css');
        document.head.appendChild(link);
    }

    function loadWatchTogetherDialogModule(callback) {
        if (window.BingeBuddyWatchTogetherDialog) {
            callback();
            return;
        }

        let existing = document.getElementById('binge-buddy-watch-together-dialog-script');
        if (existing) {
            existing.addEventListener('load', callback, { once: true });
            return;
        }

        let script = document.createElement('script');
        script.id = 'binge-buddy-watch-together-dialog-script';
        script.src = getAssetUrl('components/watchTogether/watchTogetherDialog.js');
        script.addEventListener('load', callback, { once: true });
        document.head.appendChild(script);
    }

    function findHeaderRightInsertPoint(skinHeader) {
        let headerRight = skinHeader.querySelector('.headerRight');
        if (!headerRight) {
            return null;
        }

        return headerRight.querySelector('.headerButtonRight:not(.' + NAVBAR_BUTTON_CLASS + ')')
            || headerRight.firstElementChild;
    }

    function createNavbarButton() {
        let button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('is', 'paper-icon-button-light');
        button.className = 'headerButton headerButtonRight paper-icon-button-light ' + NAVBAR_BUTTON_CLASS;
        button.title = 'Binge Buddy: Watch together';
        button.innerHTML = BUDDY_ICON_SVG;
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            loadWatchTogetherDialogModule(function () {
                if (window.BingeBuddyWatchTogetherDialog) {
                    window.BingeBuddyWatchTogetherDialog.show();
                }
            });
        });
        return button;
    }

    function ensureNavbarButton() {
        let skinHeader = document.querySelector('.skinHeader');
        if (!skinHeader || skinHeader.querySelector('.' + NAVBAR_BUTTON_CLASS)) {
            return;
        }

        let button = createNavbarButton();
        let headerRight = skinHeader.querySelector('.headerRight');
        let insertBefore = findHeaderRightInsertPoint(skinHeader);

        if (headerRight) {
            if (insertBefore) {
                headerRight.insertBefore(button, insertBefore);
            } else {
                headerRight.appendChild(button);
            }

            return;
        }

        if (insertBefore && insertBefore.parentNode) {
            insertBefore.parentNode.insertBefore(button, insertBefore);
        }
    }

    function bindHeaderListeners() {
        document.addEventListener(HEADER_RENDERED_EVENT, ensureNavbarButton);

        if (typeof Events !== 'undefined') {
            Events.on(document, HEADER_RENDERED_EVENT, ensureNavbarButton);
        }

        document.addEventListener('viewshow', ensureNavbarButton);
    }

    loadStylesheet();
    bindHeaderListeners();
    ensureNavbarButton();
})();

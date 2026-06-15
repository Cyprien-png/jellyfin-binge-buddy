(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherPendingDialog) {
        return;
    }

    let STYLES_ID = 'binge-buddy-watch-together-pending-dialog-styles';
    let DEFAULT_DIALOG_WIDTH = 672;
    let CONTINUE_BUTTON_ID = 'continue';

    let DEFAULTS = {
        buttons: [{ id: CONTINUE_BUTTON_ID, name: 'Continue', type: 'submit' }],
        maxWidth: DEFAULT_DIALOG_WIDTH,
        emptyMediaTitle: 'No media found',
        emptyMediaMessage: ''
    };

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function ensureStyles() {
        if (document.getElementById(STYLES_ID)) {
            return;
        }

        let link = document.createElement('link');
        link.id = STYLES_ID;
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/watchTogetherPending/watchTogetherPendingDialog.css');
        document.head.appendChild(link);
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

    function ensureDialogModule() {
        return loadScriptModule(
            'binge-buddy-dialog-script',
            'components/dialog/dialog.js',
            function () { return window.BingeBuddyDialog; }
        ).then(function () {
            BingeBuddyDialog.ensureStyles();
        });
    }

    function ensureWatchProgressModule() {
        return loadScriptModule(
            'binge-buddy-watch-progress-script',
            'components/watchProgress/watchProgress.js',
            function () { return window.BingeBuddyWatchProgress; }
        ).then(function () {
            BingeBuddyWatchProgress.ensureStyles();
        });
    }

    function ensureMediaSelectModule() {
        return ensureWatchProgressModule().then(function () {
            return loadScriptModule(
                'binge-buddy-media-select-script',
                'components/mediaSelect/mediaSelect.js',
                function () { return window.BingeBuddyMediaSelect; }
            );
        }).then(function () {
            BingeBuddyMediaSelect.ensureStyles();
        });
    }

    function buildTitle(hostName) {
        return 'Binge Buddy: Media you watched with ' + hostName;
    }

    function buildDescription(hostName) {
        return 'You watched this media together with ' + hostName + ' on their device.';
    }

    function getDefaultSelectedMediaIds(mediaItems) {
        return (mediaItems || []).map(function (item) {
            return item.Id || item.id;
        }).filter(function (id) {
            return !!id;
        });
    }

    function renderMediaList(container, mediaItems, options) {
        let scroll = document.createElement('div');
        scroll.className = 'bb-watch-together-pending-scroll';

        let list = document.createElement('div');
        list.className = 'bb-media-list checkboxListContainer';

        scroll.appendChild(list);
        container.appendChild(scroll);

        BingeBuddyMediaSelect.render(list, mediaItems, {
            selectedMediaIds: options && options.selectedMediaIds,
            isSelected: options && options.isSelected,
            onChange: options && options.onChange,
            emptyTitle: (options && options.emptyTitle) || DEFAULTS.emptyMediaTitle,
            emptyMessage: (options && options.emptyMessage !== undefined)
                ? options.emptyMessage
                : DEFAULTS.emptyMediaMessage
        });

        return list;
    }

    function show(options) {
        ensureStyles();

        let merged = Object.assign({}, DEFAULTS, options || {});
        let hostName = merged.hostName || 'your buddy';
        let mediaItems = merged.media || [];
        let mediaListElementRef = { current: null };

        return Promise.all([
            ensureDialogModule(),
            ensureMediaSelectModule()
        ]).then(function () {
            let dialogOptions = {
                title: merged.title || buildTitle(hostName),
                text: merged.text || buildDescription(hostName),
                buttons: merged.buttons,
                maxWidth: merged.maxWidth,
                size: merged.size,
                renderContent: function (container) {
                    mediaListElementRef.current = renderMediaList(container, mediaItems, {
                        selectedMediaIds: merged.selectedMediaIds || getDefaultSelectedMediaIds(mediaItems),
                        emptyTitle: merged.emptyMediaTitle,
                        emptyMessage: merged.emptyMediaMessage
                    });
                }
            };

            return BingeBuddyDialog.show(dialogOptions).then(function (result) {
                let mediaListElement = mediaListElementRef.current;

                return {
                    action: result,
                    hostId: merged.hostId,
                    hostName: hostName,
                    selectedMediaIds: mediaListElement
                        ? BingeBuddyMediaSelect.getSelectedMediaIds(mediaListElement)
                        : []
                };
            });
        });
    }

    window.BingeBuddyWatchTogetherPendingDialog = {
        show: show,
        ensureStyles: ensureStyles,
        defaults: DEFAULTS
    };
})();

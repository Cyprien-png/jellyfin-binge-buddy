(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherDialog) {
        return;
    }

    let STYLES_ID = 'binge-buddy-watch-together-dialog-styles';
    let DEFAULT_DIALOG_WIDTH = 672;
    let CONTINUE_BUTTON_ID = 'continue';

    let DEFAULTS = {
        title: 'Binge Buddy: Watch together',
        text: 'Currently watching media with your buddies on this device ?<br> Select who is watching with you to sync their progress.',
        buttons: [{ id: CONTINUE_BUTTON_ID, name: 'Continue', type: 'submit' }],
        maxWidth: DEFAULT_DIALOG_WIDTH,
        emptyBuddyTitle: 'No buddies found',
        emptyBuddyMessage: ''
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
        link.href = getAssetUrl('components/watchTogether/watchTogetherDialog.css');
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

    function ensureUserSelectModule() {
        return loadScriptModule(
            'binge-buddy-user-select-script',
            'components/userSelect/userSelect.js',
            function () { return window.BingeBuddyUserSelect; }
        ).then(function () {
            BingeBuddyUserSelect.ensureStyles();
        });
    }

    function ensureWatchTogetherSessionModule() {
        return loadScriptModule(
            'binge-buddy-watch-together-session-script',
            'services/watchTogetherSession.js',
            function () { return window.BingeBuddyWatchTogetherSession; }
        );
    }

    function renderBuddyList(container, buddies, options) {
        let scroll = document.createElement('div');
        scroll.className = 'bb-watch-together-user-scroll';

        let list = document.createElement('div');
        list.className = 'bb-users-list checkboxListContainer';

        scroll.appendChild(list);
        container.appendChild(scroll);

        BingeBuddyUserSelect.render(list, buddies, {
            selectedUserIds: options && options.selectedUserIds,
            isSelected: options && options.isSelected,
            onChange: options && options.onChange,
            emptyTitle: (options && options.emptyTitle) || DEFAULTS.emptyBuddyTitle,
            emptyMessage: (options && options.emptyMessage !== undefined)
                ? options.emptyMessage
                : DEFAULTS.emptyBuddyMessage
        });

        return list;
    }

    function buildDialogOptions(buddies, merged, buddyListElementRef) {
        let storedSelection = BingeBuddyWatchTogetherSession.getSelectedUserIds();
        let initialSelection = merged.selectedUserIds || BingeBuddyWatchTogetherSession.filterToKnownBuddies(storedSelection, buddies);

        return {
            title: merged.title,
            text: merged.text,
            html: merged.html,
            buttons: merged.buttons,
            maxWidth: merged.maxWidth,
            size: merged.size,
            renderContent: function (container) {
                buddyListElementRef.current = renderBuddyList(container, buddies, {
                    selectedUserIds: initialSelection,
                    emptyTitle: merged.emptyBuddyTitle,
                    emptyMessage: merged.emptyBuddyMessage
                });
            }
        };
    }

    function show(options) {
        ensureStyles();

        let merged = Object.assign({}, DEFAULTS, options || {});
        let buddyListElementRef = { current: null };

        return Promise.all([
            ensureDialogModule(),
            ensureUserSelectModule(),
            ensureWatchTogetherSessionModule()
        ])
            .then(function () {
                return BingeBuddyUserSelect.loadBuddies();
            })
            .then(function (buddies) {
                let dialogOptions = buildDialogOptions(buddies, merged, buddyListElementRef);

                return BingeBuddyDialog.show(dialogOptions).then(function (result) {
                    let buddyListElement = buddyListElementRef.current;

                    if (result === CONTINUE_BUTTON_ID && buddyListElement) {
                        let selectedUserIds = BingeBuddyUserSelect.getSelectedUserIds(buddyListElement);
                        BingeBuddyWatchTogetherSession.setSelectedUserIds(selectedUserIds);
                    }

                    return {
                        action: result,
                        selectedUserIds: result === CONTINUE_BUTTON_ID && buddyListElement
                            ? BingeBuddyUserSelect.getSelectedUserIds(buddyListElement)
                            : BingeBuddyWatchTogetherSession.getSelectedUserIds()
                    };
                });
            });
    }

    window.BingeBuddyWatchTogetherDialog = {
        show: show,
        ensureStyles: ensureStyles,
        defaults: DEFAULTS
    };
})();

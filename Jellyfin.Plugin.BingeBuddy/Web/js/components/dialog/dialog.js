(function () {
    'use strict';

    if (window.BingeBuddyDialog) {
        return;
    }

    let FALLBACK_STYLES_ID = 'binge-buddy-dialog-styles';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function getJellyfinDialogHelper() {
        return typeof Dashboard !== 'undefined' && Dashboard.dialogHelper
            ? Dashboard.dialogHelper
            : null;
    }

    function loadDialogStyles() {
        if (document.getElementById(FALLBACK_STYLES_ID)) {
            return;
        }

        let link = document.createElement('link');
        link.id = FALLBACK_STYLES_ID;
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/dialog/dialog.css');
        document.head.appendChild(link);
    }

    function normalizeButtons(buttons) {
        if (!buttons || !buttons.length) {
            return [{ id: 'continue', name: 'Continue', type: 'submit' }];
        }

        return buttons;
    }

    function buildButtonsHtml(buttons) {
        let html = '';

        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            let autoFocus = i === 0 ? ' autofocus' : '';
            let buttonClass = 'btnOption raised formDialogFooterItem formDialogFooterItem-autosize';

            if (button.type) {
                buttonClass += ' button-' + button.type;
            }

            html += '<button is="emby-button" type="button" class="' + buttonClass + '" data-id="' + escapeAttr(button.id) + '"' + autoFocus + '><span>' + escapeHtml(button.name) + '</span></button>';
        }

        return html;
    }

    function appendCustomContent(container, options) {
        if (!container) {
            return;
        }

        if (typeof options.renderContent === 'function') {
            options.renderContent(container);
            return;
        }

        if (options.content instanceof HTMLElement) {
            container.appendChild(options.content);
        }
    }

    let DEFAULT_DIALOG_WIDTH = 672;

    function resolveDialogWidth(buttonCount, preferredWidth) {
        if (preferredWidth) {
            return Math.min(preferredWidth, window.innerWidth - 50);
        }

        let calculated = Math.min((buttonCount * 150) + 200, window.innerWidth - 50);
        return Math.max(calculated, DEFAULT_DIALOG_WIDTH);
    }

    function showJellyfinDialog(options) {
        loadDialogStyles();

        let helper = getJellyfinDialogHelper();
        let buttons = normalizeButtons(options.buttons);
        let dialogOptions = {
            removeOnClose: true,
            scrollY: false
        };

        if (options.size) {
            dialogOptions.size = options.size;
        }

        let dlg = helper.createDialog(dialogOptions);
        let title = options.title || '';
        let bodyHtml = options.html || options.text || options.message || '';
        let hasCustomContent = typeof options.renderContent === 'function' || options.content instanceof HTMLElement;

        dlg.classList.add('formDialog');
        dlg.classList.add('align-items-center');
        dlg.classList.add('justify-content-center');
        dlg.classList.add('dialog-fullscreen-lowres');
        dlg.classList.add('bb-dialog');

        dlg.innerHTML =
            '<div class="formDialogContent no-grow bb-form-dialog-content">' +
                '<div class="formDialogHeader">' +
                    '<h3 class="formDialogHeaderTitle">' + escapeHtml(title) + '</h3>' +
                '</div>' +
                '<div class="dialogContentInner scrollContainer">' +
                    '<div class="text' + (bodyHtml ? '' : ' hide') + '">' + bodyHtml + '</div>' +
                    (hasCustomContent ? '<div class="bb-dialog-custom"></div>' : '') +
                '</div>' +
                '<div class="formDialogFooter">' + buildButtonsHtml(buttons) + '</div>' +
            '</div>';

        let formDialogContent = dlg.querySelector('.formDialogContent');
        if (formDialogContent) {
            let maxWidth = options.maxWidth || resolveDialogWidth(buttons.length, options.preferredWidth);
            formDialogContent.style.maxWidth = maxWidth + 'px';
            formDialogContent.style.width = 'min(100vw - 2rem, ' + maxWidth + 'px)';
        }

        appendCustomContent(dlg.querySelector('.bb-dialog-custom'), options);

        let dialogResult;

        function onButtonClick() {
            dialogResult = this.getAttribute('data-id');
            helper.close(dlg);
        }

        let buttonElements = dlg.querySelectorAll('.btnOption');
        for (let i = 0; i < buttonElements.length; i++) {
            buttonElements[i].addEventListener('click', onButtonClick);
        }

        return helper.open(dlg).then(function () {
            return dialogResult;
        });
    }

    function showFallbackDialog(options) {
        loadDialogStyles();

        let buttons = normalizeButtons(options.buttons);
        let title = options.title || '';
        let bodyText = options.text || options.message || '';
        let hasCustomContent = typeof options.renderContent === 'function' || options.content instanceof HTMLElement;

        return new Promise(function (resolve) {
            let backdrop = document.createElement('div');
            backdrop.className = 'bb-dialog-fallback-backdrop';

            let panel = document.createElement('div');
            panel.className = 'bb-dialog-fallback';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            if (title) {
                panel.setAttribute('aria-label', title);
            }

            let header = document.createElement('div');
            header.className = 'bb-dialog-fallback-header';
            header.textContent = title;

            let body = document.createElement('div');
            body.className = 'bb-dialog-fallback-body';

            if (bodyText) {
                let description = document.createElement('p');
                description.className = 'bb-dialog-fallback-text';
                description.textContent = bodyText;
                body.appendChild(description);
            }

            if (hasCustomContent) {
                let custom = document.createElement('div');
                custom.className = 'bb-dialog-custom';
                body.appendChild(custom);
                appendCustomContent(custom, options);
            }

            let footer = document.createElement('div');
            footer.className = 'bb-dialog-fallback-footer';

            function closeDialog(result) {
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                resolve(result);
            }

            function onKeyDown(event) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeDialog();
                }
            }

            for (let i = 0; i < buttons.length; i++) {
                let button = buttons[i];
                let buttonEl = document.createElement('button');
                buttonEl.type = 'button';
                buttonEl.className = 'bb-dialog-fallback-button';
                if (button.type === 'submit') {
                    buttonEl.classList.add('bb-dialog-fallback-button-primary');
                }
                buttonEl.textContent = button.name;
                buttonEl.addEventListener('click', function () {
                    closeDialog(button.id);
                });
                footer.appendChild(buttonEl);
            }

            backdrop.addEventListener('click', function (event) {
                if (event.target === backdrop) {
                    closeDialog();
                }
            });

            panel.appendChild(header);
            panel.appendChild(body);
            panel.appendChild(footer);
            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);
            document.addEventListener('keydown', onKeyDown);

            let focusTarget = footer.querySelector('button');
            if (focusTarget) {
                focusTarget.focus();
            }
        });
    }

    function show(options) {
        if (typeof options === 'string') {
            options = { text: options };
        }

        options = options || {};

        if (getJellyfinDialogHelper()) {
            return showJellyfinDialog(options);
        }

        return showFallbackDialog(options);
    }

    function loadScriptModule(scriptId, scriptPath) {
        return new Promise(function (resolve, reject) {
            let globalReady = scriptId === 'binge-buddy-user-select-script'
                ? function () { return window.BingeBuddyUserSelect; }
                : function () { return window.BingeBuddyWatchTogetherSession; };

            if (globalReady()) {
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

    function ensureUserSelectModule() {
        return loadScriptModule('binge-buddy-user-select-script', 'components/userSelect/userSelect.js').then(function () {
            BingeBuddyUserSelect.ensureStyles();
        });
    }

    function ensureWatchTogetherSessionModule() {
        return loadScriptModule('binge-buddy-watch-together-session-script', 'services/watchTogetherSession.js');
    }

    function renderWatchTogetherBuddies(container, buddies, options) {
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
            emptyTitle: 'No buddies found',
            emptyMessage: ''
        });

        return list;
    }

    function showWatchTogether(options) {
        let defaults = {
            title: 'Binge Buddy: Watch together',
            text: 'Currently watching media with your buddies on this device ?<br> Select who is watching with you to sync their progress.',
            buttons: [{ id: 'continue', name: 'Continue', type: 'submit' }],
            maxWidth: DEFAULT_DIALOG_WIDTH
        };

        let merged = Object.assign({}, defaults, options || {});
        let buddyListElement = null;

        return Promise.all([
            ensureUserSelectModule(),
            ensureWatchTogetherSessionModule()
        ])
            .then(function () {
                return BingeBuddyUserSelect.loadBuddies();
            })
            .then(function (buddies) {
                let storedSelection = BingeBuddyWatchTogetherSession.getSelectedUserIds();
                let initialSelection = merged.selectedUserIds || BingeBuddyWatchTogetherSession.filterToKnownBuddies(storedSelection, buddies);

                merged.renderContent = function (container) {
                    buddyListElement = renderWatchTogetherBuddies(container, buddies, {
                        selectedUserIds: initialSelection
                    });
                };

                return show(merged).then(function (result) {
                    if (result === 'continue' && buddyListElement) {
                        let selectedUserIds = BingeBuddyUserSelect.getSelectedUserIds(buddyListElement);
                        BingeBuddyWatchTogetherSession.setSelectedUserIds(selectedUserIds);
                    }

                    return {
                        action: result,
                        selectedUserIds: result === 'continue' && buddyListElement
                            ? BingeBuddyUserSelect.getSelectedUserIds(buddyListElement)
                            : BingeBuddyWatchTogetherSession.getSelectedUserIds()
                    };
                });
            });
    }

    window.BingeBuddyDialog = {
        show: show,
        showWatchTogether: showWatchTogether
    };
})();

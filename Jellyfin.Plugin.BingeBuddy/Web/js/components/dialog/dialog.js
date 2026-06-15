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

    function ensureStyles() {
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
        return buttons && buttons.length ? buttons : [];
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

    function resolveDialogWidth(buttonCount, options) {
        if (options.maxWidth) {
            return Math.min(options.maxWidth, window.innerWidth - 50);
        }

        if (options.preferredWidth) {
            return Math.min(options.preferredWidth, window.innerWidth - 50);
        }

        let calculated = Math.min((buttonCount * 150) + 200, window.innerWidth - 50);
        return Math.max(calculated, 320);
    }

    function showJellyfinDialog(options) {
        ensureStyles();

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
                    (title ? '<h3 class="formDialogHeaderTitle">' + escapeHtml(title) + '</h3>' : '<h3 class="formDialogHeaderTitle hide"></h3>') +
                '</div>' +
                '<div class="dialogContentInner scrollContainer">' +
                    '<div class="text' + (bodyHtml ? '' : ' hide') + '">' + bodyHtml + '</div>' +
                    (hasCustomContent ? '<div class="bb-dialog-custom"></div>' : '') +
                '</div>' +
                (buttons.length ? '<div class="formDialogFooter">' + buildButtonsHtml(buttons) + '</div>' : '') +
            '</div>';

        let formDialogContent = dlg.querySelector('.formDialogContent');
        if (formDialogContent) {
            let maxWidth = resolveDialogWidth(buttons.length, options);
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
        ensureStyles();

        let buttons = normalizeButtons(options.buttons);
        let title = options.title || '';
        let bodyHtml = options.html || options.text || options.message || '';
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

            if (bodyHtml) {
                let description = document.createElement('div');
                description.className = 'bb-dialog-fallback-text';
                description.innerHTML = bodyHtml;
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

            if (title) {
                panel.appendChild(header);
            }

            panel.appendChild(body);

            if (buttons.length) {
                panel.appendChild(footer);
            }

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

    window.BingeBuddyDialog = {
        show: show,
        ensureStyles: ensureStyles
    };
})();

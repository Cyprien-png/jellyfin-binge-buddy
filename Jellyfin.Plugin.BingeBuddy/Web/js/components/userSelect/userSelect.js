(function () {
    'use strict';

    if (window.BingeBuddyUserSelect) {
        return;
    }

    let STYLES_ID = 'binge-buddy-user-select-styles';
    let SCRIPT_LOADED = true;

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
    }

    function normalizeGuid(value) {
        return (value || '').toString().toLowerCase();
    }

    function normalizeUser(user) {
        let id = user.Id || user.id;
        let name = user.Name || user.name || '';
        let tag = user.PrimaryImageTag || user.primaryImageTag;
        let imageUrl = user.ImageUrl || user.imageUrl || null;

        if (!imageUrl && tag && id) {
            imageUrl = '/Users/' + id + '/Images/Primary?tag=' + encodeURIComponent(tag) + '&maxHeight=88&maxWidth=88';
        }

        return {
            Id: id,
            Name: name,
            HasPrimaryImage: !!(user.HasPrimaryImage || user.hasPrimaryImage || tag),
            ImageUrl: imageUrl,
            PrimaryImageTag: tag || null
        };
    }

    function getUserInitial(name) {
        let trimmed = (name || '').trim();
        return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
    }

    function resolveUserImageUrl(user) {
        if (!user.ImageUrl) {
            return null;
        }

        if (user.ImageUrl.indexOf('http') === 0) {
            return user.ImageUrl;
        }

        if (typeof ApiClient === 'undefined' || !ApiClient.serverAddress) {
            return user.ImageUrl;
        }

        let base = ApiClient.serverAddress().replace(/\/$/, '');
        return base + user.ImageUrl;
    }

    function showUserAvatarPlaceholder(wrap, userName) {
        wrap.classList.add('bb-user-avatar-placeholder');
        wrap.textContent = getUserInitial(userName);
    }

    function createUserAvatarElement(user) {
        let wrap = document.createElement('span');
        wrap.className = 'bb-user-avatar-wrap';
        wrap.setAttribute('aria-hidden', 'true');

        let imageUrl = resolveUserImageUrl(user);

        if (imageUrl) {
            let img = document.createElement('img');
            img.className = 'bb-user-avatar';
            img.alt = '';
            img.loading = 'lazy';
            img.src = imageUrl;
            img.addEventListener('error', function () {
                img.remove();
                showUserAvatarPlaceholder(wrap, user.Name);
            });
            wrap.appendChild(img);
        } else {
            showUserAvatarPlaceholder(wrap, user.Name);
        }

        return wrap;
    }

    function syncRowState(row, checkbox) {
        if (checkbox.checked) {
            row.classList.add('is-selected');
        } else {
            row.classList.remove('is-selected');
        }
    }

    function isUserIdSelected(userId, selectedUserIds, isSelected) {
        if (typeof isSelected === 'function') {
            return !!isSelected(userId);
        }

        let ids = selectedUserIds || [];
        return ids.some(function (selectedId) {
            return normalizeGuid(selectedId) === normalizeGuid(userId);
        });
    }

    function ensureStyles() {
        if (document.getElementById(STYLES_ID)) {
            return;
        }

        let link = document.createElement('link');
        link.id = STYLES_ID;
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/userSelect/userSelect.css');
        document.head.appendChild(link);
    }

    function ensureReady(callback) {
        ensureStyles();

        if (SCRIPT_LOADED && window.BingeBuddyUserSelect) {
            callback();
            return;
        }

        let existing = document.getElementById('binge-buddy-user-select-script');
        if (existing) {
            existing.addEventListener('load', callback, { once: true });
            return;
        }

        callback();
    }

    function loadUsersFromApiClient() {
        return ApiClient.getUsers().then(function (users) {
            return (users || []).map(normalizeUser);
        });
    }

    function loadUsersFromPluginApi() {
        return ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('BingeBuddy/Users'),
            dataType: 'json'
        }).then(function (users) {
            if (!Array.isArray(users) || !users.length) {
                return loadUsersFromApiClient();
            }

            return users.map(normalizeUser);
        });
    }

    function loadUsers() {
        return loadUsersFromPluginApi().catch(function () {
            return loadUsersFromApiClient();
        });
    }

    function loadBuddies() {
        return ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('BingeBuddy/Buddies'),
            dataType: 'json'
        }).then(function (users) {
            if (!Array.isArray(users)) {
                return [];
            }

            return users.map(normalizeUser);
        }).catch(function () {
            return [];
        });
    }

    function createEmptyState(options) {
        let empty = document.createElement('div');
        empty.className = 'bb-user-select-empty';

        let title = document.createElement('p');
        title.className = 'bb-user-select-empty-title';
        title.textContent = options.emptyTitle || 'No users found';

        empty.appendChild(title);

        let messageText = options.emptyMessage;
        if (messageText === undefined) {
            messageText = 'Add users in the Jellyfin dashboard first.';
        }

        if (messageText) {
            let message = document.createElement('p');
            message.textContent = messageText;
            empty.appendChild(message);
        }

        return empty;
    }

    function createRow(user, options) {
        options = options || {};

        let row = document.createElement('div');
        row.className = 'bb-user-row checkboxContainer';
        row.dataset.userId = user.Id;

        let label = document.createElement('label');
        label.className = 'emby-checkbox-label';

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.is = 'emby-checkbox';
        checkbox.dataset.userId = user.Id;
        checkbox.checked = isUserIdSelected(user.Id, options.selectedUserIds, options.isSelected);

        let name = document.createElement('span');
        name.className = 'bb-user-name';
        name.textContent = user.Name;

        label.appendChild(checkbox);
        label.appendChild(createUserAvatarElement(user));
        label.appendChild(name);
        row.appendChild(label);

        syncRowState(row, checkbox);

        checkbox.addEventListener('change', function () {
            syncRowState(row, checkbox);

            if (typeof options.onChange === 'function') {
                options.onChange({
                    user: user,
                    userId: user.Id,
                    checked: checkbox.checked,
                    row: row,
                    checkbox: checkbox
                });
            }
        });

        return row;
    }

    function render(container, users, options) {
        if (!container) {
            return;
        }

        ensureStyles();
        options = options || {};

        if (!container.classList.contains('bb-user-select')) {
            container.classList.add('bb-user-select');
        }

        container.innerHTML = '';

        let normalizedUsers = (users || []).map(normalizeUser);

        if (!normalizedUsers.length) {
            container.appendChild(createEmptyState(options));
            return;
        }

        normalizedUsers.forEach(function (user) {
            container.appendChild(createRow(user, options));
        });
    }

    function getSelectedUserIds(container) {
        if (!container) {
            return [];
        }

        let selectedUserIds = [];
        container.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
            if (checkbox.checked && checkbox.dataset.userId) {
                selectedUserIds.push(checkbox.dataset.userId);
            }
        });

        return selectedUserIds;
    }

    function setSelectedUserIds(container, selectedUserIds) {
        if (!container) {
            return;
        }

        container.querySelectorAll('.bb-user-row').forEach(function (row) {
            let checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox) {
                return;
            }

            checkbox.checked = isUserIdSelected(checkbox.dataset.userId, selectedUserIds);
            syncRowState(row, checkbox);
        });
    }

    window.BingeBuddyUserSelect = {
        normalizeGuid: normalizeGuid,
        normalizeUser: normalizeUser,
        loadUsers: loadUsers,
        loadBuddies: loadBuddies,
        ensureStyles: ensureStyles,
        ensureReady: ensureReady,
        createRow: createRow,
        render: render,
        getSelectedUserIds: getSelectedUserIds,
        setSelectedUserIds: setSelectedUserIds,
        syncRowState: syncRowState
    };
})();

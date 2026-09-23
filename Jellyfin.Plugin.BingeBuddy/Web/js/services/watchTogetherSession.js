(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherSession) {
        return;
    }

    let STORAGE_KEY = 'bingeBuddyWatchTogether';

    function normalizeGuid(value) {
        return (value || '').toString().toLowerCase();
    }

    function normalizeUserIds(userIds) {
        if (!Array.isArray(userIds)) {
            return [];
        }

        let seen = {};
        let normalized = [];

        for (let i = 0; i < userIds.length; i++) {
            let id = (userIds[i] || '').toString();
            if (!id) {
                continue;
            }

            let key = normalizeGuid(id);
            if (seen[key]) {
                continue;
            }

            seen[key] = true;
            normalized.push(id);
        }

        return normalized;
    }

    function readStoredValue() {
        try {
            let raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }

            return JSON.parse(raw);
        } catch (error) {
            console.warn('[BingeBuddy] Could not read watch together session from local storage.', error);
            return null;
        }
    }

    function parseStoredUserIds(storedValue) {
        if (!storedValue) {
            return [];
        }

        if (Array.isArray(storedValue)) {
            return normalizeUserIds(storedValue);
        }

        if (storedValue && Array.isArray(storedValue.selectedUserIds)) {
            return normalizeUserIds(storedValue.selectedUserIds);
        }

        if (storedValue && Array.isArray(storedValue.buddyUserIds)) {
            return normalizeUserIds(storedValue.buddyUserIds);
        }

        return [];
    }

    function getSelectedUserIds() {
        return parseStoredUserIds(readStoredValue());
    }

    function setSelectedUserIds(userIds) {
        let normalized = normalizeUserIds(userIds);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('[BingeBuddy] Could not save watch together session to local storage.', error);
        }

        return normalized;
    }

    function clearSelectedUserIds() {
        return setSelectedUserIds([]);
    }

    function filterToKnownBuddies(selectedUserIds, buddies) {
        let buddyIds = {};

        (buddies || []).forEach(function (buddy) {
            let id = buddy && (buddy.Id || buddy.id);
            if (id) {
                buddyIds[normalizeGuid(id)] = id;
            }
        });

        return normalizeUserIds(selectedUserIds).filter(function (userId) {
            return !!buddyIds[normalizeGuid(userId)];
        }).map(function (userId) {
            return buddyIds[normalizeGuid(userId)];
        });
    }

    function pruneToKnownBuddies(buddies) {
        let current = getSelectedUserIds();
        let pruned = filterToKnownBuddies(current, buddies);

        if (pruned.length !== current.length) {
            setSelectedUserIds(pruned);
        }

        return pruned;
    }

    window.BingeBuddyWatchTogetherSession = {
        storageKey: STORAGE_KEY,
        getSelectedUserIds: getSelectedUserIds,
        setSelectedUserIds: setSelectedUserIds,
        clearSelectedUserIds: clearSelectedUserIds,
        filterToKnownBuddies: filterToKnownBuddies,
        pruneToKnownBuddies: pruneToKnownBuddies
    };
})();

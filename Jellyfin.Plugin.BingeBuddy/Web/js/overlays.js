(function () {
    'use strict';

    if (typeof ApiClient === 'undefined') {
        return;
    }

    let CARD_SELECTOR = 'a.cardImageContainer.cardContent, div.listItemImage';
    let DETAIL_SECTION_SELECTOR = '.detailSection';
    let OVERLAY_CLASS = 'bb-watcher-stack';
    let DETAIL_BUDDIES_CLASS = 'bb-detail-buddies';
    let TICKS_PER_SECOND = 10000000;
    let pendingItemIds = new Set();
    let overlayCache = new Map();
    let fetchTimer = null;
    let observer = null;

    function normalizeGuid(value) {
        return (value || '').toString().replace(/-/g, '').toLowerCase();
    }

    function findCardRoot(element) {
        return element.closest('.card[data-id], [data-id].card, .listItem[data-id], [data-id].listItem');
    }

    function extractItemId(element) {
        let card = findCardRoot(element);
        if (card && card.dataset && card.dataset.id) {
            return card.dataset.id;
        }

        let link = element.closest('a[href*="id="]');
        if (link && link.href) {
            let match = link.href.match(/[?&]id=([a-f0-9-]{32,36})/i);
            if (match) {
                return match[1];
            }
        }

        let image = element.querySelector('img[data-src], img[src]') || element;
        let source = image.getAttribute('data-src') || image.getAttribute('src') || '';
        let imageMatch = source.match(/\/Items\/([a-f0-9-]{32,36})\//i);
        if (imageMatch) {
            return imageMatch[1];
        }

        return null;
    }

    function getMountPoint(imageContainer) {
        return imageContainer;
    }

    function resolveImageUrl(imageUrl) {
        if (!imageUrl) {
            return null;
        }

        if (imageUrl.indexOf('http') === 0) {
            return imageUrl;
        }

        return ApiClient.getUrl(imageUrl.replace(/^\//, ''));
    }

    function getInitial(name) {
        let trimmed = (name || '').trim();
        return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
    }

    function removeExistingOverlay(mount) {
        let existing = mount.querySelector('.' + OVERLAY_CLASS);
        if (existing) {
            existing.remove();
        }
    }

    function renderOverlay(mount, watchers) {
        removeExistingOverlay(mount);

        if (!watchers || !watchers.length) {
            return;
        }

        let stack = document.createElement('div');
        stack.className = OVERLAY_CLASS;

        let visibleWatchers = watchers.slice(0, 3);
        visibleWatchers.forEach(function (watcher, index) {
            let name = watcher.Name || watcher.name || '';
            let imageUrl = resolveImageUrl(watcher.ImageUrl || watcher.imageUrl);

            if (imageUrl) {
                let img = document.createElement('img');
                img.className = 'bb-watcher-avatar';
                img.alt = name;
                img.title = name;
                img.src = imageUrl;
                img.style.zIndex = String(index + 1);
                img.addEventListener('error', function () {
                    img.replaceWith(createInitialAvatar(name, index));
                });
                stack.appendChild(img);
            } else {
                stack.appendChild(createInitialAvatar(name, index));
            }
        });

        if (watchers.length > 3) {
            let more = document.createElement('span');
            more.count = watchers.length - 3;
            more.className = 'bb-watcher-more';
            more.textContent = more.count > 99 ? '99+' : '+' + more.count;
            more.title = watchers.slice(3).map(function (watcher) {
                return watcher.Name || watcher.name;
            }).join(', ');
            more.style.zIndex = '4';
            stack.appendChild(more);
        }

        mount.appendChild(stack);
    }

    function createInitialAvatar(name, index) {
        let avatar = document.createElement('span');
        avatar.className = 'bb-watcher-avatar bb-watcher-initial';
        avatar.textContent = getInitial(name);
        avatar.title = name;
        avatar.style.zIndex = String(index + 1);
        return avatar;
    }

    function getDetailsItemIdFromHash() {
        let hash = window.location.hash || '';
        if (hash.indexOf('/details') === -1) {
            return null;
        }

        let match = hash.match(/[?&]id=([a-f0-9-]{32,36})/i);
        return match ? match[1] : null;
    }

    function parseWatchProgress(raw) {
        if (!raw) {
            return { played: false, playbackPositionTicks: 0 };
        }

        return {
            played: !!(raw.played || raw.Played),
            playbackPositionTicks: Number(raw.playbackPositionTicks || raw.PlaybackPositionTicks || 0)
        };
    }

    function parseWatcher(raw) {
        var progress = parseWatchProgress(raw);

        return {
            Name: raw.Name || raw.name || '',
            name: raw.Name || raw.name || '',
            ImageUrl: raw.ImageUrl || raw.imageUrl || '',
            imageUrl: raw.ImageUrl || raw.imageUrl || '',
            played: progress.played,
            playbackPositionTicks: progress.playbackPositionTicks
        };
    }

    function parseItemOverlay(raw) {
        if (!raw) {
            return {
                watchers: [],
                runTimeTicks: 0,
                currentUser: { played: false, playbackPositionTicks: 0 }
            };
        }

        if (Array.isArray(raw)) {
            return {
                watchers: raw.map(parseWatcher),
                runTimeTicks: 0,
                currentUser: { played: false, playbackPositionTicks: 0 }
            };
        }

        return {
            watchers: (raw.watchers || raw.Watchers || []).map(parseWatcher),
            runTimeTicks: Number(raw.runTimeTicks || raw.RunTimeTicks || 0),
            currentUser: parseWatchProgress(raw.currentUser || raw.CurrentUser)
        };
    }

    function getProgressPercent(played, playbackPositionTicks, runTimeTicks) {
        if (played) {
            return 100;
        }

        if (!runTimeTicks || runTimeTicks <= 0) {
            return 0;
        }

        return Math.min(100, Math.round((playbackPositionTicks / runTimeTicks) * 100));
    }

    function formatWatchedDuration(playbackPositionTicks) {
        var totalSeconds = Math.max(0, Math.floor(playbackPositionTicks / TICKS_PER_SECOND));
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;

        if (hours >= 1) {
            return hours + 'h ' + minutes + 'm ' + seconds + 's';
        }

        return minutes + 'm ' + seconds + 's';
    }

    function formatProgressStatus(played, playbackPositionTicks, runTimeTicks) {
        if (played) {
            return 'Finished';
        }

        var watched = formatWatchedDuration(playbackPositionTicks);
        var percent = getProgressPercent(false, playbackPositionTicks, runTimeTicks);
        return watched + ' watched (' + percent + '%)';
    }

    function createProgressRow(labelText, progress, runTimeTicks, variant) {
        var row = document.createElement('div');
        row.className = 'bb-detail-progress-row';

        var meta = document.createElement('div');
        meta.className = 'bb-detail-progress-meta';

        var label = document.createElement('span');
        label.className = 'bb-detail-progress-label';
        label.textContent = labelText;

        var status = document.createElement('span');
        status.className = 'bb-detail-progress-status';
        status.textContent = formatProgressStatus(
            progress.played,
            progress.playbackPositionTicks,
            runTimeTicks
        );

        meta.appendChild(label);
        meta.appendChild(status);

        var track = document.createElement('div');
        track.className = 'bb-detail-progress-track';

        var fill = document.createElement('div');
        fill.className = 'bb-detail-progress-fill bb-detail-progress-fill-' + variant;
        fill.style.width = getProgressPercent(
            progress.played,
            progress.playbackPositionTicks,
            runTimeTicks
        ) + '%';

        track.appendChild(fill);
        row.appendChild(meta);
        row.appendChild(track);

        return row;
    }

    function createDetailProgressSection(currentUser, watcher, runTimeTicks) {
        var section = document.createElement('div');
        section.className = 'bb-detail-progress';

        var heading = document.createElement('div');
        heading.className = 'bb-detail-progress-heading';
        heading.textContent = 'Progress';
        section.appendChild(heading);

        section.appendChild(createProgressRow('You', currentUser, runTimeTicks, 'you'));
        section.appendChild(createProgressRow('Them', {
            played: watcher.played,
            playbackPositionTicks: watcher.playbackPositionTicks
        }, runTimeTicks, 'them'));

        return section;
    }

    function getItemOverlayFromResponse(response, itemId) {
        if (!response) {
            return parseItemOverlay(null);
        }

        return parseItemOverlay(response[normalizeGuid(itemId)] || response[itemId]);
    }

    function removeDetailBuddiesSection(detailSection) {
        let existing = detailSection.querySelector('.' + DETAIL_BUDDIES_CLASS);
        if (existing) {
            existing.remove();
        }
    }

    function createDetailInitialAvatar(name) {
        let avatar = document.createElement('span');
        avatar.className = 'bb-detail-buddy-avatar bb-detail-buddy-initial';
        avatar.textContent = getInitial(name);
        avatar.title = name;
        return avatar;
    }

    function renderDetailBuddyCard(watcher, overlay) {
        let card = document.createElement('div');
        card.className = 'bb-detail-buddy-card';

        let name = watcher.Name || watcher.name || '';
        let imageUrl = resolveImageUrl(watcher.ImageUrl || watcher.imageUrl);

        if (imageUrl) {
            let img = document.createElement('img');
            img.className = 'bb-detail-buddy-avatar';
            img.alt = name;
            img.title = name;
            img.src = imageUrl;
            img.addEventListener('error', function () {
                img.replaceWith(createDetailInitialAvatar(name));
            });
            card.appendChild(img);
        } else {
            card.appendChild(createDetailInitialAvatar(name));
        }

        let label = document.createElement('span');
        label.className = 'bb-detail-buddy-name';
        label.textContent = name;
        label.title = name;
        card.appendChild(label);

        card.appendChild(createDetailProgressSection(
            overlay.currentUser,
            watcher,
            overlay.runTimeTicks
        ));

        return card;
    }

    function renderDetailBuddiesSection(detailSection, itemId, overlay) {
        removeDetailBuddiesSection(detailSection);
        detailSection.dataset.bbDetailBuddiesItemId = itemId;

        if (!overlay || !overlay.watchers || !overlay.watchers.length) {
            return;
        }

        let section = document.createElement('div');
        section.className = DETAIL_BUDDIES_CLASS + ' verticalSection detailVerticalSection';

        let title = document.createElement('h2');
        title.className = 'sectionTitle';
        title.textContent = 'Binge buddies';
        section.appendChild(title);

        let grid = document.createElement('div');
        grid.className = 'bb-detail-buddies-grid focuscontainer-x';

        overlay.watchers.forEach(function (watcher) {
            grid.appendChild(renderDetailBuddyCard(watcher, overlay));
        });

        section.appendChild(grid);
        detailSection.appendChild(section);
    }

    function renderDetailBuddiesForItem(itemId, overlay) {
        let detailSection = document.querySelector(DETAIL_SECTION_SELECTOR);
        if (!detailSection || getDetailsItemIdFromHash() !== itemId) {
            return;
        }

        renderDetailBuddiesSection(detailSection, itemId, parseItemOverlay(overlay));
    }

    function queueDetailBuddiesFetch(itemId) {
        if (!itemId) {
            return;
        }

        queueFetch(itemId);
    }

    function scanDetailPage() {
        let itemId = getDetailsItemIdFromHash();
        let detailSection = document.querySelector(DETAIL_SECTION_SELECTOR);

        if (!itemId || !detailSection) {
            return;
        }

        if (detailSection.dataset.bbDetailBuddiesItemId === itemId) {
            return;
        }

        let cached = overlayCache.get(normalizeGuid(itemId));
        if (cached) {
            renderDetailBuddiesSection(detailSection, itemId, cached);
            return;
        }

        queueDetailBuddiesFetch(itemId);
    }

    function queueFetch(itemId) {
        if (!itemId) {
            return;
        }

        pendingItemIds.add(itemId);

        if (fetchTimer) {
            clearTimeout(fetchTimer);
        }

        fetchTimer = setTimeout(fetchPendingOverlays, 120);
    }

    function fetchPendingOverlays() {
        let itemIds = Array.from(pendingItemIds);
        pendingItemIds.clear();

        if (!itemIds.length || !ApiClient.getCurrentUserId || !ApiClient.getCurrentUserId()) {
            return;
        }

        let query = itemIds.map(function (itemId) {
            return 'itemIds=' + encodeURIComponent(itemId);
        }).join('&');

        ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('BingeBuddy/Overlays?' + query),
            dataType: 'json'
        }).then(function (response) {
            Object.keys(response || {}).forEach(function (key) {
                overlayCache.set(normalizeGuid(key), parseItemOverlay(response[key]));
            });

            document.querySelectorAll(CARD_SELECTOR).forEach(function (container) {
                let itemId = extractItemId(container);
                if (!itemId) {
                    return;
                }

                let overlay = overlayCache.get(normalizeGuid(itemId));
                if (overlay) {
                    renderOverlay(getMountPoint(container), overlay.watchers);
                }
            });

            itemIds.forEach(function (itemId) {
                renderDetailBuddiesForItem(itemId, getItemOverlayFromResponse(response, itemId));
            });
        });
    }

    function processContainer(container) {
        if (!container || container.dataset.bbWatcherProcessed === 'true') {
            return;
        }

        let itemId = extractItemId(container);
        if (!itemId) {
            return;
        }

        container.dataset.bbWatcherProcessed = 'true';

        let cached = overlayCache.get(normalizeGuid(itemId));
        if (cached) {
            renderOverlay(getMountPoint(container), cached.watchers);
            return;
        }

        queueFetch(itemId);
    }

    function scanCards(root) {
        (root || document).querySelectorAll(CARD_SELECTOR).forEach(processContainer);
    }

    function setupObserver() {
        if (observer) {
            return;
        }

        observer = new MutationObserver(function () {
            scanCards(document);
            scanDetailPage();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanCards(document);
    scanDetailPage();
    setupObserver();
    document.addEventListener('viewshow', function () {
        scanCards(document);
        scanDetailPage();
    });
    window.addEventListener('hashchange', function () {
        let detailSection = document.querySelector(DETAIL_SECTION_SELECTOR);
        if (detailSection) {
            delete detailSection.dataset.bbDetailBuddiesItemId;
        }

        scanDetailPage();
    });
})();

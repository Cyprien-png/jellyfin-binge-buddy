(function () {
    'use strict';

    if (typeof ApiClient === 'undefined') {
        return;
    }

    if (window.BingeBuddyWatchProgress) {
        BingeBuddyWatchProgress.ensureStyles();
    }

    function getWatchProgress() {
        return window.BingeBuddyWatchProgress || null;
    }

    let CARD_SELECTOR = 'a.cardImageContainer.cardContent, div.listItemImage';
    let DETAIL_SECTION_SELECTOR = '.detailSection';
    let DETAIL_MOUNT_SELECTOR = '.detailPagePrimaryContent';
    let OVERLAY_CLASS = 'bb-watcher-stack';
    let DETAIL_BUDDIES_CLASS = 'bb-detail-buddies';
    let DETAIL_MOUNT_DATA_ATTR = 'bbDetailBuddiesItemId';
    let DETAIL_RETRY_MS = 150;
    let DETAIL_RETRY_MAX = 40;
    let pendingItemIds = new Set();
    let overlayCache = new Map();
    let fetchTimer = null;
    let detailRetryTimer = null;
    let detailScanTimer = null;
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
        let watchProgress = getWatchProgress();
        if (!watchProgress) {
            return {
                played: false,
                playbackPositionTicks: 0,
                episodeIndexNumber: null,
                episodeRunTimeTicks: 0
            };
        }

        return watchProgress.parseProgress(raw);
    }

    function parseWatcher(raw) {
        let progress = parseWatchProgress(raw);

        return {
            Name: raw.Name || raw.name || '',
            name: raw.Name || raw.name || '',
            ImageUrl: raw.ImageUrl || raw.imageUrl || '',
            imageUrl: raw.ImageUrl || raw.imageUrl || '',
            played: progress.played,
            playbackPositionTicks: progress.playbackPositionTicks,
            episodeIndexNumber: progress.episodeIndexNumber,
            episodeRunTimeTicks: progress.episodeRunTimeTicks
        };
    }

    function parseItemOverlay(raw) {
        if (!raw) {
            return {
                watchers: [],
                runTimeTicks: 0,
                isSeason: false,
                currentUser: parseWatchProgress(null)
            };
        }

        if (Array.isArray(raw)) {
            return {
                watchers: raw.map(parseWatcher),
                runTimeTicks: 0,
                isSeason: false,
                currentUser: parseWatchProgress(null)
            };
        }

        return {
            watchers: (raw.watchers || raw.Watchers || []).map(parseWatcher),
            runTimeTicks: Number(raw.runTimeTicks || raw.RunTimeTicks || 0),
            isSeason: !!(raw.isSeason || raw.IsSeason),
            currentUser: parseWatchProgress(raw.currentUser || raw.CurrentUser)
        };
    }

    function createDetailProgressSection(currentUser, watcher, overlay) {
        let watchProgress = getWatchProgress();
        if (!watchProgress) {
            let fallback = document.createElement('div');
            fallback.className = 'bb-detail-progress';
            return fallback;
        }

        watchProgress.ensureStyles();

        let section = document.createElement('div');
        section.className = 'bb-detail-progress';

        section.appendChild(watchProgress.createSectionHeading('Progress'));

        let isSeason = overlay.isSeason;
        let youRuntime = isSeason
            ? watchProgress.getProgressRuntime(currentUser, 0)
            : overlay.runTimeTicks;
        let themRuntime = isSeason
            ? watchProgress.getProgressRuntime(watcher, 0)
            : overlay.runTimeTicks;

        section.appendChild(watchProgress.createRow({
            labelText: 'You',
            progress: currentUser,
            runTimeTicks: youRuntime,
            variant: 'you',
            showEpisodeLine: isSeason
        }));
        section.appendChild(watchProgress.createRow({
            labelText: 'Them',
            progress: watcher,
            runTimeTicks: themRuntime,
            variant: 'them',
            showEpisodeLine: isSeason
        }));

        return section;
    }

    function getItemOverlayFromResponse(response, itemId) {
        if (!response) {
            return parseItemOverlay(null);
        }

        return parseItemOverlay(response[normalizeGuid(itemId)] || response[itemId]);
    }

    function removeDetailBuddiesFromMount(mountPoint) {
        if (!mountPoint) {
            return;
        }

        mountPoint.querySelectorAll('.' + DETAIL_BUDDIES_CLASS).forEach(function (element) {
            element.remove();
        });
    }

    function clearAllDetailBuddiesState() {
        document.querySelectorAll('.' + DETAIL_BUDDIES_CLASS).forEach(function (element) {
            element.remove();
        });

        document.querySelectorAll('[data-bb-detail-buddies-item-id]').forEach(function (element) {
            delete element.dataset[DETAIL_MOUNT_DATA_ATTR];
        });
    }

    function isElementVisible(element) {
        if (!element) {
            return false;
        }

        if (element.offsetParent !== null) {
            return true;
        }

        return element.getClientRects().length > 0;
    }

    function findDetailMountPoint() {
        let visiblePage = document.querySelector('.page:not(.hide)');
        let candidates = [];

        if (visiblePage) {
            candidates = candidates.concat(Array.from(visiblePage.querySelectorAll(DETAIL_MOUNT_SELECTOR)));
            candidates = candidates.concat(Array.from(visiblePage.querySelectorAll(DETAIL_SECTION_SELECTOR)));
        }

        candidates = candidates.concat(Array.from(document.querySelectorAll(DETAIL_MOUNT_SELECTOR)));
        candidates = candidates.concat(Array.from(document.querySelectorAll(DETAIL_SECTION_SELECTOR)));

        for (let i = 0; i < candidates.length; i++) {
            if (isElementVisible(candidates[i])) {
                return candidates[i];
            }
        }

        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function getDetailInsertAnchor(mountPoint) {
        if (!mountPoint) {
            return null;
        }

        if (mountPoint.matches(DETAIL_MOUNT_SELECTOR)) {
            return mountPoint.querySelector(DETAIL_SECTION_SELECTOR) || mountPoint.firstChild;
        }

        return mountPoint.firstChild;
    }

    function isDetailBuddiesMounted(mountPoint, itemId) {
        if (!mountPoint) {
            return false;
        }

        return mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR] === itemId
            && !!mountPoint.querySelector('.' + DETAIL_BUDDIES_CLASS);
    }

    function clearDetailBuddiesMountState(mountPoint) {
        if (!mountPoint) {
            return;
        }

        delete mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR];
        removeDetailBuddiesFromMount(mountPoint);
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
            overlay
        ));

        return card;
    }

    function renderDetailBuddiesSection(mountPoint, itemId, overlay) {
        removeDetailBuddiesFromMount(mountPoint);
        delete mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR];

        overlay = parseItemOverlay(overlay);

        if (!overlay || !overlay.watchers || !overlay.watchers.length) {
            return false;
        }

        let section = document.createElement('div');
        section.className = DETAIL_BUDDIES_CLASS + ' verticalSection detailVerticalSection';

        if (overlay.isSeason) {
            section.classList.add('bb-detail-buddies-season');
        }

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

        let insertAnchor = getDetailInsertAnchor(mountPoint);
        if (insertAnchor) {
            mountPoint.insertBefore(section, insertAnchor);
        } else {
            mountPoint.appendChild(section);
        }

        mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR] = itemId;
        return true;
    }

    function tryRenderDetailBuddies() {
        let itemId = getDetailsItemIdFromHash();
        if (!itemId) {
            return true;
        }

        let mountPoint = findDetailMountPoint();
        if (!mountPoint) {
            return false;
        }

        if (isDetailBuddiesMounted(mountPoint, itemId)) {
            return true;
        }

        if (mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR]
            && mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR] !== itemId) {
            clearDetailBuddiesMountState(mountPoint);
        } else if (mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR] === itemId) {
            delete mountPoint.dataset[DETAIL_MOUNT_DATA_ATTR];
        }

        let cached = overlayCache.get(normalizeGuid(itemId));
        if (cached) {
            if (!cached.watchers || !cached.watchers.length) {
                return true;
            }

            return renderDetailBuddiesSection(mountPoint, itemId, cached);
        }

        if (!pendingItemIds.has(itemId)) {
            queueDetailBuddiesFetch(itemId);
        }

        return false;
    }

    function scheduleDetailBuddiesRetry(resetAttempts) {
        if (resetAttempts) {
            if (detailRetryTimer) {
                clearTimeout(detailRetryTimer);
                detailRetryTimer = null;
            }
        } else if (detailRetryTimer) {
            return;
        }

        let attempts = 0;

        function tick() {
            detailRetryTimer = null;
            attempts++;

            if (!getDetailsItemIdFromHash()) {
                return;
            }

            if (tryRenderDetailBuddies()) {
                return;
            }

            if (attempts < DETAIL_RETRY_MAX) {
                detailRetryTimer = setTimeout(tick, DETAIL_RETRY_MS);
            }
        }

        detailRetryTimer = setTimeout(tick, 0);
    }

    function scheduleDetailBuddiesScan() {
        if (detailScanTimer) {
            clearTimeout(detailScanTimer);
        }

        detailScanTimer = setTimeout(function () {
            detailScanTimer = null;
            if (getDetailsItemIdFromHash()) {
                scheduleDetailBuddiesRetry(true);
            }
        }, 80);
    }

    function scanDetailPage() {
        if (!getDetailsItemIdFromHash()) {
            return;
        }

        scheduleDetailBuddiesRetry(true);
    }

    function queueDetailBuddiesFetch(itemId) {
        if (!itemId) {
            return;
        }

        queueFetch(itemId);
    }

    function queueFetch(itemId) {
        if (!itemId) {
            return;
        }

        pendingItemIds.add(itemId);

        if (fetchTimer) {
            clearTimeout(fetchTimer);
        }

        fetchTimer = setTimeout(function () {
            fetchTimer = null;
            fetchPendingOverlays();
        }, 120);
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

            scheduleDetailBuddiesRetry(true);
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
            scheduleDetailBuddiesScan();
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
        clearAllDetailBuddiesState();
        scheduleDetailBuddiesRetry(true);
    });
})();

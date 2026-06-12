(function () {
    'use strict';

    if (typeof ApiClient === 'undefined') {
        return;
    }

    var CARD_SELECTOR = 'a.cardImageContainer.cardContent, div.listItemImage';
    var OVERLAY_CLASS = 'bb-watcher-stack';
    var pendingItemIds = new Set();
    var overlayCache = new Map();
    var fetchTimer = null;
    var observer = null;

    function normalizeGuid(value) {
        return (value || '').toString().replace(/-/g, '').toLowerCase();
    }

    function findCardRoot(element) {
        return element.closest('.card[data-id], [data-id].card, .listItem[data-id], [data-id].listItem');
    }

    function extractItemId(element) {
        var card = findCardRoot(element);
        if (card && card.dataset && card.dataset.id) {
            return card.dataset.id;
        }

        var link = element.closest('a[href*="id="]');
        if (link && link.href) {
            var match = link.href.match(/[?&]id=([a-f0-9-]{32,36})/i);
            if (match) {
                return match[1];
            }
        }

        var image = element.querySelector('img[data-src], img[src]') || element;
        var source = image.getAttribute('data-src') || image.getAttribute('src') || '';
        var imageMatch = source.match(/\/Items\/([a-f0-9-]{32,36})\//i);
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
        var trimmed = (name || '').trim();
        return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
    }

    function removeExistingOverlay(mount) {
        var existing = mount.querySelector('.' + OVERLAY_CLASS);
        if (existing) {
            existing.remove();
        }
    }

    function renderOverlay(mount, watchers) {
        removeExistingOverlay(mount);

        if (!watchers || !watchers.length) {
            return;
        }

        var stack = document.createElement('div');
        stack.className = OVERLAY_CLASS;

        var visibleWatchers = watchers.slice(0, 3);
        visibleWatchers.forEach(function (watcher, index) {
            var name = watcher.Name || watcher.name || '';
            var imageUrl = resolveImageUrl(watcher.ImageUrl || watcher.imageUrl);

            if (imageUrl) {
                var img = document.createElement('img');
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
            var more = document.createElement('span');
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
        var avatar = document.createElement('span');
        avatar.className = 'bb-watcher-avatar bb-watcher-initial';
        avatar.textContent = getInitial(name);
        avatar.title = name;
        avatar.style.zIndex = String(index + 1);
        return avatar;
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
        var itemIds = Array.from(pendingItemIds);
        pendingItemIds.clear();

        if (!itemIds.length || !ApiClient.getCurrentUserId || !ApiClient.getCurrentUserId()) {
            return;
        }

        var query = itemIds.map(function (itemId) {
            return 'itemIds=' + encodeURIComponent(itemId);
        }).join('&');

        ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('BingeBuddy/Overlays?' + query),
            dataType: 'json'
        }).then(function (response) {
            Object.keys(response || {}).forEach(function (key) {
                overlayCache.set(normalizeGuid(key), response[key] || []);
            });

            document.querySelectorAll(CARD_SELECTOR).forEach(function (container) {
                var itemId = extractItemId(container);
                if (!itemId) {
                    return;
                }

                var watchers = overlayCache.get(normalizeGuid(itemId));
                if (watchers) {
                    renderOverlay(getMountPoint(container), watchers);
                }
            });
        });
    }

    function processContainer(container) {
        if (!container || container.dataset.bbWatcherProcessed === 'true') {
            return;
        }

        var itemId = extractItemId(container);
        if (!itemId) {
            return;
        }

        container.dataset.bbWatcherProcessed = 'true';

        var cached = overlayCache.get(normalizeGuid(itemId));
        if (cached) {
            renderOverlay(getMountPoint(container), cached);
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
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanCards(document);
    setupObserver();
    document.addEventListener('viewshow', function () {
        scanCards(document);
    });
})();

(function () {
    'use strict';

    if (window.BingeBuddyMediaSelect) {
        return;
    }

    let STYLES_ID = 'binge-buddy-media-select-styles';

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

    function normalizeMedia(media) {
        let id = media.Id || media.id;
        let name = media.Name || media.name || 'Unknown media';
        let secondaryText = media.SecondaryText || media.secondaryText || '';
        let tag = media.PrimaryImageTag || media.primaryImageTag;
        let imageUrl = media.ImageUrl || media.imageUrl || null;
        let watchedAt = media.WatchedAt || media.watchedAt || null;

        if (!secondaryText && watchedAt) {
            secondaryText = formatFriendlyDateTime(watchedAt);
        }

        if (!imageUrl && tag && id) {
            imageUrl = '/Items/' + id + '/Images/Primary?tag=' + encodeURIComponent(tag) + '&maxHeight=120&maxWidth=213';
        }

        return {
            Id: id,
            Name: name,
            SecondaryText: secondaryText,
            HasPrimaryImage: !!(media.HasPrimaryImage || media.hasPrimaryImage || tag),
            ImageUrl: imageUrl,
            PrimaryImageTag: tag || null,
            MediaType: media.MediaType || media.mediaType || '',
            WatchedAt: watchedAt,
            Played: !!(media.Played || media.played),
            PlaybackPositionTicks: Number(media.PlaybackPositionTicks || media.playbackPositionTicks || 0),
            RunTimeTicks: Number(media.RunTimeTicks || media.runTimeTicks || 0)
        };
    }

    function formatFriendlyDateTime(value) {
        if (!value) {
            return '';
        }

        let date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function resolveMediaImageUrl(media) {
        if (!media.ImageUrl) {
            return null;
        }

        if (media.ImageUrl.indexOf('http') === 0) {
            return media.ImageUrl;
        }

        if (typeof ApiClient === 'undefined' || !ApiClient.serverAddress) {
            return media.ImageUrl;
        }

        let base = ApiClient.serverAddress().replace(/\/$/, '');
        return base + media.ImageUrl;
    }

    function showMediaThumbPlaceholder(wrap) {
        wrap.classList.add('bb-media-thumb-placeholder');
        wrap.textContent = 'No image';
    }

    function createMediaThumbnailElement(media) {
        let wrap = document.createElement('span');
        wrap.className = 'bb-media-thumb-wrap';
        wrap.setAttribute('aria-hidden', 'true');

        let imageUrl = resolveMediaImageUrl(media);

        if (imageUrl) {
            let img = document.createElement('img');
            img.className = 'bb-media-thumb';
            img.alt = '';
            img.loading = 'lazy';
            img.src = imageUrl;
            img.addEventListener('error', function () {
                img.remove();
                showMediaThumbPlaceholder(wrap);
            });
            wrap.appendChild(img);
        } else {
            showMediaThumbPlaceholder(wrap);
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

    function isMediaIdSelected(mediaId, selectedMediaIds, isSelected) {
        if (typeof isSelected === 'function') {
            return !!isSelected(mediaId);
        }

        let ids = selectedMediaIds || [];
        return ids.some(function (selectedId) {
            return normalizeGuid(selectedId) === normalizeGuid(mediaId);
        });
    }

    function ensureStyles() {
        if (document.getElementById(STYLES_ID)) {
            return;
        }

        let link = document.createElement('link');
        link.id = STYLES_ID;
        link.rel = 'stylesheet';
        link.href = getAssetUrl('components/mediaSelect/mediaSelect.css');
        document.head.appendChild(link);
    }

    function createEmptyState(options) {
        let empty = document.createElement('div');
        empty.className = 'bb-media-select-empty';

        let title = document.createElement('p');
        title.className = 'bb-media-select-empty-title';
        title.textContent = options.emptyTitle || 'No media found';

        empty.appendChild(title);

        if (options.emptyMessage) {
            let message = document.createElement('p');
            message.textContent = options.emptyMessage;
            empty.appendChild(message);
        }

        return empty;
    }

    function createRow(media, options) {
        options = options || {};

        let row = document.createElement('div');
        row.className = 'bb-media-row checkboxContainer';
        row.dataset.mediaId = media.Id;

        let label = document.createElement('label');
        label.className = 'emby-checkbox-label';

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.is = 'emby-checkbox';
        checkbox.dataset.mediaId = media.Id;
        checkbox.checked = isMediaIdSelected(media.Id, options.selectedMediaIds, options.isSelected);

        let copy = document.createElement('span');
        copy.className = 'bb-media-copy';

        let topCopy = document.createElement('span');
        topCopy.className = 'bb-media-top-copy';

        let name = document.createElement('span');
        name.className = 'bb-media-name';
        name.textContent = media.Name;

        let secondary = document.createElement('span');
        secondary.className = 'bb-media-secondary';
        secondary.textContent = media.SecondaryText || '';

        topCopy.appendChild(name);
        topCopy.appendChild(secondary);

        copy.appendChild(topCopy);

        if (window.BingeBuddyWatchProgress) {
            BingeBuddyWatchProgress.ensureStyles();
            copy.appendChild(BingeBuddyWatchProgress.createRow({
                labelText: BingeBuddyWatchProgress.formatCompactStatus(
                    media.Played,
                    media.PlaybackPositionTicks,
                    media.RunTimeTicks
                ),
                progress: {
                    played: media.Played,
                    playbackPositionTicks: media.PlaybackPositionTicks
                },
                runTimeTicks: media.RunTimeTicks,
                variant: 'you',
                showStatus: false
            }));
        }

        label.appendChild(checkbox);
        label.appendChild(createMediaThumbnailElement(media));
        label.appendChild(copy);
        row.appendChild(label);

        syncRowState(row, checkbox);

        checkbox.addEventListener('change', function () {
            syncRowState(row, checkbox);

            if (typeof options.onChange === 'function') {
                options.onChange({
                    media: media,
                    mediaId: media.Id,
                    checked: checkbox.checked,
                    row: row,
                    checkbox: checkbox
                });
            }
        });

        return row;
    }

    function render(container, mediaItems, options) {
        if (!container) {
            return;
        }

        ensureStyles();
        options = options || {};

        if (!container.classList.contains('bb-media-select')) {
            container.classList.add('bb-media-select');
        }

        container.innerHTML = '';

        let normalizedMedia = (mediaItems || []).map(normalizeMedia);

        if (!normalizedMedia.length) {
            container.appendChild(createEmptyState(options));
            return;
        }

        normalizedMedia.forEach(function (media) {
            container.appendChild(createRow(media, options));
        });
    }

    function getSelectedMediaIds(container) {
        if (!container) {
            return [];
        }

        let selectedMediaIds = [];
        container.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
            if (checkbox.checked && checkbox.dataset.mediaId) {
                selectedMediaIds.push(checkbox.dataset.mediaId);
            }
        });

        return selectedMediaIds;
    }

    function setSelectedMediaIds(container, selectedMediaIds) {
        if (!container) {
            return;
        }

        container.querySelectorAll('.bb-media-row').forEach(function (row) {
            let checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox) {
                return;
            }

            checkbox.checked = isMediaIdSelected(checkbox.dataset.mediaId, selectedMediaIds);
            syncRowState(row, checkbox);
        });
    }

    window.BingeBuddyMediaSelect = {
        normalizeGuid: normalizeGuid,
        normalizeMedia: normalizeMedia,
        formatFriendlyDateTime: formatFriendlyDateTime,
        ensureStyles: ensureStyles,
        createRow: createRow,
        render: render,
        getSelectedMediaIds: getSelectedMediaIds,
        setSelectedMediaIds: setSelectedMediaIds,
        syncRowState: syncRowState
    };
})();

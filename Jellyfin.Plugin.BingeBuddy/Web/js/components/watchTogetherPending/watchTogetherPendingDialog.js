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
        requireContinue: true,
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

    function getWatchedAt(media) {
        return media.WatchedAt || media.watchedAt || null;
    }

    function compareWatchedAt(a, b) {
        let aTime = a ? new Date(a).getTime() : Number.MAX_SAFE_INTEGER;
        let bTime = b ? new Date(b).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    }

    function formatSeasonLabel(seasonIndexNumber) {
        let index = Number(seasonIndexNumber);
        if (isNaN(index) || index < 0) {
            return 'Unknown season';
        }

        return 'Season ' + String(index).padStart(2, '0');
    }

    function buildMediaTree(mediaItems) {
        let normalized = (mediaItems || []).map(BingeBuddyMediaSelect.normalizeMedia);
        let seriesMap = {};
        let seriesOrder = [];
        let movies = [];

        normalized.forEach(function (media) {
            let seriesId = media.SeriesId;
            if (seriesId) {
                let key = BingeBuddyMediaSelect.normalizeGuid(seriesId);
                if (!seriesMap[key]) {
                    seriesMap[key] = {
                        type: 'series',
                        seriesId: seriesId,
                        name: media.SeriesName || 'Unknown series',
                        logoUrl: media.SeriesLogoUrl,
                        hasLogo: media.SeriesHasLogo,
                        backdropUrl: media.SeriesBackdropUrl,
                        hasBackdrop: media.SeriesHasBackdrop,
                        firstWatchedAt: getWatchedAt(media),
                        seasons: {}
                    };
                    seriesOrder.push(key);
                }

                let group = seriesMap[key];
                let watchedAt = getWatchedAt(media);
                if (compareWatchedAt(watchedAt, group.firstWatchedAt) < 0) {
                    group.firstWatchedAt = watchedAt;
                }

                let seasonNum = media.SeasonIndexNumber != null ? Number(media.SeasonIndexNumber) : -1;
                let seasonKey = String(seasonNum);
                if (!group.seasons[seasonKey]) {
                    group.seasons[seasonKey] = {
                        seasonIndexNumber: seasonNum,
                        episodes: []
                    };
                }

                group.seasons[seasonKey].episodes.push(media);
                return;
            }

            movies.push({
                type: 'movie',
                media: media,
                watchedAt: getWatchedAt(media)
            });
        });

        let timeline = [];

        movies.forEach(function (entry) {
            timeline.push({
                kind: 'movie',
                watchedAt: entry.watchedAt,
                entry: entry
            });
        });

        seriesOrder.forEach(function (key) {
            let series = seriesMap[key];
            timeline.push({
                kind: 'series',
                watchedAt: series.firstWatchedAt,
                entry: series
            });
        });

        timeline.sort(function (a, b) {
            return compareWatchedAt(a.watchedAt, b.watchedAt);
        });

        return timeline.map(function (item) {
            if (item.kind === 'movie') {
                return item.entry;
            }

            let series = item.entry;
            let seasons = Object.keys(series.seasons).map(function (key) {
                return series.seasons[key];
            }).sort(function (a, b) {
                return a.seasonIndexNumber - b.seasonIndexNumber;
            });

            seasons.forEach(function (season) {
                season.episodes.sort(function (a, b) {
                    let aEpisode = a.EpisodeIndexNumber != null ? Number(a.EpisodeIndexNumber) : Number.MAX_SAFE_INTEGER;
                    let bEpisode = b.EpisodeIndexNumber != null ? Number(b.EpisodeIndexNumber) : Number.MAX_SAFE_INTEGER;
                    if (aEpisode !== bEpisode) {
                        return aEpisode - bEpisode;
                    }

                    return compareWatchedAt(getWatchedAt(a), getWatchedAt(b));
                });
            });

            return {
                type: 'series',
                seriesId: series.seriesId,
                name: series.name,
                logoUrl: series.logoUrl,
                hasLogo: series.hasLogo,
                backdropUrl: series.backdropUrl,
                hasBackdrop: series.hasBackdrop,
                seasons: seasons
            };
        });
    }

    function createChevron() {
        let chevron = document.createElement('span');
        chevron.className = 'bb-pending-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        return chevron;
    }

    function createCollapsibleSection(headerClass, bodyClass, headerContent, isOpen) {
        let section = document.createElement('div');
        section.className = headerClass.replace('-header', '');

        let header = document.createElement('button');
        header.type = 'button';
        header.className = headerClass;
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        let chevron = createChevron();
        header.appendChild(chevron);
        header.appendChild(headerContent);

        let body = document.createElement('div');
        body.className = bodyClass;
        body.hidden = !isOpen;

        if (isOpen) {
            section.classList.add('is-open');
        }

        header.addEventListener('click', function () {
            let open = body.hidden;
            body.hidden = !open;
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
            section.classList.toggle('is-open', open);
        });

        section.appendChild(header);
        section.appendChild(body);

        return {
            section: section,
            body: body
        };
    }

    function resolveSeriesImageUrl(imageUrl) {
        if (!imageUrl) {
            return null;
        }

        if (imageUrl.indexOf('http') === 0) {
            return imageUrl;
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.serverAddress) {
            return ApiClient.serverAddress().replace(/\/$/, '') + imageUrl;
        }

        return imageUrl;
    }

    function applySeriesHeaderBackdrop(header, series) {
        if (!series.backdropUrl) {
            return;
        }

        header.classList.add('has-backdrop');

        let backdrop = document.createElement('span');
        backdrop.className = 'bb-pending-series-header-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.style.backgroundImage = 'url("' + resolveSeriesImageUrl(series.backdropUrl) + '")';

        let scrim = document.createElement('span');
        scrim.className = 'bb-pending-series-header-scrim';
        scrim.setAttribute('aria-hidden', 'true');

        header.insertBefore(scrim, header.firstChild);
        header.insertBefore(backdrop, header.firstChild);
    }

    function createSeriesLogo(series, options) {
        options = options || {};
        let wrap = document.createElement('span');
        wrap.className = 'bb-pending-series-logo-wrap';

        if (series.logoUrl) {
            let img = document.createElement('img');
            img.className = 'bb-pending-series-logo';
            img.alt = series.name || '';
            img.loading = 'lazy';
            img.src = resolveSeriesImageUrl(series.logoUrl);
            img.addEventListener('error', function () {
                img.remove();

                if (options.hideTitleFallback) {
                    return;
                }

                let fallback = document.createElement('span');
                fallback.className = 'bb-pending-series-title';
                fallback.textContent = series.name || 'Unknown series';
                wrap.appendChild(fallback);
            });
            wrap.appendChild(img);
            return wrap;
        }

        if (options.hideTitleFallback) {
            return wrap;
        }

        let fallback = document.createElement('span');
        fallback.className = 'bb-pending-series-title';
        fallback.textContent = series.name || 'Unknown series';
        wrap.appendChild(fallback);
        return wrap;
    }

    function createSeriesHeader(series) {
        let header = document.createElement('div');
        header.className = 'bb-pending-series-header';
        let hasBackdrop = !!series.backdropUrl;

        applySeriesHeaderBackdrop(header, series);

        if (hasBackdrop) {
            let title = document.createElement('span');
            title.className = 'bb-pending-series-header-title';
            title.textContent = series.name || 'Unknown series';
            header.appendChild(title);
        }

        header.appendChild(createSeriesLogo(series, {
            hideTitleFallback: hasBackdrop
        }));

        return header;
    }

    function renderSeriesNode(series, options) {
        let section = document.createElement('div');
        section.className = 'bb-pending-series';

        let body = document.createElement('div');
        body.className = 'bb-pending-series-body';

        series.seasons.forEach(function (season) {
            if (!season.episodes || !season.episodes.length) {
                return;
            }

            body.appendChild(renderSeasonNode(season, options));
        });

        section.appendChild(createSeriesHeader(series));
        section.appendChild(body);

        return section;
    }

    function renderSeasonNode(season, options) {
        let label = document.createElement('span');
        label.className = 'bb-pending-season-title';
        label.textContent = formatSeasonLabel(season.seasonIndexNumber);

        let collapsible = createCollapsibleSection(
            'bb-pending-season-header',
            'bb-pending-season-body',
            label,
            true
        );

        let episodeList = document.createElement('div');
        episodeList.className = 'bb-pending-episode-list';

        season.episodes.forEach(function (media) {
            episodeList.appendChild(BingeBuddyMediaSelect.createRow(media, options));
        });

        collapsible.body.appendChild(episodeList);
        return collapsible.section;
    }

    function renderMediaTree(container, mediaItems, options) {
        let scroll = document.createElement('div');
        scroll.className = 'bb-watch-together-pending-scroll';

        let list = document.createElement('div');
        list.className = 'bb-media-select bb-watch-together-pending-tree checkboxListContainer';

        scroll.appendChild(list);
        container.appendChild(scroll);

        let tree = buildMediaTree(mediaItems);
        if (!tree.length) {
            list.appendChild(BingeBuddyMediaSelect.createEmptyState({
                emptyTitle: (options && options.emptyTitle) || DEFAULTS.emptyMediaTitle,
                emptyMessage: (options && options.emptyMessage !== undefined)
                    ? options.emptyMessage
                    : DEFAULTS.emptyMediaMessage
            }));
            return list;
        }

        let rowOptions = {
            selectedMediaIds: options && options.selectedMediaIds,
            isSelected: options && options.isSelected,
            onChange: options && options.onChange
        };

        tree.forEach(function (entry) {
            if (entry.type === 'series') {
                list.appendChild(renderSeriesNode(entry, rowOptions));
                return;
            }

            list.appendChild(BingeBuddyMediaSelect.createRow(entry.media, rowOptions));
        });

        return list;
    }

    function show(options) {
        ensureStyles();

        let merged = Object.assign({}, DEFAULTS, options || {});
        let hostName = merged.hostName || 'your buddy';
        let mediaItems = merged.media || [];
        let mediaListElementRef = { current: null };

        if (!mediaItems.length) {
            return Promise.resolve({
                action: null,
                hostId: merged.hostId,
                hostName: hostName,
                selectedMediaIds: []
            });
        }

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
                requireContinue: merged.requireContinue !== false,
                renderContent: function (container) {
                    mediaListElementRef.current = renderMediaTree(container, mediaItems, {
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
        defaults: DEFAULTS,
        buildMediaTree: buildMediaTree
    };
})();

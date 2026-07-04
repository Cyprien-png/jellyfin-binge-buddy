(function () {
    'use strict';

    if (window.BingeBuddyWatchTogetherQueueService) {
        return;
    }

    let isStarted = false;
    let queueProcessed = false;
    let modulePromise = null;

    function getAssetUrl(path) {
        if (window.BingeBuddyAssets) {
            return BingeBuddyAssets.getUrl(path);
        }

        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl('BingeBuddy/js/' + path);
        }

        return '/BingeBuddy/js/' + path;
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

    function ensureModules() {
        if (modulePromise) {
            return modulePromise;
        }

        modulePromise = loadScriptModule(
            'binge-buddy-watch-together-pending-dialog-script',
            'components/watchTogetherPending/watchTogetherPendingDialog.js',
            function () { return window.BingeBuddyWatchTogetherPendingDialog; }
        ).then(function () {
            BingeBuddyWatchTogetherPendingDialog.ensureStyles();
        });

        return modulePromise;
    }

    function normalizeHostQueue(host) {
        return {
            hostId: host.HostId || host.hostId,
            hostName: host.HostName || host.hostName || 'your buddy',
            media: host.Media || host.media || []
        };
    }

    function loadQueue() {
        return ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('BingeBuddy/WatchTogether/Queue'),
            dataType: 'json'
        }).then(function (response) {
            let hosts = response && (response.Hosts || response.hosts);
            if (!Array.isArray(hosts)) {
                return [];
            }

            return hosts.map(normalizeHostQueue).filter(function (hostQueue) {
                return hostQueue.media && hostQueue.media.length;
            });
        }).catch(function (error) {
            console.warn('[BingeBuddy] Could not load watch together queue.', error);
            return [];
        });
    }

    function acknowledgeHostQueue(hostQueue, dialogResult) {
        if (!dialogResult || dialogResult.action !== 'continue') {
            return Promise.resolve();
        }

        return ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('BingeBuddy/WatchTogether/Queue/Acknowledge'),
            data: JSON.stringify({
                hostId: hostQueue.hostId,
                selectedMediaIds: dialogResult.selectedMediaIds || []
            }),
            contentType: 'application/json'
        }).catch(function (error) {
            console.warn('[BingeBuddy] Failed to acknowledge watch together queue.', error);
        });
    }

    function showHostDialogs(hostQueues) {
        let chain = Promise.resolve();

        hostQueues.forEach(function (hostQueue) {
            if (!hostQueue.media || !hostQueue.media.length) {
                return;
            }

            chain = chain.then(function () {
                return BingeBuddyWatchTogetherPendingDialog.show({
                    hostId: hostQueue.hostId,
                    hostName: hostQueue.hostName,
                    media: hostQueue.media
                }).then(function (dialogResult) {
                    return acknowledgeHostQueue(hostQueue, dialogResult);
                });
            });
        });

        return chain;
    }

    function processQueue() {
        if (queueProcessed) {
            return Promise.resolve();
        }

        if (typeof ApiClient === 'undefined' || !ApiClient.ajax) {
            return Promise.resolve();
        }

        return ensureModules()
            .then(function () {
                return loadQueue();
            })
            .then(function (hostQueues) {
                if (!hostQueues.length) {
                    return;
                }

                queueProcessed = true;
                return showHostDialogs(hostQueues);
            })
            .catch(function (error) {
                console.warn('[BingeBuddy] Watch together queue workflow failed.', error);
            });
    }

    function start() {
        if (isStarted) {
            return;
        }

        isStarted = true;
        processQueue();
    }

    window.BingeBuddyWatchTogetherQueueService = {
        start: start,
        processQueue: processQueue
    };
})();

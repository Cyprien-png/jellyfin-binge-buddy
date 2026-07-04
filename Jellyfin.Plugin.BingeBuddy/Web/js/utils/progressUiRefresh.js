(function () {
    'use strict';

    if (window.BingeBuddyProgressUiRefresh) {
        return;
    }

    function normalizeGuid(value) {
        return (value || '').toString().replace(/-/g, '').toLowerCase();
    }

    function computePlayedPercentage(playbackPositionTicks, runTimeTicks) {
        if (!runTimeTicks || runTimeTicks <= 0) {
            return 0;
        }

        return Math.min(100, Math.round((playbackPositionTicks / runTimeTicks) * 100));
    }

    function fetchUpdatedItems(itemIds) {
        if (!itemIds.length || typeof ApiClient === 'undefined' || !ApiClient.ajax || !ApiClient.getUrl) {
            return Promise.resolve([]);
        }

        let userId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();
        if (!userId) {
            return Promise.resolve([]);
        }

        return ApiClient.ajax({
            type: 'GET',
            url: ApiClient.getUrl('Users/' + userId + '/Items', {
                Ids: itemIds.join(','),
                Fields: 'UserData,RunTimeTicks'
            }),
            dataType: 'json'
        }).then(function (result) {
            return result && (result.Items || result.items) || [];
        }).catch(function (error) {
            console.warn('[BingeBuddy] Could not reload item user data for UI refresh.', error);
            return [];
        });
    }

    function ensureIndicators(card) {
        let indicatorsElem = card.querySelector('.indicators');
        if (!indicatorsElem) {
            indicatorsElem = document.createElement('div');
            indicatorsElem.className = 'indicators';
            let imageContainer = card.querySelector('.cardImageContainer') || card.querySelector('.listItemImage');
            if (imageContainer) {
                imageContainer.appendChild(indicatorsElem);
            } else {
                card.appendChild(indicatorsElem);
            }
        }

        return indicatorsElem;
    }

    function updateCardDom(card, userData) {
        let playedIndicator = card.querySelector('.playedIndicator');

        if (userData.Played) {
            if (!playedIndicator) {
                playedIndicator = document.createElement('div');
                playedIndicator.className = 'playedIndicator indicator';
                ensureIndicators(card).appendChild(playedIndicator);
            }

            playedIndicator.innerHTML = '<span class="material-icons indicatorIcon check" aria-hidden="true"></span>';
        } else if (playedIndicator) {
            playedIndicator.remove();
        }

        let pct = userData.PlayedPercentage;
        let progressSelector = card.classList.contains('listItem') ? '.listItemProgressBar' : '.itemProgressBar';
        let progressBar = card.querySelector(progressSelector);

        if (pct > 0 && pct < 100 && !userData.Played) {
            if (!progressBar) {
                progressBar = document.createElement('div');
                progressBar.className = progressSelector.slice(1);

                let footer = card.querySelector('.innerCardFooter');
                let imageContainer = card.querySelector('.cardImageContainer') || card.querySelector('.listItemImage');

                if (footer) {
                    footer.appendChild(progressBar);
                } else if (imageContainer) {
                    footer = document.createElement('div');
                    footer.className = 'innerCardFooter';
                    imageContainer.appendChild(footer);
                    footer.appendChild(progressBar);
                } else {
                    card.appendChild(progressBar);
                }
            }

            if (userData.PlaybackPositionTicks) {
                card.setAttribute('data-positionticks', userData.PlaybackPositionTicks);
            }

            progressBar.innerHTML = '<div class="itemProgressBarForeground" style="width:' + pct + '%;"></div>';
            return;
        }

        if (progressBar) {
            progressBar.remove();
        }
    }

    function findCardsForItem(itemId) {
        let normalized = normalizeGuid(itemId);
        let cards = [];

        document.querySelectorAll('.card-withuserdata[data-id], .card[data-id], .listItem[data-id]').forEach(function (card) {
            if (normalizeGuid(card.getAttribute('data-id')) === normalized) {
                cards.push(card);
            }
        });

        return cards;
    }

    function buildUserDataPayload(item) {
        let userData = Object.assign({}, item.UserData || item.userData || {});
        let runTimeTicks = Number(item.RunTimeTicks || item.runTimeTicks || 0);

        userData.ItemId = item.Id || item.id;
        userData.PlaybackPositionTicks = Number(userData.PlaybackPositionTicks || userData.playbackPositionTicks || 0);
        userData.Played = !!(userData.Played || userData.played);

        if (userData.PlayedPercentage == null) {
            userData.PlayedPercentage = computePlayedPercentage(userData.PlaybackPositionTicks, runTimeTicks);
        }

        return userData;
    }

    function applyUserDataToDom(item) {
        let userData = buildUserDataPayload(item);

        findCardsForItem(userData.ItemId).forEach(function (card) {
            updateCardDom(card, userData);
        });
    }

    function refreshNativeCards(itemIds) {
        let ids = (itemIds || []).filter(function (id) {
            return !!id;
        });

        if (!ids.length) {
            return Promise.resolve();
        }

        return fetchUpdatedItems(ids).then(function (items) {
            items.forEach(applyUserDataToDom);
        });
    }

    window.BingeBuddyProgressUiRefresh = {
        refreshNativeCards: refreshNativeCards
    };
})();

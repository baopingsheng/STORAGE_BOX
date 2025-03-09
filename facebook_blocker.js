// ==UserScript==
// @name         Facebook Content Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Delete Facebook posts containing specific keywords, sponsored posts, and suggested content from Threads and Instagram.
// @author       baopingsheng
// @match        https://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    // Các từ cần chặn (không phân biệt hoa thường)
        const BLOCKED_WORDS = ['miibeo','negav','embes','kênh 14','kenh14','nêu bật',
                           'hóng biến','theanh28','thế anh 28','beatvn','showbiz','vgt',
                           'schannel','yeah1','yan','f4 vũng tàu','vietgiaitri','saoteen',
                           'mcv group','mcv network','mcvmedia','mcvshow','linh tinh','thịnh sếu','chồng sa lý',
                           'khanh trung sĩ','lân jee','3 phút vui','thầy beo u40','60giay.com',
                           'showbeat','troll bóng đá','hcb','hoàng cửu bảo','huấn hoa hồng','bùi trà',
                           'xiang','hưởng đá','trương nguyên','bùi thu trà','ngân hà','man tv',
                           'lớp người ta','phước lầy','thám tử','phở tái','cháo trắng','vợ chồng son',
                           'bạn đường hợp ý','vua mẹo vn','độc lạ việt nam','mcvnetwork','thvl',
                           'củ đậu story','anh mặt vuông','xương rồng media','man tv',
                           'khẩu nghiệp','svm','troll xe','kiến sĩ','xôn xao','wind music',
                           '3 phút bí ẩn','meow âm nhạc','độc lạ bình dương','anh áo đen',
                           'spx entertainment','chú tùng ham vui','đàm đức review',
                           'thoibao','tuyền văn hóa','top comments','tin nóng','tin hot',
                           'la la school','tiktoker','truyện reddit','sk pictures','entertainment',
                           'phạm thoại','mẹ bé bắp','mẹ bắp','master anh đức','lasvegas','bacarat',
                           'oppa huy idol','phú đầu bò','master','bậc thầy',
                           'biết tuốt','bà tuyết','ciin','ngô đình nam','anhloren','the face vietnam',
                           'phim cực ngắn','vinh gấu','vtv news','baby three','loramen','tizi','đại tiểu thư',
                           'đài truyền tin','multi tv',];
    let isObserving = false;
    let observer = null;

    // Selectors for different types of Facebook content
    const CONTENT_SELECTORS = {
        feedPosts: '[role="feed"] > div, [data-pagelet="FeedUnit"], div[data-testid="fbfeed_story"]',
        groupPosts: '[role="feed"] > div, div[data-pagelet^="GroupsFeed"], div[data-pagelet="GroupFeed"]',
        reels: 'div[data-pagelet="ReelsForYou"], div[data-pagelet="ReelsUnit"], div[data-testid="reels_video_container"]',
        pageContent: 'div[data-pagelet="PageFeed"], div[data-pagelet="PageProfileContentFeed"]',
        comments: 'div[data-testid="UFI2CommentsList"] div[role="article"]',
        stories: 'div[data-pagelet="Stories"], div[role="dialog"] div[aria-label*="story"], div[data-pagelet="StoriesTray"]',
        watchVideos: 'div[data-pagelet="WatchFeed"]',
        marketplace: 'div[data-pagelet="Marketplace"], div[data-pagelet="MarketplaceFeed"]',
        sponsoredPosts: 'div[data-testid="story-subtitle"]:has(span:contains("Sponsored"))',
        suggestedPosts: 'div[data-testid="story-subtitle"]:has(span:contains("Suggested for you"))',
        threadsPosts: 'div[data-testid="story-subtitle"]:has(span:contains("Threads"))',
        instagramPosts: 'div[data-testid="story-subtitle"]:has(span:contains("Instagram"))'
    };

    // Check if text contains any blocked words
    function containsBlockedContent(text) {
        if (!text) return false;

        const lowercaseText = text.toLowerCase();
        return BLOCKED_WORDS.some(word => {
            const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
            return regex.test(lowercaseText);
        });
    }

    // Process a single element to check and remove if necessary
    function processElement(element) {
        if (!element || element.dataset.contentChecked === 'true') return;

        const elementText = element.textContent;

        if (elementText && containsBlockedContent(elementText)) {
            const foundWord = BLOCKED_WORDS.find(word => {
                const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                return regex.test(elementText.toLowerCase());
            });

            console.log(`Removed content containing blocked word: ${foundWord}`);

            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            return;
        }

        element.dataset.contentChecked = 'true';
    }

    // Find and monitor "See more" buttons
    function monitorSeeMoreButtons() {
        const seeMoreCandidates = [
            ...Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"]')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === 'see more' || text === 'xem thêm';
            }),
            ...Array.from(document.querySelectorAll('[aria-expanded="false"]')),
            ...Array.from(document.querySelectorAll('div[data-ad-comet-preview-button], div[data-ad-preview-may-show-truncation]')),
            ...Array.from(document.querySelectorAll('.text_exposed_link')),
            ...Array.from(document.querySelectorAll('span.see_more_link, a.see_more_link')),
            ...Array.from(document.querySelectorAll('span')).filter(el => el.textContent.includes('...')),
        ];

        seeMoreCandidates.forEach(button => {
            if (button.dataset.seeMoreMonitored === 'true') return;

            button.dataset.seeMoreMonitored = 'true';

            button.addEventListener('click', function(e) {
                const clickedButton = this;
                const postContainer = findPostContainer(clickedButton);

                if (postContainer) {
                    [300, 500, 1000].forEach(delay => {
                        setTimeout(() => {
                            const expandedText = postContainer.textContent;

                            if (containsBlockedContent(expandedText)) {
                                const foundWord = BLOCKED_WORDS.find(word => {
                                    const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                                    return regex.test(expandedText.toLowerCase());
                                });

                                console.log(`Removed expanded content containing blocked word: ${foundWord}`);

                                if (postContainer.parentNode) {
                                    postContainer.parentNode.removeChild(postContainer);
                                }
                            }
                        }, delay);
                    });
                }
            }, { capture: true });
        });
    }

    // Find the post container from a child element
    function findPostContainer(element) {
        if (!element) return null;

        let current = element;
        const maxIterations = 15;
        let iterations = 0;

        while (current && iterations < maxIterations) {
            if (current.getAttribute('role') === 'article' ||
                current.classList.contains('userContentWrapper') ||
                current.classList.contains('_5pcr') ||
                current.classList.contains('_1dwg') ||
                current.classList.contains('_4-u2') ||
                current.classList.contains('_4_j4') ||
                (current.dataset && (
                    (current.dataset.pagelet && current.dataset.pagelet.includes('FeedUnit')) ||
                    current.dataset.testid === 'fbfeed_story' ||
                    current.dataset.testid === 'post_container'
                )) ||
                current.getAttribute('data-ft') ||
                current.getAttribute('data-insertion-position') ||
                current.getAttribute('data-ad-preview') ||
                current.getAttribute('aria-label')?.includes('Comment') ||
                current.classList.contains('UFIComment') ||
                current.dataset?.testid === 'UFI2Comment') {
                return current.closest('[role="article"]') || current;
            }

            current = current.parentElement;
            iterations++;
        }

        return element.closest('div[data-pagelet], div[data-ft], div[data-testid]') || element.parentElement;
    }

    // Main function to check and block content
    function checkAndBlockContent() {
        Object.entries(CONTENT_SELECTORS).forEach(([contentType, selector]) => {
            document.querySelectorAll(selector).forEach(element => {
                processElement(element, contentType);
            });
        });

        blockSuggestedContent();
        monitorSeeMoreButtons();
    }

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        document.querySelectorAll('div[data-pagelet="GroupSuggestions"]').forEach(group => {
            if (group.dataset.contentChecked !== 'true') {
                const groupText = group.textContent;
                if (groupText && containsBlockedContent(groupText)) {
                    if (group.parentNode) {
                        group.parentNode.removeChild(group);
                    }
                    return;
                }
                group.dataset.contentChecked = 'true';
            }
        });

        document.querySelectorAll('div[data-pagelet="RightRail"] a[href*="/pages/"]').forEach(page => {
            if (page.dataset.contentChecked !== 'true') {
                const pageText = page.textContent;
                if (pageText && containsBlockedContent(pageText)) {
                    const container = page.closest('div[role="complementary"]');
                    if (container && container.parentNode) {
                        container.parentNode.removeChild(container);
                    } else if (page.parentNode) {
                        page.parentNode.removeChild(page);
                    }
                    return;
                }
                page.dataset.contentChecked = 'true';
            }
        });
    }

    // Additional function to handle expanded text that might appear after clicking "See more"
    function checkExpandedContent() {
        document.querySelectorAll('[aria-expanded="true"]:not([data-expanded-checked="true"])').forEach(container => {
            container.dataset.expandedChecked = 'true';

            const postContainer = findPostContainer(container);
            if (postContainer) {
                const expandedText = postContainer.textContent;

                if (containsBlockedContent(expandedText)) {
                    const foundWord = BLOCKED_WORDS.find(word => {
                        const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                        return regex.test(expandedText.toLowerCase());
                    });

                    console.log(`Removed expanded content containing blocked word: ${foundWord}`);

                    if (postContainer.parentNode) {
                        postContainer.parentNode.removeChild(postContainer);
                    }
                }
            }
        });
    }

    // Create and set up MutationObserver to detect new content
    function setupMutationObserver() {
        if (isObserving) return;

        const targetNode = document.body;
        if (!targetNode) {
            setTimeout(setupMutationObserver, 500);
            return;
        }

        const config = {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['aria-expanded']
        };

        observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            let hasExpandedContent = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                }

                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'aria-expanded' &&
                    mutation.target.getAttribute('aria-expanded') === 'true') {
                    hasExpandedContent = true;
                }
            });

            if (shouldCheck || hasExpandedContent) {
                clearTimeout(window._checkTimeout);
                window._checkTimeout = setTimeout(() => {
                    checkAndBlockContent();

                    if (hasExpandedContent) {
                        checkExpandedContent();
                    }

                    monitorSeeMoreButtons();
                }, 150);
            }
        });

        observer.observe(targetNode, config);
        isObserving = true;
    }

    // Document click handler to catch all clicks that might expand content
    function setupGlobalClickHandler() {
        document.addEventListener('click', function(e) {
            setTimeout(() => {
                checkExpandedContent();
            }, 500);
        }, { passive: true });
    }

    // Handle scrolling to check for dynamically loaded content
    function handleScroll() {
        clearTimeout(window._scrollTimeout);
        window._scrollTimeout = setTimeout(() => {
            checkAndBlockContent();
            monitorSeeMoreButtons();
        }, 200);
    }

    // Detect URL changes for SPA navigation
    function setupURLChangeDetection() {
        let lastUrl = location.href;

        function handleNavigation() {
            if (!isRelevantPage()) return;

            if (observer) {
                observer.disconnect();
                isObserving = false;
            }

            document.querySelectorAll('[data-content-checked="true"]').forEach(el => {
                delete el.dataset.contentChecked;
            });
            document.querySelectorAll('[data-see-more-monitored="true"]').forEach(el => {
                delete el.dataset.seeMoreMonitored;
            });
            document.querySelectorAll('[data-expanded-checked="true"]').forEach(el => {
                delete el.dataset.expandedChecked;
            });

            setTimeout(() => {
                setupMutationObserver();
                checkAndBlockContent();
            }, 1000);
        }

        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                handleNavigation();
            }
        });

        urlObserver.observe(document, {subtree: true, childList: true});

        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        };

        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        });
    }

    // Recheck content periodically to catch items missed by observers
    function setupPeriodicCheck() {
        setInterval(() => {
            if (isRelevantPage()) {
                checkAndBlockContent();
                checkExpandedContent();
                monitorSeeMoreButtons();
            }
        }, 3000);
    }

    // Check if current page is Facebook
    function isRelevantPage() {
        const url = window.location.href;
        return url.includes('facebook.com') || url.includes('fb.com');
    }

    // Initialize everything
    function initialize() {
        if (!isRelevantPage()) return;

        setupMutationObserver();
        setupURLChangeDetection();
        setupGlobalClickHandler();
        window.addEventListener('scroll', handleScroll, {passive: true});
        checkAndBlockContent();
        setupPeriodicCheck();

        console.log('Enhanced Facebook content blocker initialized - DELETE VERSION. Blocking content containing:', BLOCKED_WORDS);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

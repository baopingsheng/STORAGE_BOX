// ==UserScript==
// @name         Facebook Content Blocker (Clean Feed)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Delete Facebook posts containing specific keywords, sponsored posts, and suggested content from Threads/Instagram.
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
                           'lớp người ta','phước lầy','việt tân','thám tử','phở tái','cháo trắng','vợ chồng son',
                           'bạn đường hợp ý','vua mẹo vn','độc lạ việt nam','mcvnetwork','thvl',
                           'củ đậu story','anh mặt vuông','xương rồng media','man tv',
                           'khẩu nghiệp','svm','troll xe','kiến sĩ','xôn xao','wind music',
                           '3 phút bí ẩn','meow âm nhạc','độc lạ bình dương','anh áo đen',
                           'spx entertainment','chú tùng ham vui','đàm đức review',
                           'thoibao','tuyền văn hóa','top comments','tin nóng','tin hot',
                           'la la school','tiktoker','truyện reddit','sk pictures','entertainment',
                           'phạm thoại','mẹ bé bắp','mẹ bắp','master anh đức','lasvegas','bacarat',
                           'oppa huy idol','phú đầu bò','master','bậc thầy','khu phố bất ổn',
                           'biết tuốt','bà tuyết','ciin','ngô đình nam','anhloren','the face vietnam',
                           'phim cực ngắn','vinh gấu','vtc news','baby three','loramen','tizi','đại tiểu thư',
                           'đài truyền tin','multi tv','chê phim','review phim','báo mới',
                           'blogphunu','viepaparazzi',];

    // Track processed elements to avoid re-processing
    let processedElements = new WeakSet();
    let processedFeedItems = new WeakSet();
    let isObserving = false;
    let observer = null;
    let feedInitialized = false;
    let feedContainer = null;
    let initialFeedLoaded = false;
    let feedStabilizationAttempts = 0;

    // Selectors for different types of Facebook content
    const CONTENT_SELECTORS = {
        // Main feed selectors
        feedRootContainer: '[role="feed"]',
        feedPosts: '[role="feed"] > div, [data-pagelet="FeedUnit"], div[data-testid="fbfeed_story"]',

        // Other content selectors
        groupPosts: 'div[data-pagelet^="GroupsFeed"], div[data-pagelet="GroupFeed"]',
        reels: 'div[data-pagelet="ReelsForYou"], div[data-pagelet="ReelsUnit"], div[data-testid="reels_video_container"]',
        pageContent: 'div[data-pagelet="PageFeed"], div[data-pagelet="PageProfileContentFeed"]',
        comments: 'div[data-testid="UFI2CommentsList"] div[role="article"]',
        stories: 'div[data-pagelet="Stories"], div[role="dialog"] div[aria-label*="story"], div[data-pagelet="StoriesTray"]',
        watchVideos: 'div[data-pagelet="WatchFeed"]',
        marketplace: 'div[data-pagelet="Marketplace"], div[data-pagelet="MarketplaceFeed"]'
    };

    // Debug logging
    const DEBUG = false;
    function log(...args) {
        if (DEBUG) {
            console.log('[FB Blocker]', ...args);
        }
    }

    // Check if text contains any blocked words
    function containsBlockedContent(text) {
        if (!text) return false;

        const lowercaseText = text.toLowerCase();
        return BLOCKED_WORDS.some(word => {
            const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
            return regex.test(lowercaseText);
        });
    }

    // Find the blocked word that triggered the removal
    function findBlockedWord(text) {
        if (!text) return null;

        const lowercaseText = text.toLowerCase();
        return BLOCKED_WORDS.find(word => {
            const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
            return regex.test(lowercaseText);
        });
    }

    // Create a placeholder element that maintains feed structure
    function createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.style.height = '1px';
        placeholder.style.margin = '0';
        placeholder.style.padding = '0';
        placeholder.style.overflow = 'hidden';
        placeholder.style.opacity = '0';
        placeholder.setAttribute('data-blocked-content', 'true');
        return placeholder;
    }

    // Safe element removal that preserves feed structure
    function safeRemoveElement(element) {
        if (!element || !element.parentNode) return;

        // First check if element is a direct feed child
        const isFeedChild = feedContainer && feedContainer.contains(element) &&
                           element.parentNode === feedContainer;

        if (isFeedChild) {
            // Critical feed element - replace with invisible placeholder
            const placeholder = createPlaceholder();
            try {
                element.parentNode.replaceChild(placeholder, element);
                log('Replaced feed element with placeholder');
            } catch (e) {
                log('Error replacing feed element:', e);
            }
        } else {
            // Non-critical element - can be removed safely
            try {
                element.parentNode.removeChild(element);
                log('Removed non-feed element');
            } catch (e) {
                log('Error removing element:', e);
            }
        }
    }

    // Process a single element to check and remove if necessary
    function processElement(element) {
        if (!element || processedElements.has(element)) return;

        // Mark as processed to avoid re-processing
        processedElements.add(element);

        const elementText = element.textContent;
        if (!elementText || !containsBlockedContent(elementText)) return;

        const foundWord = findBlockedWord(elementText);
        log(`Removing content containing blocked word: ${foundWord}`);

        // Don't remove the element immediately - use the safe remove function
        safeRemoveElement(element);
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
            if (processedElements.has(button)) return;

            processedElements.add(button);

            button.addEventListener('click', function(e) {
                const clickedButton = this;
                const postContainer = findPostContainer(clickedButton);

                if (postContainer) {
                    [300, 500, 1000].forEach(delay => {
                        setTimeout(() => {
                            const expandedText = postContainer.textContent;
                            if (!expandedText || !containsBlockedContent(expandedText)) return;

                            const foundWord = findBlockedWord(expandedText);
                            log(`Removing expanded content containing blocked word: ${foundWord}`);

                            // Use safe removal
                            safeRemoveElement(postContainer);
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

    // Process feed posts without removing the feed itself
    function processFeedItems() {
        // First, find and update the feedContainer reference
        feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
        if (!feedContainer) return;

        // CRITICAL: Never process the feed container itself - only its children
        if (!feedInitialized) {
            feedInitialized = true;
            log('Feed initialized, found container:', feedContainer);
        }

        // Process only direct children of the feed container to avoid removing the feed itself
        Array.from(feedContainer.children).forEach(feedItem => {
            if (processedFeedItems.has(feedItem)) return;

            // Mark as processed to avoid re-processing
            processedFeedItems.add(feedItem);

            const itemText = feedItem.textContent;
            if (!itemText || !containsBlockedContent(itemText)) return;

            const foundWord = findBlockedWord(itemText);
            log(`Found blocked word "${foundWord}" in feed item, replacing with placeholder`);

            // For feed items, always use placeholder replacement
            const placeholder = createPlaceholder();
            try {
                feedContainer.replaceChild(placeholder, feedItem);
            } catch (e) {
                log('Error replacing feed item:', e);
            }
        });
    }

    // Process other content (non-feed items)
    function processOtherContent() {
        Object.entries(CONTENT_SELECTORS).forEach(([type, selector]) => {
            // Skip the feed container itself
            if (type === 'feedRootContainer') return;

            document.querySelectorAll(selector).forEach(element => {
                processElement(element);
            });
        });
    }

    // Main function to check and block content
    function checkAndBlockContent() {
        // Process feed items separately from other content
        processFeedItems();
        processOtherContent();
        blockSuggestedContent();
        monitorSeeMoreButtons();
    }

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        document.querySelectorAll('div[data-pagelet="GroupSuggestions"], div[data-pagelet="GroupSuggestion"]').forEach(group => {
            if (processedElements.has(group)) return;

            processedElements.add(group);

            const groupText = group.textContent;
            if (groupText && containsBlockedContent(groupText)) {
                const foundWord = findBlockedWord(groupText);
                log(`Removing suggested group containing blocked word: ${foundWord}`);

                // Suggestions are not part of the main feed, can remove safely
                if (group.parentNode) {
                    group.parentNode.removeChild(group);
                }
            }
        });

        document.querySelectorAll('div[data-pagelet="RightRail"] a[href*="/pages/"]').forEach(page => {
            if (processedElements.has(page)) return;

            processedElements.add(page);

            const pageText = page.textContent;
            if (pageText && containsBlockedContent(pageText)) {
                const foundWord = findBlockedWord(pageText);
                log(`Removing suggested page containing blocked word: ${foundWord}`);

                // Right rail content is also safe to remove
                const container = page.closest('div[role="complementary"]');
                if (container && container.parentNode) {
                    container.parentNode.removeChild(container);
                } else if (page.parentNode) {
                    page.parentNode.removeChild(page);
                }
            }
        });
    }

    // Additional function to handle expanded text that might appear after clicking "See more"
    function checkExpandedContent() {
        document.querySelectorAll('[aria-expanded="true"]').forEach(container => {
            if (processedElements.has(container)) return;

            processedElements.add(container);

            const postContainer = findPostContainer(container);
            if (!postContainer) return;

            const expandedText = postContainer.textContent;
            if (!expandedText || !containsBlockedContent(expandedText)) return;

            const foundWord = findBlockedWord(expandedText);
            log(`Removing expanded content containing blocked word: ${foundWord}`);

            // Use safe removal
            safeRemoveElement(postContainer);
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
            let feedChanged = false;

            // Update feed container reference if needed
            const currentFeedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
            if (currentFeedContainer !== feedContainer) {
                feedContainer = currentFeedContainer;
                feedChanged = true;
                log('Feed container reference updated');
            }

            mutations.forEach(mutation => {
                // Special handling for feed container changes
                if (feedContainer && (mutation.target === feedContainer ||
                    feedContainer.contains(mutation.target))) {
                    feedChanged = true;
                }

                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                }

                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'aria-expanded' &&
                    mutation.target.getAttribute('aria-expanded') === 'true') {
                    hasExpandedContent = true;
                }
            });

            if (shouldCheck || hasExpandedContent || feedChanged) {
                clearTimeout(window._checkTimeout);
                window._checkTimeout = setTimeout(() => {
                    // If feed changed, process feed items first
                    if (feedChanged) {
                        processFeedItems();
                    }

                    if (shouldCheck) {
                        checkAndBlockContent();
                    }

                    if (hasExpandedContent) {
                        checkExpandedContent();
                    }

                    monitorSeeMoreButtons();
                }, 150);
            }
        });

        observer.observe(targetNode, config);
        isObserving = true;
        log('Mutation observer set up');
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

    // Reset tracking data for when page changes
    function resetTracking() {
        processedElements = new WeakSet();
        processedFeedItems = new WeakSet();
        feedInitialized = false;
        initialFeedLoaded = false;
        feedStabilizationAttempts = 0;
        log('Reset tracking data');
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

            // Reset processed elements tracking
            resetTracking();

            setTimeout(() => {
                setupMutationObserver();
                waitForFeed();
            }, 1000);
        }

        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                log('URL changed to:', url);
                handleNavigation();
            }
        });

        urlObserver.observe(document, {subtree: true, childList: true});

        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            if (location.href !== lastUrl) {
                lastUrl = location.href;
                log('pushState URL changed to:', lastUrl);
                handleNavigation();
            }
        };

        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                log('popstate URL changed to:', lastUrl);
                handleNavigation();
            }
        });
    }

    // Function to wait for feed to be available and stable
    function waitForFeed() {
        // Look for the feed container
        feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);

        if (!feedContainer) {
            // Feed not found yet, retry after a delay
            log('Feed not found yet, retrying...');
            setTimeout(waitForFeed, 500);
            return;
        }

        log('Feed found, monitoring for stability...');
        waitForFeedStabilization();
    }

    // Wait for feed to stabilize before processing
    function waitForFeedStabilization() {
        let lastChildCount = -1;
        let stableCount = 0;

        function checkStability() {
            feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);

            if (!feedContainer) {
                log('Feed container disappeared, restarting wait process');
                setTimeout(waitForFeed, 500);
                return;
            }

            const currentChildCount = feedContainer.children.length;
            log(`Feed has ${currentChildCount} items, previous count: ${lastChildCount}`);

            // Check if content count is stable
            if (currentChildCount === lastChildCount && currentChildCount > 0) {
                stableCount++;
                log(`Feed stable for ${stableCount} checks`);

                if (stableCount >= 2) {
                    log('Feed appears stable, beginning content processing');
                    initialFeedLoaded = true;
                    checkAndBlockContent();
                    return;
                }
            } else {
                stableCount = 0;
                lastChildCount = currentChildCount;
            }

            // Safety check - give up waiting after too many attempts
            feedStabilizationAttempts++;
            if (feedStabilizationAttempts > 20) {
                log('Giving up on feed stabilization, processing anyway');
                initialFeedLoaded = true;
                checkAndBlockContent();
                return;
            }

            setTimeout(checkStability, 500);
        }

        checkStability();
    }

    // Recheck content periodically to catch items missed by observers
    function setupPeriodicCheck() {
        setInterval(() => {
            if (isRelevantPage() && initialFeedLoaded) {
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

        log('Initializing Facebook Content Blocker v1.2');

        // Set up event listeners and observers
        setupURLChangeDetection();
        setupGlobalClickHandler();
        window.addEventListener('scroll', handleScroll, {passive: true});

        // Delay setup to ensure Facebook has loaded
        setTimeout(() => {
            setupMutationObserver();
            waitForFeed();
            setupPeriodicCheck();
        }, 2000);

        console.log('Facebook content blocker initialized v1.2. Using enhanced feed preservation.');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

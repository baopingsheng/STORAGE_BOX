// ==UserScript==
// @name          Clean Feed (Facebook Content Blocker)
// @namespace     http://tampermonkey.net/
// @version       1.0
// @description   Delete Facebook posts containing specific keywords, sponsored posts, and suggested content from Threads/Instagram.
// @author        baopingsheng
// @match         https://*.facebook.com/*
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    // Các từ khóa, trang và nhóm cần chặn (không phân biệt chữ hoa chữ thường)
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
                           'đài truyền tin','multi tv','chê phim','review phim','báo mới','thánh cmnnr','chê phim',
                           'review phim','phim review','saostar', 'vnexpress',];

    // Track processed elements to avoid re-processing
    let processedElements = new WeakSet();
    let hiddenElements = new Map(); // Store hidden elements and their replacement placeholders
    let isObserving = false;
    let observer = null;
    let lastCheckTime = 0;
    let processingInProgress = false;

    // Debug mode
    const DEBUG = false;

    function debugLog(...args) {
        if (DEBUG) {
            console.log('[FB Blocker]', ...args);
        }
    }

    // Selectors for different types of Facebook content
    const CONTENT_SELECTORS = {
        // Main feed selectors (more specific to avoid critical elements)
        feedRootContainer: '[role="feed"]',
        feedPosts: '[role="feed"] > div',

        // Post containers that are safe to process
        postContainers: 'div[role="article"], div[data-pagelet^="FeedUnit_"], div[data-testid="fbfeed_story"]',

        // Other content selectors
        groupPosts: 'div[data-pagelet^="GroupsFeed"], div[data-pagelet="GroupFeed"]',
        reels: 'div[data-pagelet="ReelsForYou"], div[data-pagelet="ReelsUnit"]',
        pageContent: 'div[data-pagelet="PageFeed"], div[data-pagelet="PageProfileContentFeed"]',
        comments: 'div[data-testid="UFI2CommentsList"] div[role="article"]',
        stories: 'div[data-pagelet="Stories"]',
        watchVideos: 'div[data-pagelet="WatchFeed"]',
        marketplace: 'div[data-pagelet="Marketplace"], div[data-pagelet="MarketplaceFeed"]'
    };

    // Check if text contains any blocked words, including page or group content
    function containsBlockedContent(text) {
        if (!text) return false;

        const lowercaseText = text.toLowerCase();

        // Check for any blocked words
        const hasBlockedWord = BLOCKED_WORDS.some(word => {
            const regex = new RegExp(`\\b${word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b|${word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
            return regex.test(lowercaseText);
        });

        if (hasBlockedWord) return true;

        // Additional check for page/group context
        // This is needed because we may want to block a page even if the word is part of another context
        const hasPageAttributedContent = BLOCKED_WORDS.some(word => {
            return lowercaseText.includes(`${word.toLowerCase()}`) &&
                  (lowercaseText.includes("shared") ||
                   lowercaseText.includes("posted") ||
                   lowercaseText.includes("page") ||
                   lowercaseText.includes("chia sẻ") ||
                   lowercaseText.includes("đăng"));
        });

        if (hasPageAttributedContent) return true;

        // Check for group attribution in content
        const hasGroupAttributedContent = BLOCKED_WORDS.some(word => {
            return lowercaseText.includes(`${word.toLowerCase()}`) &&
                  (lowercaseText.includes("group") ||
                   lowercaseText.includes("nhóm"));
        });

        return hasGroupAttributedContent;
    }

    // Find the blocked word that triggered the removal
    function findBlockedContent(text) {
        if (!text) return null;

        const lowercaseText = text.toLowerCase();

        // First check direct word matches
        const blockedWord = BLOCKED_WORDS.find(word => {
            const regex = new RegExp(`\\b${word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b|${word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
            return regex.test(lowercaseText);
        });

        if (blockedWord) return `word: ${blockedWord}`;

        // Check for page-attributed content
        const blockedPage = BLOCKED_WORDS.find(word => {
            return lowercaseText.includes(`${word.toLowerCase()}`) &&
                  (lowercaseText.includes("shared") ||
                   lowercaseText.includes("posted") ||
                   lowercaseText.includes("page") ||
                   lowercaseText.includes("chia sẻ") ||
                   lowercaseText.includes("đăng"));
        });

        if (blockedPage) return `page: ${blockedPage}`;

        // Check for group-attributed content
        const blockedGroup = BLOCKED_WORDS.find(word => {
            return lowercaseText.includes(`${word.toLowerCase()}`) &&
                  (lowercaseText.includes("group") ||
                   lowercaseText.includes("nhóm"));
        });

        if (blockedGroup) return `group: ${blockedGroup}`;

        return null;
    }

    // Create a placeholder element that maintains feed structure
    function createPlaceholder(originalHeight) {
        const placeholder = document.createElement('div');
        placeholder.style.display = 'none';
        placeholder.className = 'fb-blocker-placeholder';
        placeholder.setAttribute('data-blocked-content', 'true');
        return placeholder;
    }

    // Measure the element height before hiding
    function getElementHeight(element) {
        if (!element) return 0;

        const rect = element.getBoundingClientRect();
        return rect.height || 0;
    }

    // Hide element instead of removing to maintain feed structure
    function hideElement(element, reason = '') {
        if (!element || !element.parentNode) return null;

        // Get height before hiding
        const elementHeight = Math.max(getElementHeight(element), 50);

        // Create placeholder with appropriate height
        const placeholder = createPlaceholder(elementHeight);

        // Save original element for possible restoration
        hiddenElements.set(placeholder, element);

        // Replace with placeholder
        element.parentNode.replaceChild(placeholder, element);

        debugLog(`Hidden content (${reason})`, element);

        return placeholder;
    }

    // Process a single post element to check and hide if necessary
    function processPostElement(element) {
        if (!element || processedElements.has(element) || element.classList?.contains('fb-blocker-placeholder')) return;

        // Skip processing if element is not visible or has zero size
        if (element.offsetHeight === 0 && element.offsetWidth === 0) {
            processedElements.add(element);
            return;
        }

        // Mark as processed to avoid re-processing
        processedElements.add(element);

        // Check if it's a post container
        const isPostContainer = element.getAttribute('role') === 'article' ||
                                element.dataset?.pagelet?.startsWith('FeedUnit_') ||
                                element.dataset?.testid === 'fbfeed_story';

        if (!isPostContainer) return;

        const elementText = element.textContent;
        if (!elementText || !containsBlockedContent(elementText)) return;

        const blockedContent = findBlockedContent(elementText);
        debugLog(`Found blocked content: ${blockedContent}`);

        // Always use hide instead of remove to maintain feed structure
        hideElement(element, blockedContent);
    }

    // Find and process "See more" buttons
    function processSeeMoreButtons() {
        const seeMoreCandidates = [
            ...Array.from(document.querySelectorAll('div[role="button"]')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === 'see more' || text === 'xem thêm';
            }),
            ...Array.from(document.querySelectorAll('span[role="button"]')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === 'see more' || text === 'xem thêm';
            })
        ];

        seeMoreCandidates.forEach(button => {
            if (processedElements.has(button)) return;
            processedElements.add(button);

            button.addEventListener('click', function(e) {
                const postContainer = findPostContainer(this);
                if (!postContainer) return;

                [500, 1000, 1500].forEach(delay => {
                    setTimeout(() => {
                        if (!postContainer.isConnected) return;

                        const expandedText = postContainer.textContent;
                        if (!expandedText || !containsBlockedContent(expandedText)) return;

                        const blockedContent = findBlockedContent(expandedText);
                        debugLog(`Removing expanded content containing: ${blockedContent}`);

                        hideElement(postContainer, blockedContent);
                    }, delay);
                });
            }, { capture: true });
        });
    }

    // Find the post container from a child element
    function findPostContainer(element) {
        if (!element) return null;

        // Try to find the article container
        const article = element.closest('[role="article"]');
        if (article) return article;

        // Try to find other container types
        return element.closest('div[data-pagelet^="FeedUnit_"], div[data-testid="fbfeed_story"]');
    }

    // Main function to check and block content
    function checkAndBlockContent() {
        if (processingInProgress) return;
        processingInProgress = true;

        try {
            // First process post containers (most important for blocking)
            document.querySelectorAll(CONTENT_SELECTORS.postContainers).forEach(post => {
                processPostElement(post);
            });

            // Process other content
            processSeeMoreButtons();
            processExpandedContent();
            processPageAndGroupContent();
        } catch (e) {
            debugLog('Error in content processing:', e);
        } finally {
            processingInProgress = false;
        }
    }

    // Process expanded content (after clicking "See more")
    function processExpandedContent() {
        document.querySelectorAll('[aria-expanded="true"]').forEach(expandedElement => {
            const postContainer = findPostContainer(expandedElement);
            if (!postContainer || processedElements.has(postContainer)) return;

            const expandedText = postContainer.textContent;
            if (!expandedText || !containsBlockedContent(expandedText)) return;

            const blockedContent = findBlockedContent(expandedText);
            debugLog(`Removing expanded content containing: ${blockedContent}`);

            hideElement(postContainer, blockedContent);
        });
    }

    // Process content from pages and groups based on BLOCKED_WORDS
    function processPageAndGroupContent() {
        // Process page content
        document.querySelectorAll('a[href*="/pages/"]').forEach(pageLink => {
            const postContainer = findPostContainer(pageLink);
            if (!postContainer || processedElements.has(postContainer)) return;

            const pageName = pageLink.textContent.toLowerCase();

            for (const word of BLOCKED_WORDS) {
                if (pageName.includes(word.toLowerCase())) {
                    debugLog(`Removing content from page containing: ${word}`);
                    hideElement(postContainer, `page: ${word}`);
                    break;
                }
            }
        });

        // Process group content
        document.querySelectorAll('a[href*="/groups/"]').forEach(groupLink => {
            const postContainer = findPostContainer(groupLink);
            if (!postContainer || processedElements.has(postContainer)) return;

            const groupName = groupLink.textContent.toLowerCase();

            for (const word of BLOCKED_WORDS) {
                if (groupName.includes(word.toLowerCase())) {
                    debugLog(`Removing content from group containing: ${word}`);
                    hideElement(postContainer, `group: ${word}`);
                    break;
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
            characterData: false,
            attributes: false
        };

        observer = new MutationObserver((mutations) => {
            // Don't process too frequently to avoid performance issues
            const now = Date.now();
            if (now - lastCheckTime < 200) return;
            lastCheckTime = now;

            let shouldCheck = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Quick check if any added nodes could be posts
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            shouldCheck = true;
                            break;
                        }
                    }
                    if (shouldCheck) break;
                }
            }

            if (shouldCheck) {
                clearTimeout(window._checkTimeout);
                window._checkTimeout = setTimeout(() => {
                    checkAndBlockContent();
                }, 200);
            }
        });

        observer.observe(targetNode, config);
        isObserving = true;
        debugLog('Mutation observer started');
    }

    // Handle scrolling to check for dynamically loaded content
    function handleScroll() {
        clearTimeout(window._scrollTimeout);
        window._scrollTimeout = setTimeout(() => {
            checkAndBlockContent();
        }, 300);
    }

    // Reset tracking data when page changes
    function resetTracking() {
        debugLog('Resetting tracking data');
        processedElements = new WeakSet();
        hiddenElements = new Map();
    }

    // Detect URL changes for SPA navigation
    function setupURLChangeDetection() {
        let lastUrl = location.href;

        function handleNavigation() {
            if (!isRelevantPage()) return;

            debugLog('URL changed, reinitializing...');

            if (observer) {
                observer.disconnect();
                isObserving = false;
            }

            // Reset processed elements tracking
            resetTracking();

            // Delay to allow new page content to load
            setTimeout(() => {
                setupMutationObserver();
                checkAndBlockContent();
            }, 500);
        }

        // Watch for DOM changes indicating navigation
        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                handleNavigation();
            }
        });

        urlObserver.observe(document, {subtree: true, childList: true});

        // Watch for history API usage
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        };

        // Watch for back/forward navigation
        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        });
    }

    // Additional handler for modal closing (e.g., after viewing images)
    function setupModalDetection() {
        // Detect both modal opening and closing
        document.addEventListener('click', function(e) {
            // Delay check for modal changes to complete
            setTimeout(() => {
                // Check if we're back at the feed
                if (document.querySelector(CONTENT_SELECTORS.feedRootContainer)) {
                    checkAndBlockContent();
                }
            }, 500);
        }, { capture: true, passive: true });
    }

    // Recheck content periodically to catch items missed by observers
    function setupPeriodicCheck() {
        setInterval(() => {
            if (isRelevantPage() && !processingInProgress) {
                checkAndBlockContent();
            }
        }, 1000);
    }

    // Check if current page is Facebook
    function isRelevantPage() {
        const url = window.location.href;
        return url.includes('facebook.com') || url.includes('fb.com');
    }

    // Initialize everything
    function initialize() {
        if (!isRelevantPage()) return;

        debugLog('Initializing Facebook content blocker');
        setupMutationObserver();
        setupURLChangeDetection();
        setupModalDetection();
        window.addEventListener('scroll', handleScroll, {passive: true});
        checkAndBlockContent();
        setupPeriodicCheck();

        console.log('Clean Feed (Facebook Content Blocker) v1.1 initialized. Blocking keywords, pages, and groups with feed structure preservation.');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

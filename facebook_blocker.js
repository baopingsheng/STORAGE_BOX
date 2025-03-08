// ==UserScript==
// @name         Facebook Content Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Chặn post Facebook có chứa các từ cụ thể
// @author       baopingsheng
// @match        https://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
   // Words to block (lowercase for case-insensitive matching)
    const BLOCKED_WORDS = ['negav','embes','kênh 14','kenh14','việt tân','bbc','nêu bật',
                           'anti','hóng biến','theanh28','thế anh 28','beatvn','showbiz',
                           'Schannel','yeah1','yan','f4 vũng tàu','vietgiaitri','saoteen',
                           'vgt','mcvmedia','mcvshow','linh tinh','thịnh sếu','chồng sa lý',
                           'khanh trung sĩ','lân jee','3 phút vui','thầy beo u40','60giay.com',
                           'showbeat','troll bóng đá','hoàng cửu bảo','huấn hoa hồng','bùi trà',
                           'xiang','hưởng đá','trương nguyên','bùi thu trà','ngân hà','man tv',
                           'lớp người ta','phước lầy','thám tử','phở tái','cháo trắng',
                           'củ đậu story','anh mặt vuông','xương rồng media','man tv',
                           'khẩu nghiệp','svm','troll xe','kiến sĩ','xôn xao','wind music',
                           '3 phút bí ẩn','meow âm nhạc','độc lạ bình dương','anh áo đen',
                           'spx entertainment','chú tùng ham vui','đàm đức review',
                           'thoibao','tuyền văn hóa','top comments','tin nóng','tin hot',
                           'la la school','tiktoker','truyện reddit','sk pictures','entertainment',];
    let isObserving = false;
    let observer = null;

    // Selectors for different types of Facebook content
    const CONTENT_SELECTORS = {
        // Feed posts (newsfeed)
        feedPosts: '[role="feed"] > div, [data-pagelet="FeedUnit"], div[data-testid="fbfeed_story"]',
        // Group posts
        groupPosts: '[role="feed"] > div, div[data-pagelet^="GroupsFeed"], div[data-pagelet="GroupFeed"]',
        // Reels
        reels: 'div[data-pagelet="ReelsForYou"], div[data-pagelet="ReelsUnit"], div[data-testid="reels_video_container"]',
        // Page content
        pageContent: 'div[data-pagelet="PageFeed"], div[data-pagelet="PageProfileContentFeed"]',
        // Comments (might contain blocked content)
        comments: 'div[data-testid="UFI2CommentsList"] div[role="article"]',
        // Stories
        stories: 'div[data-pagelet="Stories"], div[role="dialog"] div[aria-label*="story"], div[data-pagelet="StoriesTray"]',
        // Watch videos
        watchVideos: 'div[data-pagelet="WatchFeed"]',
        // Marketplace listings
        marketplace: 'div[data-pagelet="Marketplace"], div[data-pagelet="MarketplaceFeed"]'
    };

    // Add custom CSS to hide blocked content
    function addCustomStyles() {
        const style = document.createElement('style');
        style.id = 'facebook-content-blocker-styles';
        style.textContent = `
.fb-content-blocked{display:none!important}
.fb-content-placeholder{border-radius:8px;background-color:#f0f2f5;padding:12px;margin:8px 0;font-family:Helvetica,Arial,sans-serif;color:#65676b;font-size:14px;text-align:center}
        `;
        document.head.appendChild(style);
    }

    // Check if text contains any blocked words (improved matching)
    function containsBlockedContent(text) {
        if (!text) return false;

        const lowercaseText = text.toLowerCase();
        for (const word of BLOCKED_WORDS) {
            // Use word boundary check to prevent partial word matches
            const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
            if (regex.test(lowercaseText)) {
                return true;
            }
        }
        return false;
    }

    // Create a placeholder element to replace blocked content
    function createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'fb-content-placeholder';
        placeholder.textContent = 'Content filtered (contains blocked keyword)';
        return placeholder;
    }

    // Process a single element to check and block if necessary
    function processElement(element, contentType) {
        // Skip already processed elements
        if (element.dataset.contentChecked === 'true') {
            return;
        }

        // Get text content of the element
        const elementText = element.textContent;

        // Only block if content actually contains blocked words
        if (elementText && containsBlockedContent(elementText)) {
            // Add class to hide the element
            element.classList.add('fb-content-blocked');

            // Debug info
            const foundWord = BLOCKED_WORDS.find(word => {
                const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                return regex.test(elementText.toLowerCase());
            });

            element.dataset.blockedReason = 'Contains blocked word: ' + foundWord;

            // For reels and stories, we might want to show a placeholder instead
            if (contentType === 'reels' || contentType === 'stories') {
                const parent = element.parentNode;
                if (parent) {
                    const placeholder = createPlaceholder();
                    parent.insertBefore(placeholder, element.nextSibling);
                }
            }
        }

        // Mark as processed
        element.dataset.contentChecked = 'true';
    }

    // Main function to check and block content
    function checkAndBlockContent() {
        // Process each type of content
        for (const [contentType, selector] of Object.entries(CONTENT_SELECTORS)) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                processElement(element, contentType);
            });
        }

        // Special handling for suggested groups/pages sections
        blockSuggestedContent();
    }

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        // Suggested groups
        const suggestedGroups = document.querySelectorAll('div[data-pagelet="GroupSuggestions"]');
        suggestedGroups.forEach(group => {
            if (group.dataset.contentChecked !== 'true') {
                const groupText = group.textContent;
                if (groupText && containsBlockedContent(groupText)) {
                    group.classList.add('fb-content-blocked');
                }
                group.dataset.contentChecked = 'true';
            }
        });

        // Suggested pages
        const suggestedPages = document.querySelectorAll('div[data-pagelet="RightRail"] a[href*="/pages/"]');
        suggestedPages.forEach(page => {
            if (page.dataset.contentChecked !== 'true') {
                const pageText = page.textContent;
                if (pageText && containsBlockedContent(pageText)) {
                    const container = page.closest('div[role="complementary"]');
                    if (container) {
                        container.classList.add('fb-content-blocked');
                    } else {
                        page.classList.add('fb-content-blocked');
                    }
                }
                page.dataset.contentChecked = 'true';
            }
        });
    }

    // Create and set up MutationObserver to detect new content
    function setupMutationObserver() {
        if (isObserving) {
            return; // Observer already running
        }

        // Target the document body for broader coverage
        const targetNode = document.body;

        if (!targetNode) {
            // If body not found (unlikely), retry after a delay
            setTimeout(setupMutationObserver, 500);
            return;
        }

        // Create observer configuration
        const config = {
            childList: true,
            subtree: true,
            characterData: true
        };

        // Create observer instance
        observer = new MutationObserver((mutations) => {
            let shouldCheck = false;

            for (let mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // Look for significant DOM changes that might indicate new content
                    if (mutation.addedNodes.length > 0) {
                        for (let node of mutation.addedNodes) {
                            if (node.nodeType === 1) { // Element node
                                shouldCheck = true;
                                break;
                            }
                        }
                    }

                    if (shouldCheck) break;
                }
            }

            if (shouldCheck) {
                // Delay slightly to allow Facebook to finish rendering
                clearTimeout(window._checkTimeout);
                window._checkTimeout = setTimeout(checkAndBlockContent, 100);
            }
        });

        // Start observing
        observer.observe(targetNode, config);
        isObserving = true;
    }

    // Handle scrolling to check for dynamically loaded content
    function handleScroll() {
        // Debounce scroll event to improve performance
        clearTimeout(window._scrollTimeout);
        window._scrollTimeout = setTimeout(() => {
            checkAndBlockContent();
        }, 100);
    }

    // Detect URL changes for SPA navigation
    function setupURLChangeDetection() {
        let lastUrl = location.href;

        // Check if we're in a relevant Facebook page
        function isRelevantPage() {
            const url = window.location.href;
            return url.includes('facebook.com') || url.includes('fb.com');
        }

        // Handle page navigation
        function handleNavigation() {
            // Only proceed if we're on Facebook
            if (!isRelevantPage()) return;

            // Reset observer
            if (observer) {
                observer.disconnect();
                isObserving = false;
            }

            // Clear any previously marked elements
            document.querySelectorAll('[data-content-checked="true"]').forEach(el => {
                delete el.dataset.contentChecked;
            });

            // Wait for new page to load
            setTimeout(() => {
                setupMutationObserver();
                checkAndBlockContent();
            }, 1000);
        }

        // Create observer for URL changes
        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                handleNavigation();
            }
        });

        // Start observing
        urlObserver.observe(document, {subtree: true, childList: true});

        // Also intercept history API for more reliable detection
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            // Only handle if URL actually changed
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        };

        // Handle back/forward navigation
        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        });
    }

    // Recheck content periodically to catch items missed by observers
    function setupPeriodicCheck() {
        // Check every 5 seconds (increased from 3 to reduce processing load)
        setInterval(() => {
            if (isRelevantPage()) {
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
        // Only run on Facebook
        if (!isRelevantPage()) return;

        // Add custom styles
        addCustomStyles();

        // Set up observers
        setupMutationObserver();
        setupURLChangeDetection();

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll, {passive: true});

        // Initial content check
        checkAndBlockContent();

        // Set up periodic checking
        setupPeriodicCheck();

        // Log initialization
        console.log('Enhanced Facebook content blocker initialized. Blocking content containing:', BLOCKED_WORDS);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

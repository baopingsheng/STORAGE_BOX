// ==UserScript==
// @name         Clean Feed (Facebook Content Blocker)
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
                           'spx entertainment','chú tùng ham vui','đàm đức review','kênh của chang',
                           'thoibao','tuyền văn hóa','top comments','tin nóng','tin hot',
                           'la la school','tiktoker','truyện reddit','sk pictures','entertainment',
                           'phạm thoại','mẹ bé bắp','mẹ bắp','master anh đức','lasvegas','bacarat',
                           'oppa huy idol','phú đầu bò','master','bậc thầy','khu phố bất ổn',
                           'biết tuốt','bà tuyết','ciin','ngô đình nam','anhloren','the face vietnam',
                           'phim cực ngắn','vinh gấu','vtc news','baby three','loramen','tizi','đại tiểu thư',
                           'đài truyền tin','multi tv','chê phim','review phim','báo mới','thánh cmnnr'];

    // Track processed elements to avoid re-processing
    let processedElements = new WeakSet();
    let isObserving = false;
    let observer = null;
    let feedObserver = null; // Dedicated observer for feed changes

    // Critical feed state tracking
    let feedInitialized = false;
    let feedContainer = null;
    let firstPostsHandled = new Set(); // Track feed containers where first post has been handled

    // Last URL to track navigation
    let lastUrl = '';

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

    // Debug utilities - set to true to enable debugging logs
    const DEBUG = false;
    function debugLog(...args) {
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

    // Create a placeholder element that maintains feed structure without breaking it
    function createPlaceholder(originalElement) {
        const placeholder = document.createElement('div');

        // Copy key attributes to maintain Facebook's internal references
        if (originalElement.id) {
            placeholder.id = originalElement.id;
        }

        if (originalElement.className) {
            placeholder.className = originalElement.className;
        }

        // Keep some minimal styling that doesn't break the feed
        placeholder.style.minHeight = '1px';
        placeholder.style.margin = '0';
        placeholder.style.padding = '0';
        placeholder.style.overflow = 'hidden';
        placeholder.style.opacity = '0';
        placeholder.style.pointerEvents = 'none';

        // Mark as a placeholder
        placeholder.setAttribute('data-blocked-content', 'true');

        // Maintain any data attributes that Facebook might use for structure
        Array.from(originalElement.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .forEach(attr => {
                placeholder.setAttribute(attr.name, attr.value);
            });

        return placeholder;
    }

    // Special handling for the first post - preserve it visually but hide content
    function preserveFirstPost(element) {
        // For the first post, we don't remove it completely to preserve feed structure
        debugLog("Preserving first post while hiding blocked content");

        // Keep the element structure but hide its content
        const originalHeight = element.offsetHeight;
        const minimumHeight = Math.max(5, Math.min(originalHeight * 0.1, 20));

        // Create a wrapper to replace all the contents but keep the post in the DOM
        const wrapper = document.createElement('div');
        wrapper.style.minHeight = minimumHeight + 'px';
        wrapper.style.opacity = '0.01'; // Very subtle indicator, almost invisible
        wrapper.setAttribute('data-blocked-first-post', 'true');

        // Clear the post content but maintain the element in DOM
        element.style.minHeight = minimumHeight + 'px';

        // Keep the element's original size attributes
        element.style.width = element.offsetWidth ? (element.offsetWidth + 'px') : '';

        // Remove all content while keeping the main element
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Add our wrapper to keep some height
        element.appendChild(wrapper);

        // Mark as processed
        processedElements.add(element);

        return true;
    }

    // Process a feed element with special handling for the first post
    function processFeedElement(element, feedContainer, isFirstPost = false) {
        if (!element || processedElements.has(element)) return;

        // Get element text
        const elementText = element.textContent;

        // Check if contains blocked content
        const hasBlockedContent = elementText && containsBlockedContent(elementText);

        // Special handling for first post to maintain feed integrity
        if (isFirstPost) {
            // If it has blocked content, preserve the structure but hide content
            if (hasBlockedContent) {
                const foundWord = findBlockedWord(elementText);
                debugLog(`First post contains blocked word: ${foundWord} - preserving structure`);

                // Special preservation for first post
                preserveFirstPost(element);
                return;
            }

            // If no blocked content, mark as processed and leave it alone
            processedElements.add(element);
            return;
        }

        // For all other posts, proceed with normal processing
        if (!hasBlockedContent) {
            processedElements.add(element);
            return;
        }

        const foundWord = findBlockedWord(elementText);
        debugLog(`Removing feed item containing blocked word: ${foundWord}`);

        // Create and replace with placeholder
        const placeholder = createPlaceholder(element);
        if (element.parentNode) {
            element.parentNode.replaceChild(placeholder, element);
        }

        // Mark as processed
        processedElements.add(placeholder);
    }

    // Process a single element to check and remove if necessary (non-feed items)
    function processElement(element) {
        if (!element || processedElements.has(element)) return;

        const elementText = element.textContent;
        if (!elementText || !containsBlockedContent(elementText)) {
            processedElements.add(element);
            return;
        }

        const foundWord = findBlockedWord(elementText);
        debugLog(`Removing content containing blocked word: ${foundWord}`);

        // Find all feed containers - we need to check if this element is inside one
        const allFeedContainers = document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer);

        // Check if element is a direct child of a feed container
        let isFeedDirectChild = false;
        let isFirstChild = false;
        let relevantFeedContainer = null;

        for (const container of allFeedContainers) {
            if (container.contains(element) && element.parentNode === container) {
                isFeedDirectChild = true;
                relevantFeedContainer = container;

                // Check if it's the first post
                isFirstChild = container.children.length > 0 &&
                               container.children[0] === element;
                break;
            }
        }

        // Handle based on position
        if (isFeedDirectChild) {
            if (isFirstChild && !firstPostsHandled.has(relevantFeedContainer)) {
                // This is the first post and we haven't handled it yet for this feed
                firstPostsHandled.add(relevantFeedContainer);
                preserveFirstPost(element);
            } else {
                // Standard placeholder for regular feed items
                const placeholder = createPlaceholder(element);
                if (element.parentNode) {
                    element.parentNode.replaceChild(placeholder, element);
                }
                processedElements.add(placeholder);
            }
        } else {
            // For elements not directly in feed, we can remove them
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }

        processedElements.add(element);
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
                    // Schedule delayed checks after content expands
                    [300, 500, 1000].forEach(delay => {
                        setTimeout(() => {
                            const expandedText = postContainer.textContent;
                            if (!expandedText || !containsBlockedContent(expandedText)) return;

                            const foundWord = findBlockedWord(expandedText);
                            debugLog(`Removing expanded content with blocked word: ${foundWord}`);

                            // Determine if this is a part of the feed
                            const allFeedContainers = document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer);
                            let isFeedDirectChild = false;
                            let isFirstChild = false;
                            let relevantFeedContainer = null;

                            for (const container of allFeedContainers) {
                                if (container.contains(postContainer) && postContainer.parentNode === container) {
                                    isFeedDirectChild = true;
                                    relevantFeedContainer = container;
                                    isFirstChild = container.children.length > 0 &&
                                                 container.children[0] === postContainer;
                                    break;
                                }
                            }

                            // Handle based on position
                            if (isFeedDirectChild) {
                                if (isFirstChild && !firstPostsHandled.has(relevantFeedContainer)) {
                                    firstPostsHandled.add(relevantFeedContainer);
                                    preserveFirstPost(postContainer);
                                } else {
                                    const placeholder = createPlaceholder(postContainer);
                                    if (postContainer.parentNode) {
                                        postContainer.parentNode.replaceChild(placeholder, postContainer);
                                    }
                                }
                            } else {
                                // For non-feed items we can safely remove them
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
        // Find all feed containers
        const feedContainers = document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer);

        // Process each feed container
        feedContainers.forEach(feedContainer => {
            // Skip if no children
            if (!feedContainer || !feedContainer.children || feedContainer.children.length === 0) return;

            // Set up a dedicated observer for this feed if not already observed
            setupFeedObserver(feedContainer);

            // Process the feed's children
            const children = Array.from(feedContainer.children);

            // First, make sure we handle the first post specially
            if (children.length > 0 && !firstPostsHandled.has(feedContainer)) {
                const firstPost = children[0];
                // Process with special first post handling
                processFeedElement(firstPost, feedContainer, true);
                firstPostsHandled.add(feedContainer);
            }

            // Now process the rest of the children
            children.forEach((child, index) => {
                // Skip the first one as we've already processed it
                if (index === 0) return;

                processFeedElement(child, feedContainer, false);
            });
        });

        // Process other content normally
        Object.entries(CONTENT_SELECTORS).forEach(([type, selector]) => {
            // Skip feedRootContainer as we already processed it
            if (type === 'feedRootContainer') return;

            document.querySelectorAll(selector).forEach(element => {
                processElement(element);
            });
        });

        blockSuggestedContent();
        monitorSeeMoreButtons();
    }

    // Set up a dedicated observer for a specific feed container
    function setupFeedObserver(feedContainer) {
        // Skip if we've already set up an observer for this feed
        if (feedContainer._hasObserver) return;

        // Mark this feed as having an observer
        feedContainer._hasObserver = true;

        // Create a dedicated observer for this feed
        const config = { childList: true };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Handle new posts added to the feed
                    Array.from(mutation.addedNodes).forEach((node, index) => {
                        if (node.nodeType !== 1) return; // Skip non-element nodes

                        // Check if this is the first post (index 0 and first child)
                        const isFirstPost = (
                            index === 0 &&
                            feedContainer.children.length > 0 &&
                            feedContainer.children[0] === node &&
                            !firstPostsHandled.has(feedContainer)
                        );

                        if (isFirstPost) {
                            firstPostsHandled.add(feedContainer);
                        }

                        // Process with appropriate handling based on position
                        processFeedElement(node, feedContainer, isFirstPost);
                    });
                }
            });
        });

        observer.observe(feedContainer, config);
    }

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        document.querySelectorAll('div[data-pagelet="GroupSuggestions"], div[data-pagelet="GroupSuggestion"]').forEach(group => {
            if (processedElements.has(group)) return;
            processedElements.add(group);

            const groupText = group.textContent;
            if (groupText && containsBlockedContent(groupText)) {
                const foundWord = findBlockedWord(groupText);
                debugLog(`Removing suggested group with blocked word: ${foundWord}`);

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
                debugLog(`Removing suggested page with blocked word: ${foundWord}`);

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

    // Handle expanded text after clicking "See more"
    function checkExpandedContent() {
        document.querySelectorAll('[aria-expanded="true"]').forEach(container => {
            if (processedElements.has(container)) return;
            processedElements.add(container);

            const postContainer = findPostContainer(container);
            if (!postContainer) return;

            const expandedText = postContainer.textContent;
            if (!expandedText || !containsBlockedContent(expandedText)) return;

            const foundWord = findBlockedWord(expandedText);
            debugLog(`Removing expanded content with blocked word: ${foundWord}`);

            // Find the relevant feed container
            const allFeedContainers = document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer);
            let isFeedDirectChild = false;
            let isFirstChild = false;
            let relevantFeedContainer = null;

            for (const container of allFeedContainers) {
                if (container.contains(postContainer) && postContainer.parentNode === container) {
                    isFeedDirectChild = true;
                    relevantFeedContainer = container;
                    isFirstChild = container.children.length > 0 &&
                                 container.children[0] === postContainer;
                    break;
                }
            }

            // Handle based on position
            if (isFeedDirectChild) {
                if (isFirstChild && !firstPostsHandled.has(relevantFeedContainer)) {
                    firstPostsHandled.add(relevantFeedContainer);
                    preserveFirstPost(postContainer);
                } else {
                    const placeholder = createPlaceholder(postContainer);
                    if (postContainer.parentNode) {
                        postContainer.parentNode.replaceChild(placeholder, postContainer);
                    }
                }
            } else {
                // For non-feed items, remove
                if (postContainer.parentNode) {
                    postContainer.parentNode.removeChild(postContainer);
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
            let newFeedDetected = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;

                    // Check for feed containers in new nodes
                    Array.from(mutation.addedNodes).forEach(node => {
                        if (node.nodeType === 1 && node.querySelector) {
                            if ((node.matches && node.matches(CONTENT_SELECTORS.feedRootContainer)) ||
                                (node.querySelector && node.querySelector(CONTENT_SELECTORS.feedRootContainer))) {
                                newFeedDetected = true;
                            }
                        }
                    });
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
                    // Use longer delay for new feeds
                    const delay = newFeedDetected ? 500 : 150;

                    setTimeout(() => {
                        checkAndBlockContent();

                        if (hasExpandedContent) {
                            checkExpandedContent();
                        }

                        monitorSeeMoreButtons();
                    }, delay);
                }, 150);
            }
        });

        observer.observe(targetNode, config);
        isObserving = true;
    }

    // Global click handler to catch all clicks
    function setupGlobalClickHandler() {
        document.addEventListener('click', function(e) {
            setTimeout(() => {
                checkExpandedContent();
                monitorSeeMoreButtons();
            }, 500);
        }, { capture: true, passive: true });
    }

    // Handle scrolling to check for loaded content
    function handleScroll() {
        clearTimeout(window._scrollTimeout);
        window._scrollTimeout = setTimeout(() => {
            checkAndBlockContent();
            monitorSeeMoreButtons();
        }, 200);
    }

    // Reset tracking data when page changes
    function resetTracking() {
        processedElements = new WeakSet();
        feedInitialized = false;
        firstPostsHandled = new Set();

        // Disconnect any existing observers
        if (observer) {
            observer.disconnect();
            isObserving = false;
        }

        // Remove any feed-specific observers
        document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer).forEach(feed => {
            delete feed._hasObserver;
        });
    }

    // Detect URL changes for SPA navigation
    function setupURLChangeDetection() {
        lastUrl = location.href;

        function handleNavigation() {
            if (!isRelevantPage()) return;

            debugLog("Navigation detected to:", location.href);

            // Reset tracking on navigation
            resetTracking();

            // Wait a bit for the new page to load
            setTimeout(() => {
                setupMutationObserver();
                checkAndBlockContent();
            }, 1000);
        }

        // MutationObserver for detecting URL changes
        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                handleNavigation();
            }
        });

        urlObserver.observe(document, {subtree: true, childList: true});

        // Monitor pushState
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        };

        // Monitor popstate
        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleNavigation();
            }
        });

        // Additional handling for the dialog closing which can affect feed visibility
        function checkForDialogChanges() {
            // Look for any dialogs that might contain images, videos, etc.
            const dialogs = document.querySelectorAll('[role="dialog"]');
            if (dialogs.length === 0) {
                // No dialogs found, might have just closed one
                setTimeout(() => {
                    checkAndBlockContent();
                }, 500);
            }
        }

        // Monitor for dialog changes
        document.addEventListener('click', function(e) {
            // Look for close buttons in dialogs
            if (e.target && (
                (e.target.getAttribute('aria-label') === 'Close') ||
                e.target.closest('[aria-label="Close"]') ||
                e.target.classList.contains('x1lliihq') // Facebook's typical close button class
            )) {
                setTimeout(checkForDialogChanges, 300);
            }
        }, { capture: true, passive: true });
    }

    // Wait for feed container with multiple retries
    function waitForFeedContainer(retries = 10, delay = 300) {
        if (retries <= 0) {
            debugLog("Feed container not found after maximum retries");
            return;
        }

        const feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
        if (feedContainer) {
            debugLog("Feed container found, processing content");
            checkAndBlockContent();
        } else {
            debugLog(`Feed container not found, retrying in ${delay}ms (${retries} retries left)`);
            setTimeout(() => waitForFeedContainer(retries - 1, delay), delay);
        }
    }

    // Recheck content periodically
    function setupPeriodicCheck() {
        setInterval(() => {
            if (isRelevantPage()) {
                checkAndBlockContent();
                checkExpandedContent();
                monitorSeeMoreButtons();
            }
        }, 3000);
    }

    // Special back navigation handler
    function setupBackNavigationHandler() {
        window.addEventListener('pageshow', function(event) {
            // This fires when navigating back to the page from history
            if (event.persisted) {
                debugLog("Page was restored from back/forward cache");
                setTimeout(() => {
                    // Reset tracking and re-initialize
                    resetTracking();
                    setupMutationObserver();
                    checkAndBlockContent();
                }, 500);
            }
        });
    }

    // Special handling for photo/video viewer closure
    function setupViewerCloseHandler() {
        // Monitor for escape key which often closes dialogs
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Wait for the dialog to close
                setTimeout(() => {
                    checkAndBlockContent();
                }, 500);
            }
        });
    }

    // Check if current page is Facebook
    function isRelevantPage() {
        const url = window.location.href;
        return url.includes('facebook.com') || url.includes('fb.com');
    }

    // Initialize everything
    function initialize() {
        if (!isRelevantPage()) return;

        console.log("Initializing Facebook content blocker v1.3 with improved feed preservation");
        setupMutationObserver();
        setupURLChangeDetection();
        setupGlobalClickHandler();
        window.addEventListener('scroll', handleScroll, {passive: true});

        // Wait for feed container before processing
        waitForFeedContainer();

        // Initial content check
        checkAndBlockContent();
        setupPeriodicCheck();

        console.log('Facebook content blocker initialized. Using enhanced feed preservation technique.');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

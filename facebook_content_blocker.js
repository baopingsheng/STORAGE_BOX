// ==UserScript==
// @name         Facebook Content Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Delete Facebook posts containing specific keywords.
// @author       baopingsheng
// @match        https://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    // Các từ cần chặn (không phân biệt hoa thường)
    const BLOCKED_WORDS = ['miibeo','negav','embes','kênh 14','kenh14',];
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

    // Process a single element to check and remove if necessary
    function processElement(element, contentType) {
        // Skip already processed elements
        if (element.dataset.contentChecked === 'true') {
            return;
        }

        // Get text content of the element
        const elementText = element.textContent;

        // Only remove if content actually contains blocked words
        if (elementText && containsBlockedContent(elementText)) {
            // Find the found word for logging
            const foundWord = BLOCKED_WORDS.find(word => {
                const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                return regex.test(elementText.toLowerCase());
            });

            console.log(`Removed content containing blocked word: ${foundWord}`);

            // Remove the element
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }

            return; // Element removed, no need to mark as processed
        }

        // Mark as processed
        element.dataset.contentChecked = 'true';
    }

    // Find and monitor "See more" buttons more effectively
    function monitorSeeMoreButtons() {
        // More comprehensive selectors for "See more" buttons on Facebook
        const seeMoreCandidates = [
            // Target by text content
            ...Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"]')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === 'see more' ||
                       text === 'xem thêm';
            }),

            // Target by attributes (Facebook often uses these)
            ...Array.from(document.querySelectorAll('[aria-expanded="false"]')),

            // Target by specific Facebook classes and data attributes
            ...Array.from(document.querySelectorAll('div[data-ad-comet-preview-button], div[data-ad-preview-may-show-truncation]')),

            // Target expanded text spans that might contain "See more"
            ...Array.from(document.querySelectorAll('.text_exposed_link')),

            // Target by common Facebook patterns
            ...Array.from(document.querySelectorAll('span.see_more_link, a.see_more_link')),

            // Catch specific text elements with ellipsis that might be expandable
            ...Array.from(document.querySelectorAll('span')).filter(el => el.textContent.includes('...')),
        ];

        // Process each potential "See more" button
        seeMoreCandidates.forEach(button => {
            // Skip if already monitored
            if (button.dataset.seeMoreMonitored === 'true') {
                return;
            }

            // Mark as monitored to avoid duplicate handlers
            button.dataset.seeMoreMonitored = 'true';

            // Use event capture to ensure we get the click before Facebook's handler
            button.addEventListener('click', function(e) {
                // Store reference to the clicked element
                const clickedButton = this;

                // Find the closest post or comment container
                let postContainer = findPostContainer(clickedButton);

                // If we have a container, we'll check it after a delay
                if (postContainer) {
                    // Wait for FB to expand the content (use multiple timeouts for reliability)
                    [300, 500, 1000].forEach(delay => {
                        setTimeout(() => {
                            // Get the current text after expansion
                            const expandedText = postContainer.textContent;

                            // Check if expanded content contains blocked words
                            if (containsBlockedContent(expandedText)) {
                                // Find the found word for logging
                                const foundWord = BLOCKED_WORDS.find(word => {
                                    const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                                    return regex.test(expandedText.toLowerCase());
                                });

                                console.log(`Removed expanded content containing blocked word: ${foundWord}`);

                                // Remove the post
                                if (postContainer && postContainer.parentNode) {
                                    postContainer.parentNode.removeChild(postContainer);
                                }
                            }
                        }, delay);
                    });
                }
            }, { capture: true });
        });
    }

    // Find the post container from a child element (improved version)
    function findPostContainer(element) {
        // Start from the element and go up the DOM tree
        let current = element;
        const maxIterations = 15; // Increased search depth
        let iterations = 0;

        while (current && iterations < maxIterations) {
            // Check for post containers using multiple criteria

            // 1. Check by role attribute
            if (current.getAttribute('role') === 'article') {
                return current;
            }

            // 2. Check by common Facebook post classes
            if (current.classList.contains('userContentWrapper') ||
                current.classList.contains('_5pcr') ||
                current.classList.contains('_1dwg') ||
                current.classList.contains('_4-u2') ||
                current.classList.contains('_4_j4')) {
                return current;
            }

            // 3. Check by data attributes
            if (current.dataset && (
                (current.dataset.pagelet && current.dataset.pagelet.includes('FeedUnit')) ||
                current.dataset.testid === 'fbfeed_story' ||
                current.dataset.testid === 'post_container'
            )) {
                return current;
            }

            // 4. Check for feed units and posts by specific attributes
            if (current.getAttribute('data-ft') ||
                current.getAttribute('data-insertion-position') ||
                current.getAttribute('data-ad-preview')) {
                return current;
            }

            // 5. If we find a comment, get its parent
            if (current.getAttribute('aria-label')?.includes('Comment') ||
                current.classList.contains('UFIComment') ||
                current.dataset?.testid === 'UFI2Comment') {
                // For comments, we want the comment itself or its very close parent
                return current.closest('[role="article"]') || current;
            }

            // Try parent
            current = current.parentElement;
            iterations++;
        }

        // If we couldn't find a specific post container, try a reasonable fallback
        if (element) {
            // Look for nearest divs with substantial content
            let fallbackContainer = element.closest('div[data-pagelet], div[data-ft], div[data-testid]');
            if (fallbackContainer) return fallbackContainer;

            // Go up 3-5 levels as last resort
            let parent = element.parentElement;
            for (let i = 0; i < 4 && parent; i++) {
                if (parent.childNodes.length > 2) { // Has multiple children, likely a container
                    return parent;
                }
                parent = parent.parentElement;
            }
        }

        return null;
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

        // Monitor "See more" buttons
        monitorSeeMoreButtons();
    }

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        // Suggested groups
        const suggestedGroups = document.querySelectorAll('div[data-pagelet="GroupSuggestions"]');
        suggestedGroups.forEach(group => {
            if (group.dataset.contentChecked !== 'true') {
                const groupText = group.textContent;
                if (groupText && containsBlockedContent(groupText)) {
                    if (group && group.parentNode) {
                        group.parentNode.removeChild(group);
                    }
                    return; // Group removed, no need to mark as processed
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
                    if (container && container.parentNode) {
                        container.parentNode.removeChild(container);
                    } else if (page && page.parentNode) {
                        page.parentNode.removeChild(page);
                    }
                    return; // Page removed, no need to mark as processed
                }
                page.dataset.contentChecked = 'true';
            }
        });
    }

    // Additional function to handle expanded text that might appear after clicking "See more"
    function checkExpandedContent() {
        // Look for content that has been expanded but not checked
        const expandedContainers = document.querySelectorAll('[aria-expanded="true"]:not([data-expanded-checked="true"])');

        expandedContainers.forEach(container => {
            // Mark as checked
            container.dataset.expandedChecked = 'true';

            // Find the parent post
            const postContainer = findPostContainer(container);
            if (postContainer) {
                const expandedText = postContainer.textContent;

                // Check if expanded content has blocked words
                if (containsBlockedContent(expandedText)) {
                    // Find the found word for logging
                    const foundWord = BLOCKED_WORDS.find(word => {
                        const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
                        return regex.test(expandedText.toLowerCase());
                    });

                    console.log(`Removed expanded content containing blocked word: ${foundWord}`);

                    // Remove the post
                    if (postContainer && postContainer.parentNode) {
                        postContainer.parentNode.removeChild(postContainer);
                    }
                }
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
            characterData: true,
            attributes: true, // Monitor attribute changes to catch expansions
            attributeFilter: ['aria-expanded'] // Specifically watch for expansion attributes
        };

        // Create observer instance
        observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            let hasExpandedContent = false;

            for (let mutation of mutations) {
                // Check for DOM node additions (new content)
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            shouldCheck = true;
                            break;
                        }
                    }
                }

                // Check for aria-expanded attribute changes
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'aria-expanded' &&
                    mutation.target.getAttribute('aria-expanded') === 'true') {
                    hasExpandedContent = true;
                }

                if (shouldCheck && hasExpandedContent) break;
            }

            if (shouldCheck || hasExpandedContent) {
                // Delay slightly to allow Facebook to finish rendering
                clearTimeout(window._checkTimeout);
                window._checkTimeout = setTimeout(() => {
                    checkAndBlockContent();

                    if (hasExpandedContent) {
                        // Specifically check for newly expanded content
                        checkExpandedContent();
                    }

                    // Always look for new See More buttons
                    monitorSeeMoreButtons();
                }, 150);
            }
        });

        // Start observing
        observer.observe(targetNode, config);
        isObserving = true;
    }

    // Document click handler to catch all clicks that might expand content
    function setupGlobalClickHandler() {
        document.addEventListener('click', function(e) {
            // Wait a bit after any click to check for expanded content
            setTimeout(() => {
                checkExpandedContent();
            }, 500);
        }, { passive: true });
    }

    // Handle scrolling to check for dynamically loaded content
    function handleScroll() {
        // Debounce scroll event to improve performance
        clearTimeout(window._scrollTimeout);
        window._scrollTimeout = setTimeout(() => {
            checkAndBlockContent();
            monitorSeeMoreButtons(); // Look for new See More buttons when scrolling
        }, 200);
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
            document.querySelectorAll('[data-see-more-monitored="true"]').forEach(el => {
                delete el.dataset.seeMoreMonitored;
            });
            document.querySelectorAll('[data-expanded-checked="true"]').forEach(el => {
                delete el.dataset.expandedChecked;
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
        // Check every 3 seconds
        setInterval(() => {
            if (isRelevantPage()) {
                checkAndBlockContent();
                checkExpandedContent(); // Also check for any expanded content
                monitorSeeMoreButtons(); // Look for new See More buttons
            }
        }, 0);
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

        // Set up observers
        setupMutationObserver();
        setupURLChangeDetection();
        setupGlobalClickHandler(); // Add global click handler

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll, {passive: true});

        // Initial content check
        checkAndBlockContent();

        // Set up periodic checking
        setupPeriodicCheck();

        // Log initialization
        console.log('Enhanced Facebook content blocker initialized - DELETE VERSION. Blocking content containing:', BLOCKED_WORDS);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

// ==UserScript==
// @name         Clean Feed (Facebook Content Blocker) - Fixed
// @namespace    http://tampermonkey.net/
// @version      1.1
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
                           'đài truyền tin','multi tv','chê phim','review phim','báo mới','thánh cmnnr'];

    // Track processed elements to avoid re-processing
    let processedElements = new WeakSet();
    let isObserving = false;
    let observer = null;
    let feedInitialized = false;

    // Track if we've preserved the first post
    let firstPostPreserved = false;

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
    function createPlaceholder(originalElement) {
        const placeholder = document.createElement('div');

        // Copy key attributes to maintain Facebook's internal references
        if (originalElement.id) {
            placeholder.id = originalElement.id;
        }

        if (originalElement.className) {
            placeholder.className = originalElement.className;
        }

        // Essential styles to keep it in the DOM but invisible
        placeholder.style.height = '0';
        placeholder.style.margin = '0';
        placeholder.style.padding = '0';
        placeholder.style.overflow = 'hidden';
        placeholder.style.opacity = '0';

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

    // Process a feed element specifically - with special handling for first post
    function processFeedElement(element, feedContainer, isFirstPost = false) {
        if (!element || processedElements.has(element)) return;

        // Mark as processed to avoid re-processing
        processedElements.add(element);

        // Get element text
        const elementText = element.textContent;

        // Check if contains blocked content
        const hasBlockedContent = elementText && containsBlockedContent(elementText);

        // Special handling for first post - NEVER remove it if it's actually the first post
        // Instead, we'll just create a hidden placeholder for it if it contains blocked content
        if (isFirstPost) {
            // If this is the first run and this is the first post in the feed
            if (!firstPostPreserved) {
                console.log("Preserving first post structure to maintain feed integrity");
                firstPostPreserved = true;

                // If it has blocked content, we'll still hide it, but keep its structure
                if (hasBlockedContent) {
                    const foundWord = findBlockedWord(elementText);
                    console.log(`First post contains blocked word: ${foundWord} - hiding content but preserving structure`);

                    // Hide the content while preserving the element
                    element.style.opacity = '0';
                    element.style.minHeight = '5px'; // Minimal height to keep structure
                    element.style.overflow = 'hidden';
                    element.setAttribute('data-blocked-content', 'true');

                    // Clear the content but maintain the element
                    while (element.firstChild) {
                        element.removeChild(element.firstChild);
                    }
                }

                // Always return without removing the first post
                return;
            }
        }

        // Normal processing for non-first posts or subsequent runs
        if (!hasBlockedContent) return;

        const foundWord = findBlockedWord(elementText);
        console.log(`Removing feed item containing blocked word: ${foundWord}`);

        // Create and replace with placeholder
        const placeholder = createPlaceholder(element);
        if (element.parentNode) {
            element.parentNode.replaceChild(placeholder, element);
        }
    }

    // Process a single element to check and remove if necessary (non-feed items)
    function processElement(element) {
        if (!element || processedElements.has(element)) return;

        // Mark as processed to avoid re-processing
        processedElements.add(element);

        const elementText = element.textContent;
        if (!elementText || !containsBlockedContent(elementText)) return;

        const foundWord = findBlockedWord(elementText);
        console.log(`Removing content containing blocked word: ${foundWord}`);

        // For feed child elements, use a placeholder
        const feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
        const isFeedDirectChild = feedContainer && feedContainer.contains(element) &&
                                 element.parentNode === feedContainer;

        if (isFeedDirectChild) {
            // Check if it's the first child of the feed
            const isFirstChild = feedContainer &&
                                feedContainer.children.length > 0 &&
                                feedContainer.children[0] === element;

            // If it's the first child and we haven't preserved a first post yet,
            // we need special handling to maintain feed integrity
            if (isFirstChild && !firstPostPreserved) {
                console.log("Processing first post with special handling");
                firstPostPreserved = true;

                // Hide content but preserve structure
                element.style.opacity = '0';
                element.style.minHeight = '5px';
                element.style.overflow = 'hidden';
                element.setAttribute('data-blocked-content', 'true');

                // Clear the content
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
                return;
            }

            // Standard placeholder for feed items after first post
            const placeholder = createPlaceholder(element);
            if (element.parentNode) {
                element.parentNode.replaceChild(placeholder, element);
            }
        } else {
            // For all other elements, remove them
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
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
                            console.log(`Removing expanded content containing blocked word: ${foundWord}`);

                            // Determine if this is a direct child of the feed container
                            const feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
                            const isFeedDirectChild = feedContainer && feedContainer.contains(postContainer) &&
                                                     postContainer.parentNode === feedContainer;

                            // Check if it's the first child of the feed
                            const isFirstChild = feedContainer &&
                                               feedContainer.children.length > 0 &&
                                               feedContainer.children[0] === postContainer;

                            // Special handling for first child
                            if (isFirstChild && !firstPostPreserved) {
                                console.log("Preserving expanded first post structure");
                                firstPostPreserved = true;

                                // Hide content but preserve structure
                                postContainer.style.opacity = '0';
                                postContainer.style.minHeight = '5px';
                                postContainer.style.overflow = 'hidden';
                                postContainer.setAttribute('data-blocked-content', 'true');

                                // Clear the content
                                while (postContainer.firstChild) {
                                    postContainer.removeChild(postContainer.firstChild);
                                }
                                return;
                            }

                            if (isFeedDirectChild) {
                                // For direct children of the feed, replace with placeholder
                                const placeholder = createPlaceholder(postContainer);
                                if (postContainer.parentNode) {
                                    postContainer.parentNode.replaceChild(placeholder, postContainer);
                                }
                            } else {
                                // For all other elements, fully remove
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
        // Get the feed container
        const feedContainers = document.querySelectorAll(CONTENT_SELECTORS.feedRootContainer);

        // Process each feed container carefully
        feedContainers.forEach(feedContainer => {
            // Skip if no children in the feed
            if (!feedContainer || !feedContainer.children || feedContainer.children.length === 0) return;

            // Process children individually
            const children = Array.from(feedContainer.children);

            // Process each child, with special handling for the first post
            children.forEach((feedChild, index) => {
                // Skip already processed elements
                if (processedElements.has(feedChild)) return;

                // Check if this is the first post (index 0)
                const isFirstPost = (index === 0);

                // Process with special handling for the first post
                processFeedElement(feedChild, feedContainer, isFirstPost);
            });

            // Mark feed as initialized after first processing
            if (!feedInitialized && children.length > 0) {
                feedInitialized = true;
                console.log("Feed initialized with " + children.length + " items");
            }
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

    // Block suggested groups, pages, and other recommendations
    function blockSuggestedContent() {
        document.querySelectorAll('div[data-pagelet="GroupSuggestions"], div[data-pagelet="GroupSuggestion"]').forEach(group => {
            if (processedElements.has(group)) return;

            processedElements.add(group);

            const groupText = group.textContent;
            if (groupText && containsBlockedContent(groupText)) {
                const foundWord = findBlockedWord(groupText);
                console.log(`Removing suggested group containing blocked word: ${foundWord}`);

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
                console.log(`Removing suggested page containing blocked word: ${foundWord}`);

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
            console.log(`Removing expanded content containing blocked word: ${foundWord}`);

            // Check if this is a direct child of feed
            const feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
            const isFeedDirectChild = feedContainer && feedContainer.contains(postContainer) &&
                                     postContainer.parentNode === feedContainer;

            // Check if it's the first child
            const isFirstChild = feedContainer &&
                                feedContainer.children.length > 0 &&
                                feedContainer.children[0] === postContainer;

            // Special handling for first post
            if (isFirstChild && !firstPostPreserved) {
                console.log("Preserving expanded first post structure");
                firstPostPreserved = true;

                // Hide content but preserve structure
                postContainer.style.opacity = '0';
                postContainer.style.minHeight = '5px';
                postContainer.style.overflow = 'hidden';
                postContainer.setAttribute('data-blocked-content', 'true');

                // Clear content
                while (postContainer.firstChild) {
                    postContainer.removeChild(postContainer.firstChild);
                }
                return;
            }

            if (isFeedDirectChild) {
                // Replace with placeholder
                const placeholder = createPlaceholder(postContainer);
                if (postContainer.parentNode) {
                    postContainer.parentNode.replaceChild(placeholder, postContainer);
                }
            } else {
                // For other elements, fully remove
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
                                // Reset first post preservation when new feed is detected
                                firstPostPreserved = false;
                                console.log("New feed detected, resetting first post preservation");
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
                    // Use longer delay for new feeds to ensure they're fully loaded
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

    // Document click handler to catch all clicks that might expand content
    function setupGlobalClickHandler() {
        document.addEventListener('click', function(e) {
            setTimeout(() => {
                checkExpandedContent();
                monitorSeeMoreButtons();
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
        feedInitialized = false;
        firstPostPreserved = false; // Reset first post preservation
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

    // Function to wait for feed container and retry multiple times
    function waitForFeedContainer(retries = 10, delay = 300) {
        if (retries <= 0) {
            console.log("Feed container not found after maximum retries");
            return;
        }

        const feedContainer = document.querySelector(CONTENT_SELECTORS.feedRootContainer);
        if (feedContainer) {
            console.log("Feed container found, processing content");
            checkAndBlockContent();
        } else {
            console.log(`Feed container not found, retrying in ${delay}ms (${retries} retries left)`);
            setTimeout(() => waitForFeedContainer(retries - 1, delay), delay);
        }
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

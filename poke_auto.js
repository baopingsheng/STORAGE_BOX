// ==UserScript==
// @name         Poke Auto
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-clicks elements with the specified class selector and scrolls to load more content
// @author       You
// @match        *://www.facebook.com/pokes
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const targetSelector = '.x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x1ypdohk.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tdsg8.x1hl2dhg.xggy1nq.x1o1ewxj.x3x9cwd.x1e5q0jg.x13rtm0m.x87ps6o.x1lku1pv.x1a2a7pz.x9f619.x3nfvp2.xdt5ytf.xl56j7k.x1n2onr6.xh8yej3>.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xn6708d.x1ye3gou.xtvsq51.x1r1pt67';
    const clickDelay = 3000; // 3 seconds delay after clicking
    const scrollAmount = 800; // Pixels to scroll each time
    const scrollInterval = 2000; // Time between scrolls (2 seconds)
    const maxScrolls = 20; // Maximum number of scroll operations

    let scrollCount = 0;
    let isRunning = false;
    let isPaused = false;

    // Function to click on elements
    function clickElements() {
        const elements = document.querySelectorAll(targetSelector);
        console.log(`Found ${elements.length} elements with the target selector`);

        elements.forEach((element, index) => {
            setTimeout(() => {
                console.log(`Clicking element ${index + 1}`);
                element.click();
            }, index * 500); // Stagger clicks by 500ms to avoid overloading
        });

        return elements.length > 0;
    }

    // Function to scroll the page
    function scrollPage() {
        if (isPaused) return;

        if (scrollCount >= maxScrolls) {
            console.log('Reached maximum scroll count. Stopping auto-scroll.');
            isRunning = false;
            return;
        }

        window.scrollBy(0, scrollAmount);
        scrollCount++;
        console.log(`Scrolled down (${scrollCount}/${maxScrolls})`);

        // After scrolling, look for new elements to click
        setTimeout(clickElements, 1000);
    }

    // Start the process
    function startProcess() {
        if (isRunning) return;

        isRunning = true;
        scrollCount = 0;
        isPaused = false;

        console.log('Starting auto-click and scroll process');

        // Initial click
        const foundElements = clickElements();

        // Set up scrolling interval
        const scrollTimer = setInterval(() => {
            if (!isRunning) {
                clearInterval(scrollTimer);
                console.log('Process stopped');
                return;
            }

            scrollPage();
        }, scrollInterval);
    }

    // Toggle pause/resume
    function togglePause() {
        isPaused = !isPaused;
        console.log(isPaused ? 'Process paused' : 'Process resumed');
    }

    // Stop the process
    function stopProcess() {
        isRunning = false;
        console.log('Process will stop after current operation');
    }

    // Create control panel
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '10px';
        panel.style.right = '10px';
        panel.style.zIndex = '9999';
        panel.style.background = 'rgba(0, 0, 0, 0.7)';
        panel.style.padding = '10px';
        panel.style.borderRadius = '5px';
        panel.style.color = 'white';
        panel.style.fontFamily = 'Arial, sans-serif';

        const startButton = document.createElement('button');
        startButton.innerText = 'Start';
        startButton.style.marginRight = '5px';
        startButton.onclick = startProcess;

        const pauseButton = document.createElement('button');
        pauseButton.innerText = 'Pause/Resume';
        pauseButton.style.marginRight = '5px';
        pauseButton.onclick = togglePause;

        const stopButton = document.createElement('button');
        stopButton.innerText = 'Stop';
        stopButton.onclick = stopProcess;

        const status = document.createElement('div');
        status.id = 'auto-clicker-status';
        status.style.marginTop = '5px';
        status.style.fontSize = '12px';

        panel.appendChild(startButton);
        panel.appendChild(pauseButton);
        panel.appendChild(stopButton);
        panel.appendChild(status);

        document.body.appendChild(panel);

        // Update status periodically
        setInterval(() => {
            if (isRunning) {
                status.textContent = isPaused ?
                    'Status: PAUSED' :
                    `Status: RUNNING (${scrollCount}/${maxScrolls} scrolls)`;
            } else {
                status.textContent = 'Status: STOPPED';
            }
        }, 500);
    }

    // Initialize after page is fully loaded
    window.addEventListener('load', () => {
        console.log('Auto-Click and Scroll userscript loaded');
        createControlPanel();

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt+S to start
            if (e.altKey && e.key === 's') startProcess();
            // Alt+P to pause/resume
            if (e.altKey && e.key === 'p') togglePause();
            // Alt+X to stop
            if (e.altKey && e.key === 'x') stopProcess();
        });
    });
})();

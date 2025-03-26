// ==UserScript==
// @name         Fullscreen Toggle Button with Auto-Hide
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Adds a button to toggle fullscreen mode that hides itself
// @author       boapinghsheng
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

// Create button element
const button = document.createElement('button');
button.innerHTML = `
<svg id="fullscreen-icon" fill="#000" stroke="#000" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-5.0 -10.0 110.0 135.0">
  <path d="m76 32c0-4.4102-3.5898-8-8-8h-6c-1.1016 0-2 0.89844-2 2s0.89844 2 2 2h6c2.2109 0 4 1.7891 4 4v6c0 1.1016 0.89844 2 2 2s2-0.89844 2-2z"/>
  <path d="m76 68v-6c0-1.1016-0.89844-2-2-2s-2 0.89844-2 2v6c0 2.2109-1.7891 4-4 4h-6c-1.1016 0-2 0.89844-2 2s0.89844 2 2 2h6c4.4102 0 8-3.5898 8-8z"/>
  <path d="m24 68c0 4.4102 3.5898 8 8 8h6c1.1016 0 2-0.89844 2-2s-0.89844-2-2-2h-6c-2.2109 0-4-1.7891-4-4v-6c0-1.1016-0.89844-2-2-2s-2 0.89844-2 2z"/>
  <path d="m26 40c1.1016 0 2-0.89844 2-2v-6c0-2.2109 1.7891-4 4-4h6c1.1016 0 2-0.89844 2-2s-0.89844-2-2-2h-6c-4.4102 0-8 3.5898-8 8v6c0 1.1016 0.89844 2 2 2z"/>
</svg>
`;
button.title = 'Toggle Fullscreen (F11)';

// Style the button
button.style.cssText = `
    position: fixed;
    border: 0;
    background: transparent;
    bottom: 0;
    left: 0;
    z-index: 9999;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    opacity: 1;
`;

// Get the SVG element
const svg = button.querySelector('#fullscreen-icon');

// Hover effects (only apply blur to the SVG)
button.addEventListener('mouseenter', () => {
    svg.style.transition = 'filter 0.3s ease';
    svg.style.filter = 'blur(4px)';
});

button.addEventListener('mouseleave', () => {
    svg.style.filter = 'blur(0px)';
});

// Function to toggle fullscreen
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
        button.style.display = 'none'; // Hide button when entering fullscreen
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Show button when exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        button.style.display = 'flex';
    }
});

// Add click event listener
button.addEventListener('click', toggleFullScreen);

// Add keyboard shortcut listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreen();
    }
});

// Add button to page
document.body.appendChild(button);

})();

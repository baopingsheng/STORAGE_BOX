// ==UserScript==
// @name         Rophim Redirect Toggle
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Chuyển nhanh chế độ đầy đủ / rút gọn.
// @match        *://*.rophim.me/*
// @author       Baobinh0705 
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Styling
    const style = `
    @import url(https://fonts.googleapis.com/css2?family=Varela+Round&display=swap);
    #totop{display:none!important}
    .switch {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        height: 24px;
        width: 120px;
    }
    .switch input {
        display: block;
        appearance: none;
        position: absolute;
        width: 100%;
        height: 24px;
        border: 0;
        padding: 0;
        margin: 0;
        cursor: pointer;
        background: none;
        -webkit-tap-highlight-color: #fff0;
    }
    .switch input:checked ~ .on {
        transform: translateY(0) scale(1);
        opacity: 1;
        color: #f0d25c;
        filter: blur(0);
    }
    .switch input:checked ~ .on ~ span:after {
        transform: translateY(0);
    }
    .switch input:checked ~ .off {
        transform: translateY(16px) scale(.8);
        opacity: 0;
        filter: blur(3px);
        color: #fff0;
    }
    .switch label {
        position: absolute;
        right: 12px;
        display: block;
        font-size: 17px;
        font-weight: 400;
        line-height: 24px;
        user-select: none;
        transform-origin: right 16px;
        width: 100%;
        text-align: right;
        color: #f0d25c;
        -webkit-tap-highlight-color: #fff0;
        transition: all 0.3s ease;
        pointer-events: none;
        font-family: 'Varela Round', sans-serif;
    }
    .switch label.on {
        transform: translateY(-16px) scale(.8);
        opacity: 0;
        filter: blur(3px);
    }
    .switch label.on ~ span:after {
        transform: translateY(7px);
    }
    .switch label.off {
        transform: translateY(0) scale(1);
        opacity: 1;
        color: #f0d25c;
        filter: blur(0);
    }
    .switch span {
        position: absolute;
        top: 5px;
        right: 0;
        width: 4px;
        height: 4px;
        background: #C7C7CB;
        border-radius: 50%;
        box-shadow: 0 7px 0 #C7C7CB;
        pointer-events: none;
    }
    .switch span:after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #f0d25c;
        border-radius: 50%;
        transition: all 0.2s ease;
    }`;
    // Create style element
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    document.head.appendChild(styleElement);

    // Create switch HTML
    const switchDiv = document.createElement('div');
    switchDiv.className = 'switch';
    switchDiv.innerHTML = `
        <input type="checkbox" id="redirectToggle">
        <label class="on" for="redirectToggle">Đầy đủ</label>
        <label class="off" for="redirectToggle">Rút gọn</label>
        <span></span>
    `;
    document.body.appendChild(switchDiv);

    // Get toggle and labels
    const toggle = switchDiv.querySelector('input');
    const onLabel = switchDiv.querySelector('label.on');
    const offLabel = switchDiv.querySelector('label.off');

    // Initialize from local storage
    const isAutomatic = GM_getValue('rophimRedirectMode', true);
    toggle.checked = isAutomatic;

    // Event listener for toggle
    toggle.addEventListener('change', function() {
        // Save to local storage
        GM_setValue('rophimRedirectMode', this.checked);

        // Trigger redirect
        redirectToAppropriateUrl();
    });

    // Redirect function
    function redirectToAppropriateUrl() {
        const isAutomatic = GM_getValue('rophimRedirectMode', true);
        const currentUrl = new URL(window.location.href);

        // Determine new subdomain
        const newSubdomain = isAutomatic ? 'www' : 'lite';

        // Reconstruct URL with new subdomain
        currentUrl.hostname = `${newSubdomain}.rophim.me`;

        // Redirect only if different
        if (currentUrl.href !== window.location.href) {
            window.location.href = currentUrl.href;
        }
    }

    // Run redirect on page load
    redirectToAppropriateUrl();
})();

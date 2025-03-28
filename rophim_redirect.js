// ==UserScript==
// @name         Rophim Redirect Toggle
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Chuyển chế độ đầy đủ / rút gọn nhanh.
// @match        *://*.rophim.me/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    const style = `
    @import url(https://fonts.googleapis.com/css2?family=Varela+Round&display=swap);
    #totop{display:none!important}
    .switch{position:fixed;bottom:20px;right:20px;z-index:9999;height:24px;width:80px;backdrop-filter:blur(2px)}
    .switch input{display:block;appearance:none;position:absolute;width:100%;height:24px;border:0;padding:0;margin:0;cursor:pointer;background:none;-webkit-tap-highlight-color:#fff0}
    .switch input:checked ~ .on{transform:translateY(0) scale(1);opacity:1;color:#f0d25c;filter:blur(0)}
    .switch input:checked ~ .on ~ span:after{transform:translateY(0)}
    .switch input:checked ~ .off{transform:translateY(16px) scale(.8);opacity:0;filter:blur(3px);color:#fff0}
    .switch label{position:absolute;right:12px;display:block;font-size:17px;font-weight:400;line-height:24px;user-select:none;transform-origin:right 16px;width:100%;text-align:right;color:#f0d25c;-webkit-tap-highlight-color:#fff0;transition:all .3s ease;pointer-events:none;font-family:'Varela Round',sans-serif}
    .switch label.on{transform:translateY(-16px) scale(.8);opacity:0;filter:blur(3px)}
    .switch label.on ~ span:after{transform:translateY(7px)}
    .switch label.off{transform:translateY(0) scale(1);opacity:1;color:#f0d25c;filter:blur(0)}
    .switch span{position:absolute;top:5px;right:0;width:4px;height:4px;background:#C7C7CB;border-radius:50%;box-shadow:0 7px 0 #C7C7CB;pointer-events:none}
    .switch span:after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:#f0d25c;border-radius:50%;transition:all .2s ease}`;
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    document.head.appendChild(styleElement);
    const switchDiv = document.createElement('div');
    switchDiv.className = 'switch';
    switchDiv.innerHTML = `
        <input type="checkbox" id="redirectToggle">
        <label class="on" for="redirectToggle">Đầy đủ</label>
        <label class="off" for="redirectToggle">Rút gọn</label>
        <span></span>
    `;
    document.body.appendChild(switchDiv);
    const toggle = switchDiv.querySelector('input');
    const onLabel = switchDiv.querySelector('label.on');
    const offLabel = switchDiv.querySelector('label.off');
    const isAutomatic = GM_getValue('rophimRedirectMode', true);
    toggle.checked = isAutomatic;
    toggle.addEventListener('change', function() {
        GM_setValue('rophimRedirectMode', this.checked);
        redirectToAppropriateUrl();
    });
    function redirectToAppropriateUrl() {
        const isAutomatic = GM_getValue('rophimRedirectMode', true);
        const currentUrl = new URL(window.location.href);
        const newSubdomain = isAutomatic ? 'www' : 'lite';
        currentUrl.hostname = `${newSubdomain}.rophim.me`;
        if (currentUrl.href !== window.location.href) {
            window.location.href = currentUrl.href;
        }
    }
    redirectToAppropriateUrl();
})();

// ==UserScript==
// @name         Popup Sparkle
// @namespace    *
// @version      0.1
// @description  Cửa sổ bật lên lấp lánh ^^
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initializeScript() {
        const adultVideoContainer = document.querySelector("body");
        const videoPopup = document.createElement("div");
        videoPopup.id = "videoPopup";
        const closeBtn = document.createElement("span");
        closeBtn.id = "closeBtn";
        const videoElement = document.createElement("video");
        videoElement.id = "randomVideo";
        videoElement.setAttribute("controls", "");
        videoElement.setAttribute("playsinline", "");

        const style = document.createElement('style');
        style.textContent = `
        #videoPopup{position:fixed;bottom:16px;right:16px;width:200px;height:100px;min-width:200px;min-height:100px;padding:0;margin:0;display:flex;flex-direction:column;align-items:center;z-index:100000;transition:transform .02s ease}
        #closeBtn{pointer-events:all;position:absolute;top:0;right:0;cursor:pointer;display:flex;align-items:normal;justify-content:center;width:clamp(24px, 5vw, 28px);height:clamp(24px, 5vw, 28px);text-align:center;background:rgb(255 255 255 / .11);border:1px solid rgb(255 255 255 / .2);border-radius:30px;color:#fff;font-size:clamp(16px, 4vw, 20px);margin:10px;z-index:100000;backdrop-filter:blur(50px)}
        #videoPopup:hover .resize-handle{opacity:1!important}
        #closeBtn::after{content:'\\2715'}#randomVideo{width:100%;height:100%;object-fit:cover;background:linear-gradient(135deg,#010101,#333);border-radius:25px;box-shadow:0 0 10px rgb(0 0 0 / .2)}
        .resize-handle{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' class='injected-svg' data-src='https://cdn.hugeicons.com/icons/border-none-01-bulk-rounded.svg' xmlns:xlink='http://www.w3.org/1999/xlink' role='img' color='%23fff'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.28314 2.56858C7.38413 3.11155 7.02582 3.63358 6.48285 3.73457C5.57153 3.90406 5.0166 4.1801 4.59835 4.59835C4.1801 5.0166 3.90406 5.57153 3.73457 6.48285C3.63358 7.02582 3.11155 7.38413 2.56858 7.28314C2.0256 7.18216 1.6673 6.66013 1.76828 6.11715C1.98536 4.94998 2.39304 3.97523 3.18414 3.18414C3.97523 2.39304 4.94998 1.98536 6.11715 1.76828C6.66013 1.6673 7.18216 2.0256 7.28314 2.56858Z' fill='%23fff'/%3E%3C/svg%3E");display:block;position:absolute;z-index:1;width:26px;height:26px;background-size:80px;background-repeat:no-repeat}
        .resize-handle.nw{cursor:nw-resize;top:-8px;left:-8px;transform:rotate(0deg)}
        .resize-handle.ne{cursor:ne-resize;top:-8px;right:-8px;transform:rotate(90deg)}
        .resize-handle.sw{cursor:sw-resize;bottom:-8px;left:-8px;transform:rotate(-90deg)}
        .resize-handle.se{cursor:se-resize;bottom:-8px;right:-8px;transform:rotate(-180deg)}`;
        document.head.appendChild(style);

        const getRandomVideoUrl = () => {
            const links = adultVideoContainer.querySelectorAll("video[src]");
            return links.length ? links[Math.floor(Math.random() * links.length)].getAttribute("src") : null;
        };

        const showRandomVideo = () => {
            const randomUrl = getRandomVideoUrl();
            if (randomUrl) {
                videoElement.src = randomUrl;
                videoElement.play();
                videoPopup.classList.remove("hidden");
            }
        };

        let holdTimer;
        let holdDuration = 0;
        const handleHold = start => {
            if (start) {
                holdTimer = setInterval(() => {
                    if ((holdDuration += 100) >= 1000) {
                        localStorage.setItem("videoPopupClosed", "true");
                        videoPopup.remove();
                        window.removeEventListener("scroll", showRandomVideo);
                        clearInterval(holdTimer);
                    }
                }, 100);
            } else {
                clearInterval(holdTimer);
                holdDuration = 0;
            }
        };

        ["mousedown", "touchstart"].forEach(ev => closeBtn.addEventListener(ev, () => handleHold(true)));
        ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(ev => closeBtn.addEventListener(ev, () => handleHold(false)));

        closeBtn.addEventListener("click", () => {
            videoPopup.remove();
            window.removeEventListener("scroll", showRandomVideo);
        });

        let isDragging = false;
        let isResizing = false;
        let offsetX;
        let offsetY;

        const move = e => {
            if (isDragging && !isResizing) {
                e.preventDefault();
                const { clientX, clientY } = e.touches ? e.touches[0] : e;
                const l = Math.max(16, Math.min(clientX - offsetX, window.innerWidth - videoPopup.offsetWidth - 16));
                const t = Math.max(16, Math.min(clientY - offsetY, window.innerHeight - videoPopup.offsetHeight - 16));
                Object.assign(videoPopup.style, { left: `${l}px`, top: `${t}px`, right: "auto", bottom: "auto" });
            }
        };

        const start = e => {
            if (!isResizing) {
                isDragging = true;
                const { clientX, clientY } = e.touches ? e.touches[0] : e;
                offsetX = clientX - videoPopup.offsetLeft;
                offsetY = clientY - videoPopup.offsetTop;
                videoPopup.style.cursor = "grabbing";
                ["mousemove", "touchmove"].forEach(ev => document.addEventListener(ev, move, { passive: false }));
                ["mouseup", "touchend"].forEach(ev => document.addEventListener(ev, end));
            }
        };

        const end = () => {
            isDragging = false;
            videoPopup.style.cursor = "grab";
            savePosition();
            ["mousemove", "touchmove", "mouseup", "touchend"].forEach(ev => document.removeEventListener(ev, ev.includes("move") ? move : end));
        };

        ["mousedown", "touchstart"].forEach(ev => videoPopup.addEventListener(ev, start));

        videoPopup.appendChild(closeBtn);
        videoPopup.appendChild(videoElement);
        document.body.appendChild(videoPopup);

        const resizeHandles = ["nw", "ne", "sw", "se"];
        resizeHandles.forEach(handle => {
            const resizeHandle = document.createElement("div");
            resizeHandle.className = `resize-handle ${handle}`;
            videoPopup.appendChild(resizeHandle);

            let startX;
            let startY;
            let startWidth;
            let startHeight;
            let startLeft;
            let startTop;

            const startResize = e => {
                e.preventDefault();
                isResizing = true;
                document.body.style.userSelect = "none";
                ({ clientX: startX, clientY: startY } = e.touches ? e.touches[0] : e);
                ({ offsetWidth: startWidth, offsetHeight: startHeight, offsetLeft: startLeft, offsetTop: startTop } = videoPopup);
                document.addEventListener("mousemove", resize);
                document.addEventListener("touchmove", resize, { passive: false });
                document.addEventListener("mouseup", stopResize);
                document.addEventListener("touchend", stopResize);
            };

            const resize = e => {
                if (!isResizing) {
                    return;
                }
                e.preventDefault();
                const { clientX: currentX, clientY: currentY } = e.touches ? e.touches[0] : e;
                const diffX = currentX - startX;
                const diffY = currentY - startY;
                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (handle.includes("e")) {
                    newWidth = Math.max(200, Math.min(startWidth + diffX, window.innerWidth - startLeft - 16));
                } else if (handle.includes("w")) {
                    const potentialWidth = Math.max(200, startWidth - diffX);
                    newWidth = Math.min(potentialWidth, startLeft + startWidth - 16);
                    newLeft = startLeft + startWidth - newWidth;
                }

                if (handle.includes("s")) {
                    newHeight = Math.max(100, Math.min(startHeight + diffY, window.innerHeight - startTop - 16));
                } else if (handle.includes("n")) {
                    const potentialHeight = Math.max(100, startHeight - diffY);
                    newHeight = Math.min(potentialHeight, startTop + startHeight - 16);
                    newTop = startTop + startHeight - newHeight;
                }

                Object.assign(videoPopup.style, {
                    width: `${newWidth}px`,
                    height: `${newHeight}px`,
                    left: `${Math.max(16, newLeft)}px`,
                    top: `${Math.max(16, newTop)}px`
                });
                videoElement.style.height = `${newHeight}px`;
            };

            const stopResize = () => {
                isResizing = false;
                document.body.style.userSelect = "";
                document.removeEventListener("mousemove", resize);
                document.removeEventListener("touchmove", resize);
                document.removeEventListener("mouseup", stopResize);
                document.removeEventListener("touchend", stopResize);
                savePosition();
            };

            resizeHandle.addEventListener("mousedown", startResize);
            resizeHandle.addEventListener("touchstart", startResize, { passive: false });
        });

        const savePosition = () => {
            localStorage.setItem("vpPos", JSON.stringify({
                l: videoPopup.style.left,
                t: videoPopup.style.top,
                w: videoPopup.offsetWidth,
                h: videoPopup.offsetHeight
            }));
        };

        const savedPos = JSON.parse(localStorage.getItem("vpPos"));
        if (savedPos) {
            Object.assign(videoPopup.style, {
                left: savedPos.l || "auto",
                top: savedPos.t || "auto",
                width: `${Math.max(200, savedPos.w)}px`,
                height: `${Math.max(100, savedPos.h)}px`
            });
            videoElement.style.height = `${Math.max(100, savedPos.h)}px`;
        } else {
            Object.assign(videoPopup.style, { bottom: "16px", right: "16px", left: "auto", top: "auto" });
        }

        videoPopup.style.cursor = "grab";

        if (localStorage.getItem("videoPopupClosed") === "true") {
            videoPopup.remove();
        } else {
            window.addEventListener("scroll", showRandomVideo);
        }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        initializeScript();
    } else {
        window.addEventListener("DOMContentLoaded", initializeScript);
    }
})();

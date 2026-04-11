(function () {

  if (window.__TV9_OUTSTREAM_LOADED__) return;
  window.__TV9_OUTSTREAM_LOADED__ = true;

  const doc = document;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const WIDTH  = isMobile ? 340 : 512;
  const HEIGHT = isMobile ? 190 : 288;

  const INSERT_AFTER_P = 2;
  const MIDROLL_INTERVAL = 15;
  const ENABLE_STICKY = true;

  const STICKY_BOTTOM = isMobile ? 110 : 12;
  const STICKY_TOP = 40;

  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const CONTENT_VIDEO = "https://cdn.jwplayer.com/manifests/FxfoX3Xp.m3u8";
  const THUMBNAIL_URL = "https://static.tv9hindi.com/images/TV9-Hindi-Logo.svg";

  /* ==========================
   DOMAIN → LANGUAGE MAPPING
========================== */
const DOMAIN_MAP = {
  "tv9telugu.com": "telugu",
  "tv9marathi.com": "marathi",
  "tv9bangla.com": "bangla",
  "tv9kannada.com": "kannada",
  "tv9hindi.com": "hindi"
};

function getSiteLang() {
  const host = window.location.hostname.replace("www.", "");
  return DOMAIN_MAP[host] || "hindi"; // fallback
}

const SITE_LANG = getSiteLang();

function buildIU(type, index) {
  return `/21874393853/Tv9_OSVP/tv9_osvp_${SITE_LANG}_${type}_${index}`;
}

function buildVastUrl(iu, position) {
  return `https://pubads.g.doubleclick.net/gampad/ads?iu=${iu}` +
    `&tfcd=0&npa=0` +
    `&sz=400x300|640x360|640x480|800x450|300x250|1x1|635x357|444x250|419x236|333x250` +
    `&gdfp_req=1&unviewed_position_start=1&output=vast` +
    `&env=instream&vpos=${position}` +
    `&impl=s&plcmt=2` +
    `&vad_type=linear&ad_type=audio_video` +
    `&vpw=640&vph=360` +
    `&min_ad_duration=5000&max_ad_duration=60000`;
}

const PREROLL_WATERFALL = [
  buildVastUrl(buildIU("preroll", 1), "preroll"),
  buildVastUrl(buildIU("preroll", 2), "preroll")
];

const MIDROLL_WATERFALL = [
  buildVastUrl(buildIU("midroll", 1), "midroll"),
  buildVastUrl(buildIU("midroll", 2), "midroll")
];

  const PREROLL_PREFETCH_MARGIN = "400px 0px";
  const PREROLL_TIMEOUT_MS = 1800;
  const DEFAULT_VIDEO_DURATION = 900; // fallback vid_d (seconds) sent to ad server when metadata hasn't loaded yet

  let prerollIndex = 0;
  let midrollIndex = 0;

  let adsLoader = null, adsManager = null, adc = null;
  let lastMidrollTime = 0, midrollPlaying = false, adPlaying = false, isPreroll = true;
  let viewable = false, adsManagerReady = false, adsStarted = false, prerollRequested = false;

  let isFloating = false;
  let cachedInlineTop = null;
  let userDismissedFloat = false;
  let prerollTimer = null;

  const container = doc.createElement("div");
  container.id = "tv9-outstream-player";
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:${isMobile ? "0 auto 20px auto" : "0 auto"};
    position:relative;
    z-index:${isMobile ? "999999" : "8"};
    opacity:1;
    visibility:visible;
    pointer-events:auto;
  `;

  const branding = doc.createElement("div");

  branding.innerHTML = `
    <a href="https://www.adomega.in/?utm_source=tv9_video&utm_medium=player&utm_campaign=outstream"
       target="_blank"
       class="tv9-powered-by"
    >
      <span class="tv9-powered-text">Video powered by</span>
      <span class="tv9-powered-brand">AdOmega</span>
    </a>
  `;

  branding.style.cssText = `
    width:${WIDTH}px;
    margin:${isMobile ? "4px auto 0 auto" : "4px auto 0 auto"};
    text-align:left;
  `;

  const placeholder = doc.createElement("div");
  placeholder.style.width = WIDTH + "px";
  placeholder.style.height = HEIGHT + "px";
  placeholder.style.margin = isMobile ? "0 auto 20px auto" : "0 auto";
  placeholder.style.display = "none";

  const uiStyles = doc.createElement("style");
  uiStyles.textContent = `
    .tv9-powered-by {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      padding: 3px 2px;
      border-radius: 4px;
      background: rgba(255,255,255,0.85);
      border: 1px solid rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: ${isMobile ? "15px" : "16px"};
      line-height: 1;
      color: #555;
      transition: all 0.15s ease;
    }

    .tv9-powered-by:hover {
      background: rgba(255,255,255,1);
    }

    .tv9-powered-text {
      font-weight: 400;
      opacity: 0.7;
    }

    .tv9-powered-brand {
      font-weight: 600;
      color: #000;
    }

    #tv9-outstream-player {
      overflow: hidden;
    }

    .tv9-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(0,0,0,0.15);
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      color: #000;
      padding: 0;
      line-height: 1;
      transition: all 0.2s ease;
    }

    .tv9-btn:hover {
      background: rgba(240,240,240,1);
      transform: scale(1.1);
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    }

    .tv9-btn:active {
      transform: scale(0.95);
    }

    #tv9-playpause-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      width: ${isMobile ? 52 : 64}px;
      height: ${isMobile ? 52 : 64}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(255,255,255,0.92);
      border: 1.5px solid rgba(0,0,0,0.2);
      box-shadow: 0 4px 18px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 1999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #tv9-playpause-overlay:hover {
      background: rgba(240,240,240,1);
    }

    #tv9-outstream-player:not([data-ad-playing="true"]):hover #tv9-playpause-overlay {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, -50%) scale(1);
    }

    #tv9-playpause-overlay:active {
      transform: translate(-50%, -50%) scale(0.93) !important;
    }

    #tv9-playpause-overlay.tv9-flash {
      animation: tv9-ripple 0.3s ease forwards;
    }

    @keyframes tv9-ripple {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
      100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
    }
  `;
  doc.head.appendChild(uiStyles);

  container.innerHTML = `
    <div id="tv9-thumb" style="
      position:absolute;
      top:50%;
      left:0;
      transform:translateY(-50%);
      width:100%;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#000;
      border-radius:8px;
      z-index:2001;
    ">
      <img src="${THUMBNAIL_URL}" style="
        max-width:90%;
        max-height:90%;
        object-fit:contain;
        pointer-events:none;
        user-select:none;
      ">
    </div>

    <video id="tv9-video" playsinline muted style="
      width:100%; height:100%; background:transparent; opacity:0; border-radius:8px;">
    </video>

    <div id="tv9-ad-layer" style="
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      z-index:1000;"></div>

    <button id="tv9-playpause-overlay" aria-label="Play / Pause">
      <svg id="tv9-pp-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 22 : 26}" height="${isMobile ? 22 : 26}" viewBox="0 0 24 24" fill="black">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>

    <button id="tv9-close" class="tv9-btn" style="
      position:absolute; top:10px; left:${BTN_LEFT_MARGIN + 10}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      display:none; z-index:2000;"
      aria-label="Dismiss floating player">
      <svg xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 18 : 22}" height="${isMobile ? 18 : 22}" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round">
        <line x1="5" y1="5" x2="19" y2="19"/>
        <line x1="19" y1="5" x2="5" y2="19"/>
      </svg>
    </button>

    <button id="tv9-mute" class="tv9-btn" style="
      position:absolute; bottom:10px; left:${BTN_LEFT_MARGIN + 10}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      display:none; z-index:2000;"
      aria-label="Toggle mute">
      <svg id="tv9-mute-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 17 : 20}" height="${isMobile ? 17 : 20}" fill="black" viewBox="0 0 24 24">
        <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    </button>
  `;

  function getInlineTop() {
    if (cachedInlineTop === null) {
      const measureEl = isFloating ? placeholder : container;
      const rect = measureEl.getBoundingClientRect();
      cachedInlineTop = rect.top + window.scrollY;
    }
    return cachedInlineTop;
  }

  function clearPrerollTimer() {
    if (!prerollTimer) return;
    clearTimeout(prerollTimer);
    prerollTimer = null;
  }

  function startPrerollTimer() {
    clearPrerollTimer();
    prerollTimer = setTimeout(() => {
      if (!isPreroll || adPlaying || adsManagerReady) return;
      tryNextVast(true);
    }, PREROLL_TIMEOUT_MS);
  }

  function requestPrerollIfNeeded() {
    if (prerollRequested || !adsLoader || !isPreroll) return;
    prerollRequested = true;
    requestAds(false);
  }

  window.addEventListener("resize", () => {
    cachedInlineTop = null;
  });

  function returnToInline() {
    if (!isFloating) return;
    isFloating = false;
    cachedInlineTop = null;

    placeholder.style.display = "none";

    container.style.position = "relative";
    container.style.top = "auto";
    container.style.bottom = "auto";
    container.style.left = "auto";
    container.style.right = "auto";
    container.style.transform = "none";
    container.style.margin = isMobile ? "0 auto 20px auto" : "0 auto";

    closeBtn.style.display = "none";
  }

  let scrollRafPending = false;

  window.addEventListener("scroll", () => {
    if (!ENABLE_STICKY || scrollRafPending) return;
    scrollRafPending = true;

    requestAnimationFrame(() => {
      scrollRafPending = false;

      const y = window.scrollY;
      const inlineTop = getInlineTop();
      const shouldFloat = y > inlineTop + 300;

      if (shouldFloat && !isFloating && !userDismissedFloat) {
        isFloating = true;
        placeholder.style.display = "block";
        container.style.position = "fixed";

        closeBtn.style.display = "flex";

        if (isMobile) {
          container.style.top = STICKY_TOP + "px";
          container.style.left = "50%";
          container.style.transform = "translateX(-50%) scale(0.75)";
		  container.style.transformOrigin = "top left";
        } else {
          container.style.bottom = STICKY_BOTTOM + "px";
          container.style.right = "12px";
          container.style.transform = "scale(0.5)";
          container.style.transformOrigin = "bottom right";
        }

        container.style.margin = "0";
      }

      if (!shouldFloat && isFloating) {
        returnToInline();
      }
    });
  });

  function placeBrandingBeforePlayer() {
    if (container.parentNode) {
      container.parentNode.insertBefore(branding, container);
    }
  }

  function injectInArticle() {
    const targetId = isMobile ? "AO_player_wap" : "AO_player_web";
    const targetDiv = doc.getElementById(targetId);

    if (targetDiv) {
      targetDiv.innerHTML = "";
      targetDiv.appendChild(branding);
      targetDiv.appendChild(container);
      return;
    }

    const prioritySelectors = [
      "#top_screen_news_mobile",
      ".prostocklist-tab-contents",
      ".market_bx",
      "#startup-videos-main",
      "#mainprice",
      ".sec_indice_detail"
    ];

    for (let selector of prioritySelectors) {
      const el = doc.querySelector(selector);
      if (el && el.offsetParent !== null) {
        el.after(container);
        placeBrandingBeforePlayer();
        return;
      }
    }

    const h1 = doc.querySelector("h1");
    if (!h1) {
      doc.body.appendChild(branding);
      doc.body.appendChild(container);
      return;
    }

    const paras = Array.from(doc.querySelectorAll("p"))
      .filter(p => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);

    (paras[INSERT_AFTER_P - 1] || paras[paras.length - 1] || h1).after(container);
    placeBrandingBeforePlayer();
  }

  injectInArticle();
  container.after(placeholder);

  const video = container.querySelector("#tv9-video");
  const adLayer = container.querySelector("#tv9-ad-layer");
  const closeBtn = container.querySelector("#tv9-close");
  const muteBtn  = container.querySelector("#tv9-mute");
  const thumbnail = container.querySelector("#tv9-thumb");
  adLayer.style.pointerEvents = "none";

  video.preload = "metadata";

  let hlsInstance = null;
  let hlsReady = null;
  let imaReady = null;

  function ensureHlsReady() {
    if (!CONTENT_VIDEO.includes(".m3u8")) return Promise.resolve();
    if (video.canPlayType("application/vnd.apple.mpegurl")) return Promise.resolve();
    if (window.Hls && window.Hls.isSupported()) return Promise.resolve();

    if (hlsReady) return hlsReady;

    hlsReady = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tv9-hls="1"]');

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      script.async = true;
      script.dataset.tv9Hls = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return hlsReady;
  }

  function ensureIMAReady() {
    if (window.google && window.google.ima) return Promise.resolve();
    if (imaReady) return imaReady;

    imaReady = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tv9-ima="1"]');

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
      script.async = true;
      script.dataset.tv9Ima = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return imaReady;
  }

  function loadContentVideo() {
    if (!CONTENT_VIDEO.includes(".m3u8")) {
      video.src = CONTENT_VIDEO;
      video.load();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = CONTENT_VIDEO;
      video.load();
      return;
    }

    ensureHlsReady()
      .then(() => {
        if (!window.Hls || !window.Hls.isSupported()) return;

        if (hlsInstance) {
          hlsInstance.destroy();
        }

        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30
        });

        hlsInstance.loadSource(CONTENT_VIDEO);
        hlsInstance.attachMedia(video);
      })
      .catch(() => {
        console.warn("[tv9 Outstream] HLS.js failed to load.");
      });
  }

  if (CONTENT_VIDEO.includes(".m3u8")) {
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "fetch";
    preloadLink.href = CONTENT_VIDEO;
    preloadLink.crossOrigin = "anonymous";
    document.head.appendChild(preloadLink);

    ensureHlsReady().catch(() => {});
  }

  ensureIMAReady().catch(() => {});

  loadContentVideo();
  video.loop = false;
  video.muted = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");

  function getVPMute() { return video.muted ? 1 : 0; }

  function getVideoDurationForAds() {
    return Number.isFinite(video.duration) && video.duration > 0
      ? Math.floor(video.duration)
      : DEFAULT_VIDEO_DURATION;
  }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || adsStarted || !adsManager) return;

    try {
      adsStarted = true;
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch (e) {
      adsStarted = false;
      tryNextVast(isPreroll);
    }
  }

  function requestAds(isMidroll) {
    if (!adsLoader) return;

    adsManagerReady = false;
    adsStarted = false;

    const req = new google.ima.AdsRequest();
    const waterfall = isMidroll ? MIDROLL_WATERFALL : PREROLL_WATERFALL;
    const index = isMidroll ? midrollIndex : prerollIndex;
    const PAGE_URL = encodeURIComponent(window.location.href);

    if (!waterfall[index]) {
      if (isMidroll) {
        midrollIndex = 0;
        midrollPlaying = false;
        video.play().catch(() => {});
      } else {
        isPreroll = false;
        clearPrerollTimer();
        video.play().catch(() => {});
      }
      return;
    }

    req.adTagUrl = waterfall[index]
      + "&description_url=" + PAGE_URL
      + "&vid_t=" + encodeURIComponent(document.title)
      + "&vid_kw=" + encodeURIComponent("stock market, investing, finance, crude oil price, gold price, rupees, sensex, bse, share market")
      + "&vid_d=" + getVideoDurationForAds()
      + "&vpmute=" + getVPMute()
      + "&cust_params=" + encodeURIComponent("category=finance" + "&section=markets" + "&content=stocks" + "&format=video" + "&lang=en" + "&ptype=outstream" + "&plcmt=sticky")
      + "&correlator=" + Date.now();

    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);
    req.setAdWillPlayMuted(video.muted);
    req.plcmt = 2;

    if (!isMidroll) startPrerollTimer();
    adsLoader.requestAds(req);
  }

  function tryNextVast(isPrerollContext) {
    clearPrerollTimer();

    if (adsManager) {
      try { adsManager.destroy(); } catch (e) {}
    }

    adsManager = null;
    adsManagerReady = false;
    adsStarted = false;
    adPlaying = false;

    if (isPrerollContext) {
      prerollIndex++;
      prerollRequested = false;

      if (prerollIndex < PREROLL_WATERFALL.length) {
        requestPrerollIfNeeded();
      } else {
        isPreroll = false;
        video.play().catch(() => {});
      }
    } else {
      midrollIndex++;
      if (midrollIndex < MIDROLL_WATERFALL.length) {
        requestAds(true);
      } else {
        midrollIndex = 0;
        midrollPlaying = false;
        video.play().catch(() => {});
      }
    }
  }

  function initIMA() {
    adc = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adc);
    adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
    adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, () => tryNextVast(isPreroll));
    adc.initialize();
  }

  function loadIMA() {
    ensureIMAReady()
      .then(initIMA)
      .catch(() => {
        console.warn("[tv9 Outstream] IMA SDK failed to load. Falling back to content.");
        if (hlsInstance) {
			hlsInstance.destroy();
			hlsInstance = null;
		}
	    isPreroll = false;
        clearPrerollTimer();
        video.play().catch(() => {});
      });
  }

  loadIMA();

  const prefetchObserver = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (!entry.isIntersecting) return;

    requestPrerollIfNeeded();
    prefetchObserver.disconnect();
  }, {
    root: null,
    rootMargin: PREROLL_PREFETCH_MARGIN,
    threshold: 0
  });

  prefetchObserver.observe(container);

  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    viewable = entry.intersectionRatio >= 0.1;

    if (viewable && adsManagerReady) startAdsIfViewable();

    if (!adPlaying && !isPreroll) {
      if (viewable) {
        video.play().catch(() => {});
      } else if (!isFloating) {
        video.pause();
      }
    }
  }, { threshold: 0.1 });

  observer.observe(container);

  const ppOverlay = container.querySelector("#tv9-playpause-overlay");
  const ppIcon = container.querySelector("#tv9-pp-icon");

  const ICON_PAUSE = `<path d="M5 4h5v16H5zM14 4h5v16h-5z"/>`;
  const ICON_PLAY  = `<path d="M6 4l14 8-14 8z"/>`;

  function syncPPIcon() {
    if (!ppIcon) return;
    ppIcon.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE;
  }

  if (ppOverlay) {
    ppOverlay.addEventListener("click", () => {
      if (adPlaying || isPreroll) return;
      ppOverlay.classList.remove("tv9-flash");
      void ppOverlay.offsetWidth;
      ppOverlay.classList.add("tv9-flash");

      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });
  }

  video.addEventListener("pause", syncPPIcon);
  video.addEventListener("playing", syncPPIcon);

  video.addEventListener("playing", () => {
    if (thumbnail) thumbnail.style.display = "none";
    video.style.opacity = 1;
    muteBtn.style.display = "flex";
  });

  video.addEventListener("ended", () => {
    if (adsLoader) {
      try { adsLoader.contentComplete(); } catch (e) {}
    }
  });

  function onAdsManagerLoaded(e) {
    clearPrerollTimer();

    adsManager = e.getAdsManager(video);
    adsManager.setVolume(video.muted ? 0 : 1);

    adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, () => {
      tryNextVast(isPreroll);
    });

    adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
      adPlaying = true;
      container.setAttribute("data-ad-playing", "true");
      if (thumbnail) thumbnail.style.display = "none";
      muteBtn.style.display = "flex";
      video.pause();
      adLayer.style.pointerEvents = "auto";
    });

    adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
      adPlaying = false;
      container.removeAttribute("data-ad-playing");
      adLayer.style.pointerEvents = "none";
      adsStarted = false;

      if (isPreroll) {
        prerollIndex++;
        prerollRequested = false;

        if (prerollIndex < PREROLL_WATERFALL.length) {
          requestPrerollIfNeeded();
        } else {
          isPreroll = false;
          video.play().catch(() => {});
        }
      } else {
        midrollIndex++;
        if (midrollIndex < MIDROLL_WATERFALL.length) {
          requestAds(true);
        } else {
          midrollIndex = 0;
          video.play().catch(() => {});
        }
        midrollPlaying = false;
      }
    });

    adsManagerReady = true;
    startAdsIfViewable();
  }

  video.addEventListener("timeupdate", () => {
    if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
    if (midrollPlaying || isPreroll || !viewable) return;
    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
      lastMidrollTime = video.currentTime;
      midrollPlaying = true;
      requestAds(true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else if (!adPlaying && !isPreroll && viewable) video.play().catch(() => {});
  });

  const MUTE_ICON_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 18 : 22}" height="${isMobile ? 18 : 22}" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="3 9 7 9 12 5 12 19 7 15 3 15"/>
    <line x1="16" y1="9" x2="21" y2="15"/>
    <line x1="21" y1="9" x2="16" y2="15"/>
  </svg>`;

  const MUTE_ICON_ON = `<svg xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 18 : 22}" height="${isMobile ? 18 : 22}" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="3 9 7 9 12 5 12 19 7 15 3 15"/>
    <path d="M16 8c1.5 1.5 1.5 6.5 0 8"/>
    <path d="M18.5 5.5c3 3 3 10 0 13"/>
  </svg>`;

  muteBtn.onclick = () => {
    const m = !video.muted;
    video.muted = m;
    if (adsManager) adsManager.setVolume(m ? 0 : 1);
    muteBtn.innerHTML = m ? MUTE_ICON_OFF : MUTE_ICON_ON;
  };

  // Dismiss the floating state only; keep the inline player behavior intact.
  closeBtn.onclick = () => {
    userDismissedFloat = true;
    returnToInline();
    if (!adPlaying) video.pause();
  };

})();

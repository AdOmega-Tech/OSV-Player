(function () {

  if (window.__IT_OUTSTREAM_LOADED__) return;
  window.__IT_OUTSTREAM_LOADED__ = true;

  var doc = document;
  var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  var DEBUG = false;

  var WIDTH  = isMobile ? 340 : 512;
  var HEIGHT = isMobile ? 190 : 288;

  var FLOAT_WIDTH  = isMobile ? 240 : 320;
  var FLOAT_HEIGHT = isMobile ? 135 : 180;

  var ARTICLE_CONTAINER = ".story-with-main-sec";
  var INSERT_AFTER_P = 1;

  var MIDROLL_INTERVAL = 10;

  var ENABLE_STICKY = true;
  var STICKY_BOTTOM = isMobile ? 135 : 100;
  var STICKY_RIGHT  = isMobile ? 8 : 12;
  var FLOAT_TRIGGER_OFFSET = 300;

  var ACCENT = "#EC1C24";

  var THUMBNAIL_URL = "https://akm-img-a-in.tosshub.com/indiatoday/images/author/IndiaToday_8-profile_image_one_to_one_2.jpg?size=100:100";

  var HLS_SRC = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
  var IMA_SRC = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";

  var PREROLL_PREFETCH_MARGIN = "400px 0px";
  var PREROLL_TIMEOUT_MS = 1800;
  var DEFAULT_VIDEO_DURATION = 900;

  var CONTENT_VIDEOS = [
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  ];

  var CONTENT_VIDEO = CONTENT_VIDEOS[Math.floor(Math.random() * CONTENT_VIDEOS.length)];

  var PREROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1007232/Testing_APP_Ads/IT_And_VOD_Preroll_400x300_Test&description_url=[placeholder]&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpmute=1&impl=s&correlator=",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1007232/Testing_APP_Ads/IT_And_VOD_Preroll_1_Test&description_url=[placeholder]&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpmute=1&impl=s&correlator="
  ];

  var MIDROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1007232/Testing_APP_Ads/IT_And_VOD_Midroll_400x300_Test&description_url=[placeholder]&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpmute=1&impl=s&correlator=",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1007232/Testing_APP_Ads/IT_And_VOD_Midroll_1_Test&description_url=[placeholder]&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpmute=1&impl=s&correlator="
  ];

  var AD_KEYWORDS = "india today, breaking news, india news, politics, world news, cricket, business, entertainment";
  var CUST_PARAMS = "category=news&section=english&content=article&format=video&lang=en&ptype=outstream&plcmt=sticky";

  function log() {
    if (!DEBUG || !window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[IT Outstream]");
    console.warn.apply(console, args);
  }

  function boot() {

    var prerollIndex = 0;
    var midrollIndex = 0;

    var adsLoader = null, adsManager = null, adc = null;
    var lastMidrollTime = 0, midrollPlaying = false, adPlaying = false;
    var playerKilled = false, isPreroll = true;
    var viewable = false, adsManagerReady = false, adsStarted = false;
    var prerollRequested = false;
    var prerollTimer = null;
    var isFloating = false;
    var cachedInlineTop = null;
    var userDismissedFloat = false;
    var hlsReady = null;
    var imaReady = null;
    var hlsInstance = null;
    var currentW = WIDTH, currentH = HEIGHT;
    var prefetchObserver = null, viewObserver = null;

    var container = doc.createElement("div");
    container.id = "it-outstream-player";
    container.style.cssText =
      "width:" + WIDTH + "px;" +
      "height:" + HEIGHT + "px;" +
      "background:#000;" +
      "margin:" + (isMobile ? "15px auto 20px auto" : "15px auto") + ";" +
      "position:relative;" +
      "z-index:8;" +
      "opacity:1;" +
      "visibility:visible;" +
      "pointer-events:auto;";

    var placeholder = doc.createElement("div");
    placeholder.style.width = WIDTH + "px";
    placeholder.style.height = HEIGHT + "px";
    placeholder.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";
    placeholder.style.display = "none";

    var RAIL_H  = isMobile ? 34 : 40;
    var BTN_S   = isMobile ? 24 : 28;
    var CLOSE_S = BTN_S;
    var PAD     = isMobile ? 8 : 10;
    var EDGE    = Math.round((RAIL_H - BTN_S) / 2);
    var ICON_S  = isMobile ? 13 : 15;
    var PP_S    = isMobile ? 46 : 54;
    var PP_ICON = isMobile ? 20 : 24;

    var uiStyles = doc.createElement("style");
    uiStyles.textContent = [
      "#it-outstream-player{--it-accent:" + ACCENT + ";border-radius:0;overflow:hidden;transition:width .18s ease,height .18s ease}",
      "#it-outstream-player::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--it-accent);z-index:2100;pointer-events:none}",
      "#it-outstream-player[data-floating='true']{box-shadow:0 6px 28px rgba(0,0,0,.55);outline:1px solid rgba(255,255,255,.14);outline-offset:-1px}",
      "#it-rail{position:absolute;left:0;right:0;bottom:0;height:" + RAIL_H + "px;display:none;align-items:center;gap:" + PAD + "px;padding:0 " + PAD + "px;box-sizing:border-box;background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 100%);z-index:2000;pointer-events:none}",
      "#it-outstream-player[data-ready='true'] #it-rail{display:flex}",
      "#it-outstream-player[data-ad-playing='true'] #it-rail{display:flex;background:none}",
      "#it-outstream-player[data-ad-playing='true'] #it-progress{display:none}",
      "#it-progress{flex:1 1 auto;height:3px;background:rgba(255,255,255,.22);position:relative}",
      "#it-progress-fill{position:absolute;top:0;bottom:0;left:0;width:0%;background:var(--it-accent)}",
      ".it-btn{display:flex;align-items:center;justify-content:center;flex:0 0 auto;border:0;border-radius:0;padding:0;line-height:1;cursor:pointer;color:#fff;background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22);pointer-events:auto;transition:background .15s linear,box-shadow .15s linear}",
      ".it-btn:hover,.it-btn:focus-visible{background:var(--it-accent);box-shadow:inset 0 0 0 1px var(--it-accent);outline:none}",
      ".it-btn:active{background:#A8141A}",
      "#it-close{position:absolute;top:" + EDGE + "px;" + (isMobile ? "right:" : "left:") + PAD + "px;width:" + CLOSE_S + "px;height:" + CLOSE_S + "px;display:none;z-index:2101}",
            "#it-playpause-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:" + PP_S + "px;height:" + PP_S + "px;display:flex;align-items:center;justify-content:center;border:0;border-radius:0;padding:0;cursor:pointer;background:rgba(0,0,0,.62);box-shadow:inset 0 0 0 2px rgba(255,255,255,.85);z-index:1999;opacity:0;pointer-events:none;transition:opacity .15s linear,background .15s linear}",
      "#it-outstream-player:not([data-ad-playing='true']):hover #it-playpause-overlay,#it-outstream-player[data-paused='true']:not([data-ad-playing='true']) #it-playpause-overlay{opacity:1;pointer-events:auto}",
      "#it-playpause-overlay:hover{background:var(--it-accent);box-shadow:inset 0 0 0 2px var(--it-accent)}",
      "@media (prefers-reduced-motion:reduce){#it-outstream-player,.it-btn,#it-playpause-overlay{transition:none}}"
    ].join("");
    doc.head.appendChild(uiStyles);

    var MUTE_PATH_OFF = "M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";
    var MUTE_PATH_ON  = "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z";
    var ICON_PAUSE = "<path d='M6 5h4v14H6V5zm8 0h4v14h-4V5z'/>";
    var ICON_PLAY  = "<path d='M7 4v16l13-8z'/>";

    function muteSvg(path) {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='" + ICON_S + "' height='" + ICON_S + "' fill='white' viewBox='0 0 24 24'><path d='" + path + "'/></svg>";
    }

    container.innerHTML =
      "<div id='it-thumb' style=\"position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;z-index:1\">" +
        "<img src='" + THUMBNAIL_URL + "' alt='' style=\"max-width:62%;max-height:52%;object-fit:contain;pointer-events:none;user-select:none\">" +
      "</div>" +
      "<video id='it-video' playsinline muted style=\"width:100%;height:100%;background:transparent;opacity:0;display:block\"></video>" +
      "<div id='it-ad-layer' style=\"position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000\"></div>" +
      "<button id='it-playpause-overlay' aria-label='Play or pause video'>" +
        "<svg id='it-pp-icon' xmlns='http://www.w3.org/2000/svg' width='" + PP_ICON + "' height='" + PP_ICON + "' viewBox='0 0 24 24' fill='white'>" + ICON_PAUSE + "</svg>" +
      "</button>" +
      "<button id='it-close' class='it-btn' aria-label='Close player'>" +
        "<svg xmlns='http://www.w3.org/2000/svg' width='" + ICON_S + "' height='" + ICON_S + "' fill='white' viewBox='0 0 24 24'><path d='M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/></svg>" +
      "</button>" +
      "<div id='it-rail'>" +
        "<button id='it-mute' class='it-btn' style='width:" + BTN_S + "px;height:" + BTN_S + "px' aria-label='Turn sound on or off'>" + muteSvg(MUTE_PATH_OFF) + "</button>" +
        "<div id='it-progress'><div id='it-progress-fill'></div></div>" +
      "</div>";

    function injectInArticle() {
      var targetDiv = doc.getElementById(isMobile ? "itv_player_wap" : "itv_player_web");
      if (targetDiv) {
        targetDiv.innerHTML = "";
        targetDiv.appendChild(container);
        return true;
      }

      var storyEl = doc.querySelector(ARTICLE_CONTAINER);
      if (storyEl) {
        var storyParas = Array.prototype.filter.call(
          storyEl.querySelectorAll("p"),
          function (p) { return p.textContent && p.textContent.trim().length > 0; }
        );
        var anchor = storyParas[INSERT_AFTER_P - 1] || storyParas[storyParas.length - 1];
        if (anchor) {
          anchor.after(container);
          return true;
        }
        storyEl.appendChild(container);
        return true;
      }

      var h1 = doc.querySelector("h1");
      if (!h1) return false;

      var paras = Array.prototype.filter.call(
        doc.querySelectorAll("p"),
        function (p) { return h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING; }
      );
      (paras[INSERT_AFTER_P - 1] || paras[paras.length - 1] || h1).after(container);
      return true;
    }

    if (!injectInArticle()) {
      log("no injection target found");
      return;
    }

    container.after(placeholder);

    var video        = container.querySelector("#it-video");
    var adLayer      = container.querySelector("#it-ad-layer");
    var closeBtn     = container.querySelector("#it-close");
    var muteBtn      = container.querySelector("#it-mute");
    var thumbnail    = container.querySelector("#it-thumb");
    var thumbImg     = thumbnail.querySelector("img");
    var ppOverlay    = container.querySelector("#it-playpause-overlay");
    var ppIcon       = container.querySelector("#it-pp-icon");
    var progressFill = container.querySelector("#it-progress-fill");

    adLayer.style.pointerEvents = "none";
    if (thumbImg) {
      thumbImg.addEventListener("error", function () { thumbImg.style.display = "none"; }, { once: true });
    }

    function applySize(w, h) {
      currentW = w;
      currentH = h;
      container.style.width = w + "px";
      container.style.height = h + "px";
      if (adsManager && adsStarted) {
        try { adsManager.resize(w, h, google.ima.ViewMode.NORMAL); } catch (e) {}
      }
    }

    function getInlineTop() {
      if (cachedInlineTop === null) {
        var rect = (isFloating ? placeholder : container).getBoundingClientRect();
        cachedInlineTop = rect.top + window.scrollY;
      }
      return cachedInlineTop;
    }

    function goFloating() {
      isFloating = true;
      placeholder.style.display = "block";
      container.setAttribute("data-floating", "true");
      container.style.position = "fixed";
      container.style.margin = "0";
      container.style.top = "auto";
      container.style.left = "auto";
      container.style.transform = "none";
      container.style.bottom = STICKY_BOTTOM + "px";
      container.style.right = STICKY_RIGHT + "px";
      closeBtn.style.display = "flex";
      applySize(FLOAT_WIDTH, FLOAT_HEIGHT);
    }

    function returnToInline() {
      if (!isFloating) return;
      isFloating = false;
      cachedInlineTop = null;
      placeholder.style.display = "none";
      container.removeAttribute("data-floating");
      container.style.position = "relative";
      container.style.top = "auto";
      container.style.bottom = "auto";
      container.style.left = "auto";
      container.style.right = "auto";
      container.style.transform = "none";
      container.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";
      closeBtn.style.display = "none";
      applySize(WIDTH, HEIGHT);
    }

    function teardown() {
      playerKilled = true;
      clearPrerollTimer();
      if (prefetchObserver) { try { prefetchObserver.disconnect(); } catch (e) {} }
      if (viewObserver) { try { viewObserver.disconnect(); } catch (e) {} }
      if (adsManager) { try { adsManager.destroy(); } catch (e) {} adsManager = null; }
      if (adsLoader) { try { adsLoader.destroy(); } catch (e) {} adsLoader = null; }
      if (hlsInstance) { try { hlsInstance.destroy(); } catch (e) {} hlsInstance = null; }
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
      if (container.parentNode) container.parentNode.removeChild(container);
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
    }

    window.addEventListener("resize", function () {
      cachedInlineTop = null;
      if (adsManager && adsStarted) {
        try { adsManager.resize(currentW, currentH, google.ima.ViewMode.NORMAL); } catch (e) {}
      }
    }, { passive: true });

    var scrollRafPending = false;

    window.addEventListener("scroll", function () {
      if (!ENABLE_STICKY || scrollRafPending || playerKilled) return;
      scrollRafPending = true;
      requestAnimationFrame(function () {
        scrollRafPending = false;
        var shouldFloat = window.scrollY > getInlineTop() + FLOAT_TRIGGER_OFFSET;
        if (shouldFloat && !isFloating && !userDismissedFloat) goFloating();
        if (!shouldFloat && isFloating) returnToInline();
      });
    }, { passive: true });

    function loadScript(src, marker) {
      return new Promise(function (resolve, reject) {
        var existing = doc.querySelector("script[data-it-" + marker + "='1']");
        if (existing) {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        var script = doc.createElement("script");
        script.src = src;
        script.async = true;
        script.setAttribute("data-it-" + marker, "1");
        script.onload = resolve;
        script.onerror = reject;
        doc.head.appendChild(script);
      });
    }

    function isHls() { return CONTENT_VIDEO.indexOf(".m3u8") !== -1; }
    function nativeHls() { return !!video.canPlayType("application/vnd.apple.mpegurl"); }

    function ensureHlsReady() {
      if (!isHls() || nativeHls()) return Promise.resolve();
      if (window.Hls && window.Hls.isSupported()) return Promise.resolve();
      if (!hlsReady) hlsReady = loadScript(HLS_SRC, "hls");
      return hlsReady;
    }

    function ensureIMAReady() {
      if (window.google && window.google.ima) return Promise.resolve();
      if (!imaReady) imaReady = loadScript(IMA_SRC, "ima");
      return imaReady;
    }

    function loadContentVideo() {
      if (!isHls() || nativeHls()) {
        video.src = CONTENT_VIDEO;
        video.load();
        return;
      }

      ensureHlsReady().then(function () {
        if (playerKilled || !window.Hls || !window.Hls.isSupported()) return;
        if (hlsInstance) hlsInstance.destroy();

        hlsInstance = new window.Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1,
          abrEwmaDefaultEstimate: 500000,
          capLevelToPlayerSize: true
        });

        hlsInstance.on(window.Hls.Events.ERROR, function (evt, data) {
          if (!data || !data.fatal) return;
          log("hls fatal", data.type);
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
          else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
          else teardown();
        });

        hlsInstance.loadSource(CONTENT_VIDEO);
        hlsInstance.attachMedia(video);
      }).catch(function () {
        log("hls.js failed to load");
      });
    }

    video.preload = "metadata";
    video.loop = false;
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("disableremoteplayback", "");

    if (isHls() && !nativeHls()) ensureHlsReady().catch(function () {});
    ensureIMAReady().catch(function () {});
    loadContentVideo();

    function getVPMute() { return video.muted ? 1 : 0; }

    function getVideoDurationForAds() {
      return isFinite(video.duration) && video.duration > 0
        ? Math.floor(video.duration)
        : DEFAULT_VIDEO_DURATION;
    }

    function buildAdTag(base, isMidroll) {
      var url;
      try {
        url = new URL(base);
      } catch (e) {
        return base;
      }

      var p = url.searchParams;
      p.set("description_url", location.href);
      p.set("vid_t", doc.title);
      p.set("vid_kw", AD_KEYWORDS);
      p.set("vid_d", String(getVideoDurationForAds()));
      p.set("vpmute", String(getVPMute()));
      p.set("vpa", "auto");
      p.set("vpos", isMidroll ? "midroll" : "preroll");
      p.set("plcmt", "2");
      p.set("vpw", String(currentW));
      p.set("vph", String(currentH));
      p.set("cust_params", CUST_PARAMS);
      p.set("correlator", String(Date.now()));

      return url.toString();
    }

    function startAdsIfViewable() {
      if (!viewable || !adsManagerReady || adsStarted || playerKilled) return;
      try {
        adsStarted = true;
        adsManager.init(currentW, currentH, google.ima.ViewMode.NORMAL);
        adsManager.start();
      } catch (e) {
        adsStarted = false;
        log("adsManager start failed", e);
        tryNextVast(isPreroll);
      }
    }

    function clearPrerollTimer() {
      if (!prerollTimer) return;
      clearTimeout(prerollTimer);
      prerollTimer = null;
    }

    function startPrerollTimer() {
      clearPrerollTimer();
      prerollTimer = setTimeout(function () {
        if (!isPreroll || adPlaying || adsManagerReady || playerKilled) return;
        tryNextVast(true);
      }, PREROLL_TIMEOUT_MS);
    }

    function requestPrerollIfNeeded() {
      if (prerollRequested || !adsLoader || !isPreroll || playerKilled) return;
      prerollRequested = true;
      requestAds(false);
    }

    function requestAds(isMidroll) {
      if (playerKilled || !adsLoader) return;

      adsManagerReady = false;

      var waterfall = isMidroll ? MIDROLL_WATERFALL : PREROLL_WATERFALL;
      var index = isMidroll ? midrollIndex : prerollIndex;
      if (!waterfall[index]) return;

      try {
        var req = new google.ima.AdsRequest();
        req.adTagUrl = buildAdTag(waterfall[index], isMidroll);
        req.linearAdSlotWidth = currentW;
        req.linearAdSlotHeight = currentH;
        req.setAdWillAutoPlay(true);
        req.setAdWillPlayMuted(video.muted);
        if (!isMidroll) startPrerollTimer();
        adsLoader.requestAds(req);
      } catch (e) {
        log("requestAds failed", e);
        tryNextVast(!isMidroll);
      }
    }

    function advance(isPrerollContext) {
      if (isPrerollContext) {
        prerollIndex++;
        prerollRequested = false;
        if (prerollIndex < PREROLL_WATERFALL.length) {
          requestPrerollIfNeeded();
        } else {
          isPreroll = false;
          if (viewable) video.play().catch(function () {});
        }
      } else {
        midrollIndex++;
        midrollPlaying = false;
        if (midrollIndex < MIDROLL_WATERFALL.length) {
          requestAds(true);
        } else {
          midrollIndex = 0;
          if (viewable) video.play().catch(function () {});
        }
      }
    }

    function tryNextVast(isPrerollContext) {
      clearPrerollTimer();
      if (adsManager) { try { adsManager.destroy(); } catch (e) {} }
      adsManager = null;
      adsManagerReady = false;
      adsStarted = false;
      adPlaying = false;
      container.removeAttribute("data-ad-playing");
      adLayer.style.pointerEvents = "none";
      advance(isPrerollContext);
    }

    function onAdsManagerLoaded(e) {
      clearPrerollTimer();
      if (playerKilled) return;

      adsManager = e.getAdsManager(video);
      adsManager.setVolume(video.muted ? 0 : 1);

      adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, function () {
        tryNextVast(isPreroll);
      });

      adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, function () {
        adPlaying = true;
        container.setAttribute("data-ad-playing", "true");
        container.setAttribute("data-ready", "true");
        thumbnail.style.display = "none";
        syncPPIcon();
        video.pause();
        adLayer.style.pointerEvents = "auto";
      });

      adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, function () {
        adPlaying = false;
        adsStarted = false;
        container.removeAttribute("data-ad-playing");
        adLayer.style.pointerEvents = "none";
        syncPPIcon();
        advance(isPreroll);
      });

      adsManagerReady = true;
      setTimeout(startAdsIfViewable, 0);
    }

    function initIMA() {
      if (playerKilled) return;
      try {
        adc = new google.ima.AdDisplayContainer(adLayer, video);
        adsLoader = new google.ima.AdsLoader(adc);
        adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
        adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, function () {
          tryNextVast(isPreroll);
        });
        adc.initialize();
        requestPrerollIfNeeded();
      } catch (e) {
        log("IMA init failed", e);
        fallbackToContent();
      }
    }

    function fallbackToContent() {
      isPreroll = false;
      clearPrerollTimer();
      if (viewable) video.play().catch(function () {});
    }

    requestAnimationFrame(function () {
      ensureIMAReady().then(initIMA).catch(function () {
        log("IMA SDK failed to load");
        fallbackToContent();
      });
    });

    prefetchObserver = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      requestPrerollIfNeeded();
      prefetchObserver.disconnect();
    }, { root: null, rootMargin: PREROLL_PREFETCH_MARGIN, threshold: 0.01 });

    prefetchObserver.observe(container);

    viewObserver = new IntersectionObserver(function (entries) {
      viewable = entries[0].intersectionRatio >= 0.1;
      if (viewable && adsManagerReady && !playerKilled) startAdsIfViewable();
      if (adPlaying || isPreroll || playerKilled) return;
      if (viewable) video.play().catch(function () {});
      else if (!isFloating) video.pause();
    }, { threshold: 0.1 });

    viewObserver.observe(container);

    function syncPPIcon() {
      if (ppIcon) ppIcon.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE;
      if (video.paused && !isPreroll && !adPlaying) container.setAttribute("data-paused", "true");
      else container.removeAttribute("data-paused");
    }

    ppOverlay.addEventListener("click", function () {
      if (adPlaying || isPreroll || playerKilled) return;
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });

    syncPPIcon();

    video.addEventListener("pause", syncPPIcon);
    video.addEventListener("playing", syncPPIcon);

    video.addEventListener("playing", function () {
      thumbnail.style.display = "none";
      video.style.opacity = 1;
      container.setAttribute("data-ready", "true");
    });

    video.addEventListener("error", function () {
      log("content video error");
      teardown();
    });

    video.addEventListener("timeupdate", function () {
      if (progressFill && isFinite(video.duration) && video.duration > 0) {
        progressFill.style.width = ((video.currentTime / video.duration) * 100) + "%";
      }
      if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
      if (playerKilled || midrollPlaying || isPreroll || !viewable) return;
      if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
        lastMidrollTime = video.currentTime;
        midrollPlaying = true;
        requestAds(true);
      }
    });

    video.addEventListener("ended", function () {
      if (!adsLoader) return;
      try { adsLoader.contentComplete(); } catch (e) {}
    });

    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) video.pause();
      else if (!adPlaying && !isPreroll && viewable && !playerKilled) video.play().catch(function () {});
    });

    window.addEventListener("pagehide", teardown, { once: true });

    muteBtn.addEventListener("click", function () {
      var m = !video.muted;
      video.muted = m;
      if (adsManager) {
        try { adsManager.setVolume(m ? 0 : 1); } catch (e) {}
      }
      muteBtn.innerHTML = muteSvg(m ? MUTE_PATH_OFF : MUTE_PATH_ON);
    });

    closeBtn.addEventListener("click", function () {
      userDismissedFloat = true;
      returnToInline();
      if (!adPlaying) video.pause();
    });

  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

})();

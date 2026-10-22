<!--
  GN MOBILE WEB STICKY OSV PLAYER — GAM 1x1 CUSTOM CREATIVE

  Traffic as a Custom creative, size 1x1.
  "Serve into a SafeFrame" MUST be unchecked. The creative needs a
  friendly iframe so it can reach the page and inject the player
  into its <head>. With SafeFrame on, it logs a warning and stops.

  The player then runs in the page itself, not in this iframe:
  it pins a 130px band directly beneath the sticky
  .header-wrapper, with a 16:9 IMA player on the left and a
  300x250 companion scaled into the space on the right.
-->
<script>
(function () {

  var host;

  try {
    host = window.top;
    void host.document.head;
  } catch (e) {
    try {
      host = window.parent;
      void host.document.head;
    } catch (e2) {
      if (window.console) console.warn('[GN OSV] cannot reach the page — is SafeFrame turned off on this creative?');
      return;
    }
  }

  /* One player per page, even if the 1x1 slot refreshes. */
  if (host.__gnOsvInjected) return;
  host.__gnOsvInjected = true;

  var s = host.document.createElement('script');
  s.id   = 'gn-osv-script';
  s.text = '(' + GN_OSV_PLAYER.toString() + ')();';
  host.document.head.appendChild(s);

  /* ============================================================ */
  /* EVERYTHING BELOW RUNS IN THE PAGE, NOT IN THIS IFRAME.       */
  /* It must not reference anything outside this function.        */
  /* ============================================================ */

  function GN_OSV_PLAYER() {

  'use strict';

  /* ===================================================== */
  /* CONFIG — everything you are likely to change is here  */
  /* ===================================================== */

  var CONFIG = {

    /* --- video ad units --------------------------------- */

    NETWORK_CODE   : '23278934576',
    OSV_BASE_IU    : 'Gulfnews_OSVP',
    OSV_UNIT_PREFIX: 'GN_AMP',         /* -> GN_AMP_Preroll_1 — swap for mweb units if GN creates them */
    AD_UNIT_COUNT  : 2,                /* waterfall depth per break  */

    /* Adds url, vid_d, vid_kw and cust_params to the VAST request.
       Off by default so the tag matches the units exactly as
       trafficked. */
    SEND_EXTRA_PARAMS : false,

    /* --- companion display slot (bar, right side) ------- */

    COMPANION_AD_UNIT   : '/23278934576/Gulfnews_OSVP/GN_AMP_300x250',
    COMPANION_SIZE      : [300, 250],
    COMPANION_REFRESH_MS: 30000,
    COMPANION_FIT       : 'contain',   /* 'contain' | 'cover' */

    /* --- content ---------------------------------------- */

    CONTENT_TYPE : 'direct',           /* 'direct' | 'mrss'          */

    CONTENT_SRC  : 'https://r1---sn-u1qxac-54.c.2mdn.net/videoplayback/id/1f2ac817f265c7b2/itag/346/source/web_video_ads/xpc/EgVovf3BOg%3D%3D/ctier/L/acao/yes/ip/0.0.0.0/ipbits/0/expire/3895712126/sparams/acao,ctier,expire,id,ip,ipbits,itag,met,mh,mip,mm,mn,ms,mv,mvi,pl,rms,source,xpc/signature/332D6811C1F010A6297E6A059BB51E828E2D726F.49E235FB96029643E8C5F953317564669EA96B85/key/cms1/cms_redirect/yes/met/1777925394,/mh/t-/mip/103.187.137.98/mm/42/mn/sn-u1qxac-54/ms/onc/mt/1777925030/mv/u/mvi/1/pl/24/rms/onc,onc/file/file.mp4',

    FALLBACK_SRC : '',

    THUMBNAIL    : 'https://images.assettype.com/gulfnews/2026-09-18/l3x0ukro/gn-logo-sonic-dark-blue.svg',

    /* --- placement -------------------------------------- */

    HEADER_SELECTOR  : '.header-wrapper',
    HEADER_WAIT_MS   : 5000,   /* if the header never appears, stick at top:0 */
    BAR_HEIGHT       : 130,
    MOBILE_MAX_WIDTH : 767,    /* wider viewports get no player */
    Z_INDEX          : 0,      /* 0 = auto: one below the header's z-index */
    SHOW_CLOSE       : true,

    /* --- behaviour -------------------------------------- */

    MIDROLL_INTERVAL_S       : 15,
    DEFAULT_DURATION_S       : 900,
    CONTENT_START_TIMEOUT_MS : 3000,

    LANG    : 'en',
    VID_KW  : 'news, gulf, UAE News, crude oil price, gold price, AED, Tourism',
    SECTION : 'gulfnews',

    /* --- session capping (0 = off) ---------------------- */

    MAX_IMPRESSIONS_PER_SESSION : 0,
    FREQUENCY_CAP_MINUTES       : 0
  };

  var PLAYER_ASPECT = 16 / 9;

  var IMA_SRC = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
  var HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
  var GPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

  var LOG = '[GN OSV]';

  var DEBUG = (function () {
    try { return new URL(location.href).searchParams.get('gndebug') === '1'; }
    catch (e) { return false; }
  })();

  function dlog() {
    if (!DEBUG || !window.console) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift(LOG);
    console.log.apply(console, a);
  }

  /* ===================================================== */
  /* GATES — mobile only, session capping                  */
  /* ===================================================== */

  var viewportW = document.documentElement.clientWidth || window.innerWidth;

  if (viewportW > CONFIG.MOBILE_MAX_WIDTH) {
    dlog('viewport', viewportW, 'is wider than', CONFIG.MOBILE_MAX_WIDTH, '— not mobile, exiting');
    return;
  }

  var HOST = location.hostname.replace(/^www\./, '');

  if (CONFIG.MAX_IMPRESSIONS_PER_SESSION > 0 || CONFIG.FREQUENCY_CAP_MINUTES > 0) {

    try {
      var SESSION_KEY = 'gnosv_session:' + HOST;
      var now   = Date.now();
      var store = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');

      if (CONFIG.MAX_IMPRESSIONS_PER_SESSION > 0 &&
          (store.impressions || 0) >= CONFIG.MAX_IMPRESSIONS_PER_SESSION) {
        dlog('session impression cap reached');
        return;
      }

      if (CONFIG.FREQUENCY_CAP_MINUTES > 0 && store.lastSeen &&
          (now - store.lastSeen) < CONFIG.FREQUENCY_CAP_MINUTES * 60000) {
        dlog('frequency cap active');
        return;
      }

      store.impressions = (store.impressions || 0) + 1;
      store.lastSeen    = now;

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(store));

    } catch (e) {}
  }

  /* ===================================================== */
  /* PAGE URL                                              */
  /* ===================================================== */

  function getPageUrl() {
    try {
      var c = document.querySelector('link[rel="canonical"]');
      var u = (c && c.href) || location.href;
      return u.split('#')[0];
    } catch (e) {
      return location.href.split('#')[0];
    }
  }

  var PAGE_URL = getPageUrl();

  /* ===================================================== */
  /* HELPERS                                               */
  /* ===================================================== */

  function onReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function loadScript(src, isReady, matchPart) {

    return new Promise(function (resolve) {

      if (isReady()) { resolve(true); return; }

      var el = document.querySelector('script[src*="' + matchPart + '"]');

      if (!el) {
        el = document.createElement('script');
        el.src   = src;
        el.async = true;
        document.head.appendChild(el);
      }

      var done = false;

      function finish() {
        if (done) return;
        done = true;
        resolve(isReady());
      }

      el.addEventListener('load',  finish);
      el.addEventListener('error', finish);

      /* already-present tag that finished loading before we got here */
      setTimeout(finish, 8000);
    });
  }

  function waitForHeader() {

    return new Promise(function (resolve) {

      var el = document.querySelector(CONFIG.HEADER_SELECTOR);
      if (el) { resolve(el); return; }

      var mo = new MutationObserver(function () {
        var found = document.querySelector(CONFIG.HEADER_SELECTOR);
        if (found) {
          mo.disconnect();
          clearTimeout(timer);
          resolve(found);
        }
      });

      mo.observe(document.documentElement, { childList: true, subtree: true });

      var timer = setTimeout(function () {
        mo.disconnect();
        resolve(null);
      }, CONFIG.HEADER_WAIT_MS);
    });
  }

  /* ===================================================== */
  /* STYLES                                                */
  /* ===================================================== */

  var H = CONFIG.BAR_HEIGHT;

  var CSS = [
    '#gn-osv-spacer{display:block;width:100%;height:' + H + 'px;margin:0;padding:0;border:0;}',

    '#gn-osv-bar{position:fixed;left:0;right:0;top:0;width:100%;height:' + H + 'px;display:flex;align-items:stretch;background:#fff;margin:0;padding:0;border:0;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.2);-webkit-transform:translateZ(0);transform:translateZ(0);}',
    '#gn-osv-bar *{box-sizing:border-box;}',

    '#gn-osv-player{position:relative;height:100%;background:#000;flex:0 0 auto;overflow:hidden;margin:0;padding:0;}',

    '#gn-osv-video{width:100%!important;height:100%!important;max-width:none!important;object-fit:contain;background:#000;display:block;opacity:0;margin:0;padding:0;border:0;}',

    '#gn-osv-ad{position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;z-index:1;pointer-events:none;}',
    '#gn-osv-ad>iframe,#gn-osv-ad>video,#gn-osv-ad>div{width:100%!important;height:100%!important;}',

    '#gn-osv-thumb{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:#000;z-index:4;}',
    '#gn-osv-thumb img{max-width:90%!important;max-height:90%!important;width:auto;height:auto;object-fit:contain;pointer-events:none;-webkit-user-select:none;user-select:none;border:0;}',

    '#gn-osv-companion-wrap{flex:1 1 auto;height:100%;background:#052c65;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:0;padding:0;}',
    '#gn-osv-companion{width:300px;height:250px;transform-origin:center center;flex-shrink:0;margin:0!important;padding:0!important;}',
    '#gn-osv-companion iframe{width:300px!important;height:250px!important;}',

    '#gn-osv-bar .gn-osv-btn{position:absolute;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.15);border-radius:50%;cursor:pointer;background:rgba(255,255,255,.9);box-shadow:0 3px 10px rgba(0,0,0,.25);color:#000;padding:0;margin:0;line-height:1;min-width:0;min-height:0;font:inherit;-webkit-appearance:none;appearance:none;transition:background .2s ease,transform .2s ease;}',
    '#gn-osv-bar .gn-osv-btn:active{transform:scale(.95);}',

    '#gn-osv-mute{left:10px;bottom:10px;z-index:3;display:none!important;}',
    '#gn-osv-mute.gn-osv-show{display:flex!important;}',

    '#gn-osv-pp{top:50%;left:50%;transform:translate(-50%,-50%) scale(.9);border:1.5px solid rgba(0,0,0,.2)!important;box-shadow:0 4px 18px rgba(0,0,0,.3)!important;z-index:2;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease!important;}',
    '#gn-osv-player:not([data-ad-playing="true"]):hover #gn-osv-pp,',
    '#gn-osv-player[data-touch-show="true"]:not([data-ad-playing="true"]) #gn-osv-pp{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1);}',
    '#gn-osv-bar #gn-osv-pp:active{transform:translate(-50%,-50%) scale(.93);}',

    '#gn-osv-close{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);border:0;display:flex;align-items:center;justify-content:center;padding:0;margin:0;cursor:pointer;z-index:10;-webkit-appearance:none;appearance:none;min-width:0;min-height:0;}'
  ].join('\n');

  /* ===================================================== */
  /* ICONS                                                 */
  /* ===================================================== */

  function iconMuted(s) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 9 7 9 12 5 12 19 7 15 3 15"/><line x1="16" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="16" y2="15"/></svg>';
  }

  function iconUnmuted(s) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 9 7 9 12 5 12 19 7 15 3 15"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8"/><path d="M18.5 5.5c3 3 3 10 0 13"/></svg>';
  }

  function iconPlay(s) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="black"><path d="M6 4l14 8-14 8z"/></svg>';
  }

  function iconPause(s) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="black"><path d="M5 4h5v16H5zM14 4h5v16h-5z"/></svg>';
  }

  function iconClose() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
  }

  /* ===================================================== */
  /* STATE                                                 */
  /* ===================================================== */

  var bar, spacer, playerEl, video, adContainer, thumb, thumbImg,
      muteBtn, ppBtn, closeBtn, companionWrap, companion, headerEl;

  var hls                = null;
  var adsManager         = null;
  var adDisplayContainer = null;
  var companionSlot      = null;
  var refreshTimer       = null;

  var adPlaying      = false;
  var pendingPlay    = false;
  var isMuted        = true;
  var muteGuard      = false;
  var lastMidroll    = 0;
  var midrollRunning = false;
  var prerollDone    = false;
  var closed         = false;
  var companionScale = 1;

  /* ===================================================== */
  /* BUILD                                                 */
  /* ===================================================== */

  function build() {

    if (!document.getElementById('gn-osv-style')) {
      var style = document.createElement('style');
      style.id = 'gn-osv-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    spacer = document.createElement('div');
    spacer.id = 'gn-osv-spacer';

    bar = document.createElement('div');
    bar.id = 'gn-osv-bar';

    bar.innerHTML =
      '<div id="gn-osv-player">' +
        '<div id="gn-osv-thumb"><img id="gn-osv-thumb-img" alt=""></div>' +
        '<video id="gn-osv-video" muted playsinline webkit-playsinline preload="metadata"></video>' +
        '<div id="gn-osv-ad"></div>' +
        '<button type="button" id="gn-osv-pp" class="gn-osv-btn" aria-label="Play or pause"></button>' +
        '<button type="button" id="gn-osv-mute" class="gn-osv-btn" aria-label="Mute or unmute"></button>' +
      '</div>' +
      '<div id="gn-osv-companion-wrap"><div id="gn-osv-companion"></div></div>' +
      (CONFIG.SHOW_CLOSE
        ? '<button type="button" id="gn-osv-close" aria-label="Close">' + iconClose() + '</button>'
        : '');

    /* Spacer goes in the flow right after the header, so the band
       never covers content on first view. The band itself is
       fixed and tracks the header's bottom edge. */
    if (headerEl && headerEl.parentNode) {
      headerEl.parentNode.insertBefore(spacer, headerEl.nextSibling);
    } else {
      document.body.insertBefore(spacer, document.body.firstChild);
    }

    document.body.appendChild(bar);

    playerEl      = document.getElementById('gn-osv-player');
    video         = document.getElementById('gn-osv-video');
    adContainer   = document.getElementById('gn-osv-ad');
    thumb         = document.getElementById('gn-osv-thumb');
    thumbImg      = document.getElementById('gn-osv-thumb-img');
    muteBtn       = document.getElementById('gn-osv-mute');
    ppBtn         = document.getElementById('gn-osv-pp');
    closeBtn      = document.getElementById('gn-osv-close');
    companionWrap = document.getElementById('gn-osv-companion-wrap');
    companion     = document.getElementById('gn-osv-companion');

    video.muted  = true;
    thumbImg.src = CONFIG.THUMBNAIL;

    bar.style.zIndex = String(resolveZIndex());

    bindControls();
  }

  /* ===================================================== */
  /* STICKY POSITION — directly beneath .header-wrapper    */
  /* ===================================================== */

  function resolveZIndex() {

    if (CONFIG.Z_INDEX) return CONFIG.Z_INDEX;

    /* Sit one below the header (or whichever ancestor carries its
       stacking z-index) so header menus still open over the band. */
    var el = headerEl;

    while (el && el !== document.body && el !== document.documentElement) {
      var z = parseInt(getComputedStyle(el).zIndex, 10);
      if (isFinite(z) && z > 1) return z - 1;
      el = el.parentElement;
    }

    return 999;
  }

  function headerBottom() {

    if (!headerEl || !headerEl.isConnected) return 0;

    var cs = getComputedStyle(headerEl);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;

    return Math.max(0, Math.round(headerEl.getBoundingClientRect().bottom));
  }

  var currentTop = -1;

  function position() {

    if (closed) return;

    var t = headerBottom();

    if (t !== currentTop) {
      currentTop = t;
      bar.style.top = t + 'px';
    }
  }

  /* The header can move without a scroll event (hide-on-scroll
     transitions, height changes), so after any trigger keep
     tracking for half a second of animation frames. */
  var trackUntil = 0;
  var tracking   = false;

  function kick() {

    trackUntil = Date.now() + 500;

    if (tracking) return;
    tracking = true;

    (function loop() {
      position();
      if (!closed && Date.now() < trackUntil) requestAnimationFrame(loop);
      else tracking = false;
    })();
  }

  var headerRO = null;

  function bindPositioning() {

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);

    if (headerEl) {
      headerEl.addEventListener('transitionend', kick);
      headerEl.addEventListener('animationend', kick);

      if (window.ResizeObserver) {
        headerRO = new ResizeObserver(kick);
        headerRO.observe(headerEl);
      }
    }

    position();
  }

  function onResize() { layout(); kick(); }
  function onOrientation() { setTimeout(function () { layout(); kick(); }, 200); }

  /* ===================================================== */
  /* LAYOUT — player 16:9 off bar height, companion scaled */
  /* ===================================================== */

  function layout() {

    if (closed) return;

    var barW = document.documentElement.clientWidth || window.innerWidth;
    var barH = CONFIG.BAR_HEIGHT;

    var cw = CONFIG.COMPANION_SIZE[0];
    var ch = CONFIG.COMPANION_SIZE[1];

    var playerW = Math.round(barH * PLAYER_ASPECT);
    if (playerW > barW) playerW = barW;

    var bandW = Math.max(barW - playerW, 0);

    var scaleByWidth  = bandW / cw;
    var scaleByHeight = barH  / ch;

    companionScale = (CONFIG.COMPANION_FIT === 'contain')
      ? Math.min(scaleByWidth, scaleByHeight)
      : Math.max(scaleByWidth, scaleByHeight);

    if (!isFinite(companionScale) || companionScale <= 0) companionScale = 0.01;

    playerEl.style.width    = playerW + 'px';
    playerEl.style.minWidth = playerW + 'px';

    companionWrap.style.flex  = '0 0 ' + bandW + 'px';
    companionWrap.style.width = bandW + 'px';

    companion.style.transform = 'scale(' + companionScale.toFixed(4) + ')';

    if (DEBUG) {
      var slotIframe = companion.getElementsByTagName('iframe')[0];
      dlog('bar', barW + 'x' + barH,
           '| top', currentTop,
           '| z', bar.style.zIndex,
           '| player', playerW + 'x' + barH,
           '| band', bandW + 'x' + barH,
           '| scale', companionScale.toFixed(3),
           '| gpt iframe',
           slotIframe ? slotIframe.offsetWidth + 'x' + slotIframe.offsetHeight : 'not yet rendered');
    }

    var small   = barH < 200;
    var btnSize = small ? 40 : 50;
    var ppSize  = small ? 52 : 64;

    muteBtn.style.width  = btnSize + 'px';
    muteBtn.style.height = btnSize + 'px';
    syncMuteIcon();

    ppBtn.style.width  = ppSize + 'px';
    ppBtn.style.height = ppSize + 'px';
    syncPPIcon();

    if (adsManager) {
      try {
        adsManager.resize(playerEl.clientWidth, playerEl.clientHeight,
          google.ima.ViewMode.NORMAL);
      } catch (e) {}
    }
  }

  /* ===================================================== */
  /* COMPANION 300x250 (GPT, in the page)                  */
  /* ===================================================== */

  /* The page already runs GPT with its own settings, so nothing
     here touches page-level config: no enableSingleRequest, no
     disableInitialLoad, no pubads().setTargeting. Targeting is
     set on this slot only. */

  function loadCompanion() {

    window.googletag = window.googletag || { cmd: [] };

    if (!document.querySelector('script[src*="securepubads.g.doubleclick.net/tag/js/gpt"]')) {
      var g = document.createElement('script');
      g.src   = GPT_SRC;
      g.async = true;
      document.head.appendChild(g);
    }

    googletag.cmd.push(function () {

      if (closed) return;

      companionSlot = googletag.defineSlot(
        CONFIG.COMPANION_AD_UNIT,
        [CONFIG.COMPANION_SIZE],
        'gn-osv-companion'
      );

      if (!companionSlot) { dlog('companion defineSlot failed'); return; }

      companionSlot.addService(googletag.pubads());
      companionSlot.setTargeting('ptype', ['mweb']);
      companionSlot.setTargeting('plcmt', ['sticky']);

      googletag.pubads().addEventListener('slotRenderEnded', function (event) {

        if (event.slot !== companionSlot) return;

        setTimeout(layout, 50);

        dlog('companion rendered —',
          'empty:', event.isEmpty,
          '| size:', JSON.stringify(event.size),
          '| line item:', event.lineItemId,
          '| creative:', event.creativeId);
      });

      if (!googletag.pubadsReady) googletag.enableServices();

      googletag.display('gn-osv-companion');

      /* If the page holds the initial load (e.g. for Prebid),
         display() alone will not fetch — request it directly. */
      var held = false;
      try { held = googletag.pubads().isInitialLoadDisabled(); } catch (e) {}
      if (held) googletag.pubads().refresh([companionSlot]);

      if (CONFIG.COMPANION_REFRESH_MS > 0) {
        refreshTimer = setInterval(function () {
          if (closed || document.hidden) return;
          googletag.cmd.push(function () {
            if (companionSlot) googletag.pubads().refresh([companionSlot]);
          });
        }, CONFIG.COMPANION_REFRESH_MS);
      }
    });
  }

  /* ===================================================== */
  /* VAST                                                  */
  /* ===================================================== */

  function buildIU(type, index) {
    return '/' + CONFIG.NETWORK_CODE +
           '/' + CONFIG.OSV_BASE_IU +
           '/' + CONFIG.OSV_UNIT_PREFIX + '_' + type + '_' + index;
  }

  function contentDuration() {
    return (isFinite(video.duration) && video.duration > 0)
      ? Math.floor(video.duration)
      : CONFIG.DEFAULT_DURATION_S;
  }

  function buildTag(type, index) {

    var tag = 'https://pubads.g.doubleclick.net/gampad/ads' +
      '?iu='              + encodeURIComponent(buildIU(type, index)) +
      '&description_url=' + encodeURIComponent(PAGE_URL) +
      '&tfcd=0' +
      '&npa=0' +
      '&sz=300x250%7C400x300%7C640x360%7C640x480%7C800x450' +
      '&gdfp_req=1' +
      '&unviewed_position_start=1' +
      '&output=vast' +
      '&env=vp' +
      '&vpmute='          + (isMuted ? 1 : 0) +
      '&impl=s' +
      '&correlator='      + Date.now();

    if (CONFIG.SEND_EXTRA_PARAMS) {

      tag += '&url='    + encodeURIComponent(PAGE_URL) +
             '&vid_d='  + contentDuration() +
             '&vid_kw=' + encodeURIComponent(CONFIG.VID_KW) +
             '&cust_params=' + encodeURIComponent(
               'category=news' +
               '&section='  + CONFIG.SECTION +
               '&format=video' +
               '&lang='     + CONFIG.LANG +
               '&ptype=mweb' +
               '&plcmt=sticky' +
               '&autoplay=1' +
               '&muted='    + (isMuted ? 1 : 0)
             );
    }

    return tag;
  }

  /* ===================================================== */
  /* CONTROLS                                              */
  /* ===================================================== */

  function isSmall() { return CONFIG.BAR_HEIGHT < 200; }

  function syncMuteIcon() {
    muteBtn.innerHTML = isMuted
      ? iconMuted(isSmall() ? 18 : 22)
      : iconUnmuted(isSmall() ? 18 : 22);
  }

  function syncPPIcon() {
    ppBtn.innerHTML = video.paused
      ? iconPlay(isSmall() ? 22 : 26)
      : iconPause(isSmall() ? 22 : 26);
  }

  function applyMute(muted) {

    muteGuard   = true;
    isMuted     = muted;
    video.muted = muted;

    if (adsManager) {
      try { adsManager.setVolume(muted ? 0 : 1); } catch (e) {}
    }

    syncMuteIcon();

    setTimeout(function () { muteGuard = false; }, 0);
  }

  var touchTimer = null;

  function bindControls() {

    muteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      applyMute(!isMuted);
    });

    video.addEventListener('volumechange', function () {
      if (muteGuard || adPlaying) return;
      if (video.muted !== isMuted) applyMute(isMuted);
    });

    ppBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (adPlaying) return;
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });

    video.addEventListener('pause',   syncPPIcon);
    video.addEventListener('playing', syncPPIcon);

    playerEl.addEventListener('touchstart', function () {

      playerEl.setAttribute('data-touch-show', 'true');

      if (touchTimer) clearTimeout(touchTimer);

      touchTimer = setTimeout(function () {
        playerEl.removeAttribute('data-touch-show');
      }, 2500);

    }, { passive: true });

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        destroy();
      });
    }

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    document.addEventListener('visibilitychange', onVisibility);
  }

  /* ===================================================== */
  /* CONTENT LOADING                                       */
  /* ===================================================== */

  function clearThumb() {
    if (thumb) thumb.style.display = 'none';
    video.style.opacity = '1';
    muteBtn.classList.add('gn-osv-show');
  }

  function loadDirectSrc(src) {

    if (closed) return;

    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }

    var isHls = src.indexOf('.m3u8') !== -1;

    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {

      video.src = src;
      video.load();

    } else if (isHls) {

      loadScript(HLS_SRC, function () { return !!window.Hls; }, 'hls.js').then(function (ok) {

        if (closed) return;

        if (!ok || !Hls.isSupported()) {
          console.warn(LOG, 'HLS not supported here');
          return;
        }

        hls = new Hls({ enableWorker: true, backBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          if (pendingPlay) { pendingPlay = false; startPlayback(); }
        });

        hls.on(Hls.Events.ERROR, function (evt, data) {
          console.warn(LOG, 'HLS error', data);
        });
      });

    } else {

      video.src = src;
      video.load();
    }

    video.addEventListener('loadedmetadata', function onLoaded() {
      video.removeEventListener('loadedmetadata', onLoaded);
      if (pendingPlay) { pendingPlay = false; startPlayback(); }
    });
  }

  function loadFallback() {

    if (!CONFIG.FALLBACK_SRC) {
      console.warn(LOG, 'no fallback content configured');
      return;
    }

    console.warn(LOG, 'falling back to', CONFIG.FALLBACK_SRC);
    loadDirectSrc(CONFIG.FALLBACK_SRC);
  }

  function parseMrss(xml) {

    try {
      var doc   = new DOMParser().parseFromString(xml, 'text/xml');
      var items = doc.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content');

      if (!items || items.length === 0) items = doc.getElementsByTagName('media:content');
      if (!items || items.length === 0) return null;

      var results = [];

      for (var i = 0; i < items.length; i++) {

        var url = items[i].getAttribute('url') || '';
        if (!url) continue;

        var poster = null;
        var thumbs = items[i].getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail');

        if (!thumbs || thumbs.length === 0) thumbs = items[i].getElementsByTagName('media:thumbnail');
        if (thumbs && thumbs.length > 0) poster = thumbs[0].getAttribute('url') || null;

        results.push({ src: url, poster: poster });
      }

      if (results.length === 0) return null;

      return results[Math.floor(Math.random() * results.length)];

    } catch (e) {
      return null;
    }
  }

  function loadFromMrss(feedUrl) {

    fetch(feedUrl)
      .then(function (res) { return res.text(); })
      .then(function (xml) {

        var result = parseMrss(xml);

        if (!result || !result.src) {
          console.warn(LOG, 'MRSS empty');
          loadFallback();
          return;
        }

        if (result.poster) video.poster = result.poster;

        loadDirectSrc(result.src);
      })
      .catch(function (err) {
        console.warn(LOG, 'MRSS fetch failed —', err);
        loadFallback();
      });
  }

  function loadContent() {
    if (CONFIG.CONTENT_TYPE === 'mrss') loadFromMrss(CONFIG.CONTENT_SRC);
    else loadDirectSrc(CONFIG.CONTENT_SRC);
  }

  /* ===================================================== */
  /* PLAYBACK                                              */
  /* ===================================================== */

  function startPlayback() {

    if (closed) return;

    clearThumb();

    video.muted = isMuted;

    video.play().catch(function (err) {
      console.warn(LOG, 'autoplay blocked', err);
    });

    syncMuteIcon();
    syncPPIcon();
  }

  function playContent() {

    if (closed) return;

    prerollDone = true;

    if (video.readyState >= 2) { startPlayback(); return; }

    pendingPlay = true;

    setTimeout(function () {
      if (pendingPlay) { pendingPlay = false; startPlayback(); }
    }, CONFIG.CONTENT_START_TIMEOUT_MS);
  }

  /* ===================================================== */
  /* AD POD (waterfall, one IMA request per unit)          */
  /* ===================================================== */

  function fireAdPod(breakType, done) {

    var idx = 0;

    function next() {

      if (closed) return;

      if (idx >= CONFIG.AD_UNIT_COUNT) {
        adPlaying = false;
        playerEl.removeAttribute('data-ad-playing');
        adContainer.style.pointerEvents = 'none';
        done();
        return;
      }

      idx++;

      var tag = buildTag(breakType, idx);

      if (adsManager) { try { adsManager.destroy(); } catch (e) {} adsManager = null; }

      var loader = new google.ima.AdsLoader(adDisplayContainer);

      loader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        function (e) {

          if (closed) return;

          adsManager = e.getAdsManager(video);

          try { adsManager.setVolume(isMuted ? 0 : 1); } catch (err) {}

          bindAdEvents(adsManager, next);

          try {
            adsManager.init(playerEl.clientWidth, playerEl.clientHeight,
              google.ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (err) {
            next();
          }
        }
      );

      loader.addEventListener(
        google.ima.AdErrorEvent.Type.AD_ERROR,
        function () { next(); }
      );

      var req = new google.ima.AdsRequest();

      req.adTagUrl = tag;
      req.omidAccessModeRules = { '*': google.ima.OmidAccessMode.FULL };

      req.setAdWillAutoPlay(true);
      req.setAdWillPlayMuted(isMuted);
      req.setContinuousPlayback(true);

      req.linearAdSlotWidth     = 640;
      req.linearAdSlotHeight    = 360;
      req.nonLinearAdSlotWidth  = 640;
      req.nonLinearAdSlotHeight = 360;

      loader.requestAds(req);
    }

    next();
  }

  function bindAdEvents(mgr, next) {

    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      next();
    }

    mgr.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, finish);

    mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, function () {
      adPlaying = true;
      video.pause();
    });

    mgr.addEventListener(google.ima.AdEvent.Type.STARTED, function () {
      adPlaying = true;
      playerEl.setAttribute('data-ad-playing', 'true');
      adContainer.style.pointerEvents = 'auto';
      clearThumb();
    });

    mgr.addEventListener(google.ima.AdEvent.Type.COMPLETE, finish);
    mgr.addEventListener(google.ima.AdEvent.Type.SKIPPED,  finish);

    mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, function () {
      adPlaying = false;
      playerEl.removeAttribute('data-ad-playing');
      adContainer.style.pointerEvents = 'none';
    });
  }

  /* ===================================================== */
  /* MIDROLL / LOOP / VISIBILITY                           */
  /* ===================================================== */

  function onTimeUpdate() {

    if (closed || !prerollDone || adPlaying || midrollRunning) return;

    if (video.currentTime < lastMidroll) lastMidroll = 0;

    if (video.currentTime - lastMidroll >= CONFIG.MIDROLL_INTERVAL_S) {

      lastMidroll    = video.currentTime;
      midrollRunning = true;

      fireAdPod('Midroll', function () {
        midrollRunning = false;
        video.play().catch(function () {});
        applyMute(isMuted);
      });
    }
  }

  function onEnded() {

    if (closed) return;

    lastMidroll = 0;

    if (CONFIG.CONTENT_TYPE === 'mrss') {
      loadContent();
      pendingPlay = true;
    } else {
      video.currentTime = 0;
      video.play().catch(function () {});
    }
  }

  function onVisibility() {

    if (closed) return;

    if (document.hidden) {
      if (!adPlaying) video.pause();
    } else {
      if (!adPlaying && prerollDone) video.play().catch(function () {});
    }
  }

  /* ===================================================== */
  /* CLOSE                                                 */
  /* ===================================================== */

  function destroy() {

    if (closed) return;
    closed = true;

    try { if (adsManager) adsManager.destroy(); } catch (e) {}
    adsManager = null;

    try { if (adDisplayContainer) adDisplayContainer.destroy(); } catch (e) {}

    try { if (hls) hls.destroy(); } catch (e) {}
    hls = null;

    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}

    if (refreshTimer) clearInterval(refreshTimer);

    if (companionSlot && window.googletag) {
      var s = companionSlot;
      googletag.cmd.push(function () { googletag.destroySlots([s]); });
      companionSlot = null;
    }

    window.removeEventListener('scroll', kick);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
    document.removeEventListener('visibilitychange', onVisibility);

    if (headerEl) {
      headerEl.removeEventListener('transitionend', kick);
      headerEl.removeEventListener('animationend', kick);
    }

    if (headerRO) { try { headerRO.disconnect(); } catch (e) {} }

    /* If the spacer is already scrolled past, removing it would
       jerk the article up by the bar height — compensate. */
    var compensate = 0;

    try {
      if (spacer.getBoundingClientRect().bottom <= currentTop) {
        compensate = spacer.offsetHeight;
      }
    } catch (e) {}

    if (bar && bar.parentNode)       bar.parentNode.removeChild(bar);
    if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);

    if (compensate) window.scrollBy(0, -compensate);

    dlog('closed by user');
  }

  /* ===================================================== */
  /* INIT                                                  */
  /* ===================================================== */

  function initIma() {

    if (closed) return;

    if (!window.google || !google.ima) {
      console.warn(LOG, 'IMA SDK unavailable — playing content only');
      loadContent();
      pendingPlay = true;
      prerollDone = true;
      return;
    }

    try {
      google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.ENABLED);
      google.ima.settings.setLocale(CONFIG.LANG);
      google.ima.settings.setFeatureFlags({ enableOmidExperimentally: true });
    } catch (e) {}

    adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, video);
    adDisplayContainer.initialize();

    loadContent();

    fireAdPod('Preroll', playContent);
  }

  onReady(function () {

    if (document.getElementById('gn-osv-bar')) return;

    waitForHeader().then(function (el) {

      headerEl = el;

      if (!headerEl) {
        console.warn(LOG, CONFIG.HEADER_SELECTOR, 'not found — sticking at top:0');
      }

      build();
      bindPositioning();
      layout();
      syncMuteIcon();
      syncPPIcon();
      loadCompanion();

      loadScript(IMA_SRC,
        function () { return !!(window.google && google.ima && google.ima.AdsLoader); },
        'imasdk.googleapis.com/js/sdkloader/ima3'
      ).then(function () {
        setTimeout(initIma, 300);
      });
    });
  });

  }

})();
</script>

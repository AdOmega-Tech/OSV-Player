/*!
 * TV9 AMP In-Article Video Player
 *
 * Dependencies (must be loaded before this file):
 *   https://imasdk.googleapis.com/js/sdkloader/ima3.js
 *   https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js
 */

(function () {
  'use strict';

  /* ════ DOMAIN → LANGUAGE MAP ════════════════════════════════
     Add or update entries as new language sites go live.
     Key   : bare hostname (no www.)
     Value : language label used in the DFP ad unit path
  ═══════════════════════════════════════════════════════════ */
  var DOMAIN_MAP = {
    'tv9hindi.com'   : 'Hindi',
    'tv9telugu.com'  : 'Telugu',
    'tv9marathi.com' : 'Marathi',
    'tv9bangla.com'  : 'Bangla',
    'tv9kannada.com' : 'Kannada'
  };

  /* ════ DOMAIN → CONTENT SOURCE MAP ══════════════════════════
     Set a unique HLS manifest URL per language site.
     Falls back to DEFAULT_CONTENT_SRC if domain is not listed.
  ═══════════════════════════════════════════════════════════ */
  var CONTENT_MAP = {
    'tv9hindi.com'   : 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8',
    'tv9telugu.com'  : 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8',
    'tv9marathi.com' : 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8',
    'tv9bangla.com'  : 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8',
    'tv9kannada.com' : 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8'
  };
  var DEFAULT_CONTENT_SRC = 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8';

  /* ════ AD UNIT CONFIG ════════════════════════════════════════
     Network prefix and number of preroll / midroll slots.
     Ad unit path pattern:
       /<NETWORK_CODE>/<BASE_IU>/TV9_AMP_<Lang>_<Type>_<N>
     e.g. /23278934576/TV9_OSV/TV9_AMP_Hindi_Preroll_1
  ═══════════════════════════════════════════════════════════ */
  var NETWORK_CODE  = '23278934576';
  var BASE_IU       = 'TV9_OSV';
  var AD_UNIT_COUNT = 2; // number of preroll AND midroll slots each

  /* ════ MIDROLL CUE POINTS ════════════════════════════════════
     Seconds at which midroll pods fire. Add / remove freely.
  ═══════════════════════════════════════════════════════════ */
  var MIDROLL_PODS = [5, 10, 15, 20, 25, 30, 40];

  /* ════ LANGUAGE / CONTENT DETECTION ═════════════════════════ */
  var host        = window.location.hostname.replace('www.', '');
  var LANG        = DOMAIN_MAP[host]    || 'Hindi';   // fallback language
  var CONTENT_SRC = CONTENT_MAP[host]   || DEFAULT_CONTENT_SRC;
  var PAGE_URL    = encodeURIComponent(window.location.href);

  /* ════ DYNAMIC VAST BUILDER ══════════════════════════════════
     buildBaseVastUrl(type, index)
       type  : 'Preroll' or 'Midroll'
       index : 1-based slot number
     Produces the base VAST URL. Dynamic per-request params
     (vid_d, vpmute, correlator, etc.) are appended later
     by buildAdParams() at request time.
  ═══════════════════════════════════════════════════════════ */
  function buildIU(type, index) {
    return '/' + NETWORK_CODE + '/' + BASE_IU + '/TV9_AMP_' + LANG + '_' + type + '_' + index;
  }

  function buildBaseVastUrl(type, index) {
    var iu       = buildIU(type, index);
    var position = type.toLowerCase(); // 'preroll' | 'midroll'
    return 'https://pubads.g.doubleclick.net/gampad/ads'
      + '?iu='  + encodeURIComponent(iu)
      + '&tfcd=0&npa=0'
      + '&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250'
      + '&gdfp_req=1&unviewed_position_start=1&output=vast'
      + '&env=instream&vpos=' + position
      + '&impl=s&plcmt=2'
      + '&vad_type=linear&ad_type=audio_video'
      + '&vpw=640&vph=360'
      + '&min_ad_duration=5000&max_ad_duration=60000';
  }

  /* Build waterfall arrays dynamically from AD_UNIT_COUNT */
  function buildWaterfall(type) {
    var arr = [];
    for (var i = 1; i <= AD_UNIT_COUNT; i++) {
      arr.push(buildBaseVastUrl(type, i));
    }
    return arr;
  }

  var VAST = {
    preroll : buildWaterfall('Preroll'),
    midroll : buildWaterfall('Midroll')
  };
  /* ════ END CONFIG ═════════════════════════════════════════ */

  /* ── DOM ── */
  var shell        = document.getElementById('AO-player-shell');
  var anchor       = document.getElementById('player-anchor');
  var video        = document.getElementById('content-video');
  var adContainer  = document.getElementById('ad-container');
  var spinner      = document.getElementById('spinner');
  var bigPlay      = document.getElementById('big-play');
  var adBadge      = document.getElementById('ad-badge');
  var unmuteNudge  = document.getElementById('unmute-nudge');
  var floatClose   = document.getElementById('float-close');
  var btnPlay      = document.getElementById('btn-play');
  var iconPlay     = document.getElementById('icon-play');
  var iconPause    = document.getElementById('icon-pause');
  var progressWrap = document.getElementById('progress-wrap');
  var progressFill = document.getElementById('progress-fill');
  var midrollMark  = document.getElementById('midroll-marker');
  var timeDisp     = document.getElementById('time-display');
  var btnMute      = document.getElementById('btn-mute');
  var iconVol      = document.getElementById('icon-vol');
  var iconMuteIco  = document.getElementById('icon-mute');
  var volRange     = document.getElementById('vol-range');
  var btnFs        = document.getElementById('btn-fs');

  /* ── Guard: bail if player markup is not on this page ── */
  if (!shell || !video) return;

  /* ── State ── */
  var adDC, imaLoader, adsManager;
  var adPlaying      = false;
  var midrollFired   = {};
  var isFloating     = false;
  var floatDismissed = false;
  var origW = 0, origH = 0;
  var nudgeTimer     = null;
  var firstPlay      = true;
  var userMuted      = true;
  var hasStarted     = false;

  /* ── Helpers ── */
  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function shellW() { return shell.offsetWidth  || 640; }
  function shellH() { return shell.offsetHeight || 360; }
  function getVPMute() { return video.muted ? 1 : 0; }

  var DEFAULT_VIDEO_DURATION = 900;
  function getVideoDurationForAds() {
    return Number.isFinite(video.duration) && video.duration > 0
      ? Math.floor(video.duration)
      : DEFAULT_VIDEO_DURATION;
  }
  function buildAdParams() {
    return "&description_url=" + PAGE_URL
      + "&vid_t=" + encodeURIComponent(document.title)
      + "&vid_kw=" + encodeURIComponent("stock market, investing, finance, crude oil price, gold price, rupees, news, share market")
      + "&vid_d=" + getVideoDurationForAds()
      + "&vpmute=" + getVPMute()
      + "&cust_params=" + encodeURIComponent("category=news" + "&section=india" + "&format=video" + "&lang=en" + "&ptype=outstream" + "&plcmt=sticky")
      + "&correlator=" + Date.now();
  }

  /* ══════════════════════════════════════════════════════════
     WATERFALL AD POD
     ──────────────────────────────────────────────────────────
     fireAdPod(vastList, onPodComplete)
       vastList      – full array of VAST URLs for this break
       onPodComplete – callback fired after ALL tags have played
                       (or errored out). Typically → playContent()

     Internally it maintains a queue index and fires each tag
     in sequence via _fireNext(). On ALL_ADS_COMPLETED or any
     ad error it advances to the next tag; when the queue is
     exhausted it calls onPodComplete.
  ══════════════════════════════════════════════════════════ */
  function fireAdPod(vastList, onPodComplete) {
    var queue   = vastList.slice(); // copy so we don't mutate the original
    var podIdx  = 0;

    function _fireNext() {
      if (podIdx >= queue.length) {
        // All VAST tags in this pod have been processed
        hideAdUI();
        adPlaying = false;
        onPodComplete();
        return;
      }

      var tagUrl = queue[podIdx++] + buildAdParams();

      // Destroy any previous adsManager before creating a new one
      if (adsManager) {
        try { adsManager.destroy(); } catch(x){}
        adsManager = null;
      }

      var ldr = new google.ima.AdsLoader(adDC);

      ldr.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        function (e) {
          var s = new google.ima.AdsRenderingSettings();
          s.restoreCustomPlaybackStateOnAdBreakComplete = true;
          s.enablePreloading = true;
          // IMA renders its own skip button natively — no uiElements override
          adsManager = e.getAdsManager(video, s);

          // Bind standard events, but override ALL_ADS_COMPLETED
          // to advance the pod queue instead of ending the break
          _bindPodEvents(adsManager, _fireNext);

          try {
            adsManager.init(shellW(), shellH(), google.ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (ex) {
            console.warn('[IMA] pod start() failed:', ex);
            _fireNext(); // skip this tag, try the next
          }
        }
      );

      ldr.addEventListener(
        google.ima.AdErrorEvent.Type.AD_ERROR,
        function (e) {
          console.warn('[IMA pod request error]', e.getError ? e.getError() : e);
          _fireNext(); // tag failed — advance to next in waterfall
        }
      );

      var req = new google.ima.AdsRequest();
      req.adTagUrl              = tagUrl;
      req.linearAdSlotWidth     = shellW();
      req.linearAdSlotHeight    = shellH();
      req.nonLinearAdSlotWidth  = shellW();
      req.nonLinearAdSlotHeight = Math.floor(shellH() / 3);
      ldr.requestAds(req);
    }

    _fireNext(); // kick off the first tag
  }

  /* Bind IMA events for a pod slot.
     advanceFn is called when a single tag's ads are fully done. */
  function _bindPodEvents(mgr, advanceFn) {
    mgr.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR,            function (e) {
      console.warn('[IMA ad error]', e.getError ? e.getError() : e);
      hideAdUI(); adPlaying = false;
      advanceFn();
    });
    mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,  onContentPause);
    mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, function () {
      // Suppress content resume between pod slots — only the pod's
      // onPodComplete callback should actually resume the video.
      adContainer.style.pointerEvents = 'none';
      hideAdUI();
      // Keep video invisible between pod slots — playContent() will restore it.
      // Do NOT call video.pause() — let IMA manage media state between slots.
      video.style.visibility = 'hidden';
    });
    mgr.addEventListener(google.ima.AdEvent.Type.STARTED,                  onAdStarted);
    mgr.addEventListener(google.ima.AdEvent.Type.COMPLETE,                 onAdEnded);
    mgr.addEventListener(google.ima.AdEvent.Type.SKIPPED,                  onAdEnded);
    mgr.addEventListener(google.ima.AdEvent.Type.SKIPPABLE_STATE_CHANGED,  onSkippable);
    mgr.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED,        function () {
      hideAdUI();
      advanceFn(); // move to the next VAST tag in this pod
    });
  }

  /* ── HLS ── */
  function setupHLS() {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = CONTENT_SRC;
      setupIMA();
    } else if (window.Hls && Hls.isSupported()) {
      var hls = new Hls({ autoStartLoad: true, startLevel: -1 });
      hls.loadSource(CONTENT_SRC);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, setupIMA);
      hls.on(Hls.Events.ERROR, function (ev, d) {
        if (d.fatal) console.error('[HLS fatal]', d.type, d.details);
      });
    } else {
      video.src = CONTENT_SRC;
      setupIMA();
    }
  }

  /* ── IMA bootstrap (preroll pod) ── */
  function setupIMA() {
    // Create the AdDisplayContainer now so IMA can preload the ad request,
    // but do NOT call adDC.initialize() yet — on iOS Safari that MUST happen
    // inside a synchronous user-gesture handler or the video creative stays blank.
    adDC = new google.ima.AdDisplayContainer(adContainer, video);
    fireAdPod(VAST.preroll, playContent);
  }

  // Called once on the first user tap anywhere on the player shell.
  // Initializes the AdDisplayContainer inside the gesture stack — required on iOS.
  var adcInitialized = false;
  function initADC() {
    if (adcInitialized || !adDC) return;
    adcInitialized = true;
    adDC.initialize();
  }
  /* ── Ad UI events (shared) ── */
  function onContentPause() {
    adPlaying = true;
    video.style.visibility = 'hidden'; // hide content video beneath ad layer
    adContainer.style.pointerEvents = 'auto';
    adBadge.style.display = 'block';
    spinner.classList.add('hidden');
  }
  function onAdStarted() {
    hasStarted = true;
    adBadge.style.display = 'block';
    try { adsManager.resize(shellW(), shellH(), google.ima.ViewMode.NORMAL); } catch(x){}
  }
  function onSkippable() { /* IMA handles its own skip button */ }
  function onAdEnded() { hideAdUI(); }
  function hideAdUI() {
    adBadge.style.display = 'none';
    adContainer.style.pointerEvents = 'none';
  }
  // IMA handles skip natively — no custom skipBtn listener needed

  /* ── Content playback ── */
  function playContent() {
    adPlaying = false;
    video.style.visibility = 'visible'; // unhide now that the full pod is done
    video.muted = userMuted;
    if (!userMuted) video.volume = Math.max(video.volume || 0.8, 0.5);
    syncMuteIcon();
    var p = video.play();
    if (p && p.catch) {
      p.catch(function (err) {
        console.warn('[Autoplay blocked]', err);
        spinner.classList.add('hidden');
        bigPlay.classList.remove('hidden');
      });
    }
  }

  /* ── Mid-rolls — fire full waterfall pod at each cue ── */
  function fireMidroll(cue) {
    midrollFired[cue] = true;
    // IMA fires CONTENT_PAUSE_REQUESTED when the ad starts — no manual pause needed.
    fireAdPod(VAST.midroll, playContent);
  }

  /* ── Video events ── */
  video.addEventListener('playing', function () {
    hasStarted = true;
    spinner.classList.add('hidden');
    bigPlay.classList.add('hidden');
    iconPlay.style.display  = 'none';
    iconPause.style.display = 'block';
    if (firstPlay && video.muted) {
      firstPlay = false;
      nudgeTimer = setTimeout(function () {
        unmuteNudge.classList.remove('hidden');
        nudgeTimer = setTimeout(function () { unmuteNudge.classList.add('hidden'); }, 5000);
      }, 1500);
    }
  });
  video.addEventListener('pause', function () {
    if (!adPlaying) { iconPlay.style.display = 'block'; iconPause.style.display = 'none'; }
  });
  video.addEventListener('waiting', function () { if (!adPlaying) spinner.classList.remove('hidden'); });
  video.addEventListener('canplay',  function () { spinner.classList.add('hidden'); });

  var markersRendered = false;
  video.addEventListener('timeupdate', function () {
    if (adPlaying || !isFinite(video.duration)) return;
    progressFill.style.width = (video.currentTime / video.duration * 100) + '%';
    timeDisp.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);

    if (!markersRendered) {
      markersRendered = true;
      midrollMark.remove();
      MIDROLL_PODS.forEach(function (cue) {
        if (cue >= video.duration) return;
        var pip = document.createElement('div');
        pip.style.cssText = 'position:absolute;top:-2px;height:8px;width:3px;background:#b08840;border-radius:1px;left:' + (cue / video.duration * 100) + '%';
        progressWrap.appendChild(pip);
      });
    }

    for (var i = 0; i < MIDROLL_PODS.length; i++) {
      var cue = MIDROLL_PODS[i];
      if (!midrollFired[cue] && video.currentTime >= cue) {
        fireMidroll(cue); break;
      }
    }
  });

  /* ── Controls ── */
  // Any tap on the shell initialises the AdDisplayContainer inside a gesture
  // stack — required on iOS for the video creative to render correctly.
  shell.addEventListener('click', function () { initADC(); }, { capture: true });

  btnPlay.addEventListener('click', function () {
    if (adPlaying && adsManager) {
      try {
        // IMA doesn't expose a clean isPaused — check video as proxy
        video.paused ? adsManager.resume() : adsManager.pause();
      } catch(x){}
      return;
    }
    video.paused ? video.play() : video.pause();
  });
  bigPlay.addEventListener('click', function () {
    initADC(); // ensure ADC is initialized on this gesture before playback starts
    bigPlay.classList.add('hidden');
    spinner.classList.remove('hidden');
    playContent();
  });

  function unmute() {
    userMuted = false;
    video.muted = false;
    video.volume = Math.max(video.volume || 0.8, 0.5);
    volRange.value = video.volume;
    if (adPlaying && adsManager) {
      try { adsManager.setVolume(video.volume); } catch(x){}
    }
    syncMuteIcon();
    clearTimeout(nudgeTimer);
    unmuteNudge.classList.add('hidden');
  }
  btnMute.addEventListener('click', function () {
    if (video.muted) {
      unmute();
    } else {
      userMuted = true;
      video.muted = true;
      volRange.value = 0;
      if (adPlaying && adsManager) {
        try { adsManager.setVolume(0); } catch(x){}
      }
      syncMuteIcon();
    }
  });
  unmuteNudge.addEventListener('click', unmute);
  volRange.addEventListener('input', function () {
    var vol = parseFloat(volRange.value);
    video.volume = vol;
    video.muted  = (vol === 0);
    userMuted    = video.muted;
    if (adPlaying && adsManager) {
      try { adsManager.setVolume(vol); } catch(x){}
    }
    syncMuteIcon();
  });
  progressWrap.addEventListener('click', function (e) {
    if (adPlaying || !isFinite(video.duration)) return;
    var r = progressWrap.getBoundingClientRect();
    video.currentTime = ((e.clientX - r.left) / r.width) * video.duration;
  });
  btnFs.addEventListener('click', function () {
    if (document.fullscreenElement) { document.exitFullscreen(); }
    else {
      var fn = shell.requestFullscreen || shell.webkitRequestFullscreen || shell.mozRequestFullScreen;
      if (fn) fn.call(shell);
    }
  });
  document.addEventListener('fullscreenchange', function () {
    if (!adsManager) return;
    var mode = document.fullscreenElement ? google.ima.ViewMode.FULLSCREEN : google.ima.ViewMode.NORMAL;
    try { adsManager.resize(shellW(), shellH(), mode); } catch(x){}
  });

  function syncMuteIcon() {
    var m = video.muted || video.volume === 0;
    iconVol.style.display     = m ? 'none'  : 'block';
    iconMuteIco.style.display = m ? 'block' : 'none';
  }

  /* ── Pause/resume on tab switch ── */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!video.paused) {
        video.pause();
        if (adsManager && adPlaying) { try { adsManager.pause(); } catch(x){} }
      }
    } else {
      if (hasStarted && video.paused && !floatDismissed) {
        if (adPlaying && adsManager) { try { adsManager.resume(); } catch(x){} }
        else { video.play(); }
      }
    }
  });

  /* ── Floating / PiP ── */
  var io = new IntersectionObserver(function (entries) {
    var e = entries[0];
    if (!e.isIntersecting) {
      if (!floatDismissed && (adPlaying || !video.paused)) {
        // Float during both content playback and ad breaks
        enableFloat();
      } else if (!isFloating && !video.paused) {
        video.pause();
        if (adsManager && adPlaying) { try { adsManager.pause(); } catch(x){} }
      }
    } else {
      if (isFloating) disableFloat();
      if (hasStarted && !floatDismissed && video.paused) {
        if (adPlaying && adsManager) { try { adsManager.resume(); } catch(x){} }
        else { video.play(); }
      }
    }
  }, { threshold: 0.2 });
  io.observe(anchor);

  function enableFloat() {
    if (isFloating) return;
    isFloating = true;
    if (!origW) { origW = shell.offsetWidth; origH = shell.offsetHeight; }
    anchor.style.height = origH + 'px';
    shell.classList.add('floating');
    shell.style.width  = Math.round(origW * 0.60) + 'px';
    shell.style.height = Math.round(origH * 0.60) + 'px';
    resizeIMA();
  }
  function disableFloat() {
    if (!isFloating) return;
    isFloating = false;
    shell.classList.remove('floating');
    shell.style.removeProperty('width');
    shell.style.removeProperty('height');
    shell.style.removeProperty('bottom');
    shell.style.removeProperty('right');
    anchor.style.removeProperty('height');
    resizeIMA();
  }
  function resizeIMA() {
    if (!adsManager || !adPlaying) return;
    try { adsManager.resize(shellW(), shellH(), google.ima.ViewMode.NORMAL); } catch(x){}
  }
  window.addEventListener('resize', resizeIMA);

  /* ── Drag in floating mode ── */
  var drag = { on:false, sx:0, sy:0, or:0, ob:0 };
  shell.addEventListener('mousedown', function (e) {
    if (!isFloating) return;
    if (e.target.closest('#controls,#float-close,#big-play,#unmute-nudge')) return;
    drag.on = true;
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.or = parseInt(shell.style.right  || '20', 10);
    drag.ob = parseInt(shell.style.bottom || '55', 10);
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!drag.on) return;
    var nr = Math.max(0, Math.min(drag.or + (drag.sx - e.clientX), window.innerWidth  - shell.offsetWidth  - 8));
    var nb = Math.max(0, Math.min(drag.ob + (drag.sy - e.clientY), window.innerHeight - shell.offsetHeight - 8));
    shell.style.right  = nr + 'px';
    shell.style.bottom = nb + 'px';
  });
  document.addEventListener('mouseup', function () { drag.on = false; });

  floatClose.addEventListener('click', function (e) {
    e.stopPropagation();
    floatDismissed = true;
    disableFloat();
    video.pause();
  });

  /* ── Boot ── */
  video.muted    = true;
  video.volume   = 0;
  volRange.value = 0;
  syncMuteIcon();

  /* Fire HLS + IMA only when the player is ~400 px from entering the viewport.
     The observer disconnects itself after the first trigger so setup runs once. */
  var bootObserver = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      bootObserver.disconnect();
      spinner.classList.remove('hidden');
      setupHLS();
    }
  }, { rootMargin: '400px 0px 400px 0px', threshold: 0 });
  bootObserver.observe(anchor);

}());

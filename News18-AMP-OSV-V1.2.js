/*!
 * In-Article Video Player
 *
 * Dependencies (must be loaded before this file):
 *   https://imasdk.googleapis.com/js/sdkloader/ima3.js
 *   https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js
 */

(function () {
  'use strict';

  /* ════ CONFIG — edit only this section ══════════════════════
     CONTENT_SRC  : HLS manifest URL
     MIDROLL_PODS : array of cue-point seconds (sorted ascending)
                    add / remove entries freely
     VAST.preroll : array of VAST tag URLs — ALL fired per break (waterfall)
     VAST.midroll : array of VAST tag URLs — ALL fired per break (waterfall)
  ═══════════════════════════════════════════════════════════ */
  var CONTENT_SRC  = 'https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8';
  var MIDROLL_PODS = [5, 10, 15, 20, 25, 30, 40];   // seconds — add/remove/change freely
  const PAGE_URL = encodeURIComponent(window.location.href);
  var VAST = {
    preroll: [
      'https://pubads.g.doubleclick.net/gampad/ads?iu=/23278934576/News18_New/News18_AMP_Preroll_1&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=vast&env=instream&vpos=preroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000',
      'https://pubads.g.doubleclick.net/gampad/ads?iu=/23278934576/News18_New/News18_AMP_Preroll_2&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=vast&env=instream&vpos=preroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000'
    ],
    midroll: [
      'https://pubads.g.doubleclick.net/gampad/ads?iu=/23278934576/News18_New/News18_AMP_Midroll_1&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=vast&env=instream&vpos=midroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000',
      'https://pubads.g.doubleclick.net/gampad/ads?iu=/23278934576/News18_New/News18_AMP_Midroll_2&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=vast&env=instream&vpos=midroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000'
    ]
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
  var skipBtn      = document.getElementById('skip-btn');
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
      // Do NOT call video.play() here — fireAdPod will fire the next tag
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
    adDC = new google.ima.AdDisplayContainer(adContainer, video);
    adDC.initialize();
    // Fire the full preroll waterfall; play content when pod is done
    fireAdPod(VAST.preroll, playContent);
  }

  /* ── Ad UI events (shared) ── */
  function onContentPause() {
    adPlaying = true;
    video.pause();
    adContainer.style.pointerEvents = 'auto';
    adBadge.style.display = 'block';
    spinner.classList.add('hidden');
  }
  function onAdStarted() {
    hasStarted = true;
    adBadge.style.display = 'block';
    skipBtn.style.display = 'none';
    try { adsManager.resize(shellW(), shellH(), google.ima.ViewMode.NORMAL); } catch(x){}
  }
  function onSkippable() {
    skipBtn.style.display = adsManager && adsManager.getAdSkippableState() ? 'block' : 'none';
  }
  function onAdEnded() { hideAdUI(); }
  function hideAdUI() {
    adBadge.style.display = 'none';
    skipBtn.style.display = 'none';
    adContainer.style.pointerEvents = 'none';
  }
  skipBtn.addEventListener('click', function () { if (adsManager) adsManager.skip(); });

  /* ── Content playback ── */
  function playContent() {
    adPlaying = false;
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
    video.pause();
    // Fire ALL midroll VAST tags for this cue, then resume content
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
  btnPlay.addEventListener('click', function () {
    if (adPlaying) return;
    video.paused ? video.play() : video.pause();
  });
  bigPlay.addEventListener('click', function () {
    bigPlay.classList.add('hidden');
    spinner.classList.remove('hidden');
    playContent();
  });

  function unmute() {
    userMuted = false; video.muted = false;
    video.volume = Math.max(video.volume || 0.8, 0.5);
    volRange.value = video.volume;
    syncMuteIcon();
    clearTimeout(nudgeTimer);
    unmuteNudge.classList.add('hidden');
  }
  btnMute.addEventListener('click', function () {
    if (video.muted) { unmute(); }
    else { userMuted = true; video.muted = true; volRange.value = 0; syncMuteIcon(); }
  });
  unmuteNudge.addEventListener('click', unmute);
  volRange.addEventListener('input', function () {
    video.volume = parseFloat(volRange.value);
    video.muted  = (video.volume === 0);
    userMuted    = video.muted;
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
      if (!floatDismissed && !video.paused && !adPlaying) {
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
    if (e.target.closest('#controls,#float-close,#skip-btn,#big-play,#unmute-nudge')) return;
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
  spinner.classList.remove('hidden');
  setupHLS();

}());

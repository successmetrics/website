(function () {
  var overlay = document.getElementById("accelerator-demo-overlay");
  if (!overlay) return;

  var overlayWrap = overlay.querySelector(".accelerator-demo-overlay-video-wrap");
  var backdrop = overlay.querySelector(".accelerator-demo-overlay-backdrop");
  var minimizeBtn = overlay.querySelector(".accelerator-demo-overlay-minimize");
  var skipControls = overlayWrap && overlayWrap.querySelector(".accelerator-demo-overlay-skip-controls");

  if (!overlayWrap || !backdrop || !minimizeBtn || !skipControls) return;

  // Track the currently active card + video
  var activeCard = null;
  var activeVideo = null;
  var activeCaption = null;
  var lastFocus = null;
  var openToken = 0;

  // Per-video seekable URL cache
  var seekableCache = {};
  var seekablePromises = {};

  var skipSeconds = 10;

  function isExpanded() {
    return !overlay.hidden;
  }

  function prepareSeekableVideo(video) {
    var src = video.getAttribute("src") || "";
    if (!src) return Promise.resolve(null);
    var url = new URL(src, window.location.href).href;
    if (seekableCache[url]) return Promise.resolve(seekableCache[url]);
    if (seekablePromises[url]) return seekablePromises[url];
    seekablePromises[url] = fetch(url)
      .then(function (r) { if (!r.ok) throw new Error("fetch failed"); return r.blob(); })
      .then(function (b) { seekableCache[url] = URL.createObjectURL(b); return seekableCache[url]; })
      .catch(function () { seekablePromises[url] = null; return null; });
    return seekablePromises[url];
  }

  function swapToSeekable(video, savedTime) {
    if (video.dataset.seekableReady === "true") {
      if (Number.isFinite(savedTime)) video.currentTime = savedTime;
      return Promise.resolve();
    }
    return prepareSeekableVideo(video).then(function (url) {
      if (!url) return;
      return new Promise(function (resolve) {
        var settled = false;
        function done() {
          if (settled) return;
          settled = true;
          video.removeEventListener("loadedmetadata", done);
          video.dataset.seekableReady = "true";
          if (Number.isFinite(savedTime)) video.currentTime = savedTime;
          resolve();
        }
        video.addEventListener("loadedmetadata", done);
        if (video.src !== url) { video.src = url; video.load(); }
        if (video.readyState >= 1) { done(); } else { window.setTimeout(done, 4000); }
      });
    }).catch(function () {});
  }

  function seekTo(video, target) {
    return new Promise(function (resolve) {
      if (!Number.isFinite(video.duration) || video.duration <= 0) { resolve(); return; }
      var clamped = Math.max(0, Math.min(video.duration, target));
      if (Math.abs(video.currentTime - clamped) < 0.05 && !video.seeking) { resolve(); return; }
      var settled = false;
      function finish() {
        if (settled) return; settled = true;
        video.removeEventListener("seeked", finish); resolve();
      }
      video.addEventListener("seeked", finish);
      video.pause(); video.currentTime = clamped;
      window.setTimeout(finish, 1000);
    });
  }

  function skipVideo(delta) {
    if (!activeVideo) return;
    var v = activeVideo;
    swapToSeekable(v, v.currentTime).then(function () {
      if (!Number.isFinite(v.duration) || v.duration <= 0) return;
      var wasPlaying = !v.paused;
      seekTo(v, v.currentTime + delta).then(function () {
        if (wasPlaying) v.play().catch(function () {});
      });
    });
  }

  function openOverlay(card) {
    var video = card.querySelector(".accelerator-demo-video");
    var caption = card.querySelector(".accelerator-demo-caption");
    if (!video || !caption) return;

    var token = ++openToken;
    lastFocus = document.activeElement;
    var savedTime = video.currentTime;
    var wasPlaying = !video.paused;

    activeCard = card;
    activeVideo = video;
    activeCaption = caption;

    var panel = overlay.querySelector(".accelerator-demo-overlay-panel");
    if (panel) {
      var label = video.getAttribute("aria-label") || "Demo video";
      panel.setAttribute("aria-label", label + " — expanded view");
    }

    video.setAttribute("controls", "");
    video.setAttribute("tabindex", "0");
    video.removeAttribute("loop");
    video.removeAttribute("autoplay");
    overlayWrap.insertBefore(video, skipControls);
    overlay.hidden = false;
    card.classList.add("accelerator-demo-card--expanded");
    document.body.classList.add("accelerator-demo-overlay-open");
    video.focus();
    video.play().catch(function () {});

    swapToSeekable(video, savedTime).then(function () {
      if (token !== openToken || !isExpanded()) return;
      if (!wasPlaying) { video.pause(); } else { video.play().catch(function () {}); }
    });
  }

  function closeOverlay() {
    if (!isExpanded() || !activeCard || !activeVideo || !activeCaption) return;

    openToken += 1;
    activeVideo.pause();
    activeVideo.removeAttribute("controls");
    activeVideo.removeAttribute("tabindex");
    activeVideo.setAttribute("loop", "");
    activeVideo.setAttribute("autoplay", "");
    // Re-insert video before caption in its card
    activeCard.insertBefore(activeVideo, activeCaption);

    overlay.hidden = true;
    activeCard.classList.remove("accelerator-demo-card--expanded");
    document.body.classList.remove("accelerator-demo-overlay-open");

    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    activeVideo.play().catch(function () {});

    activeCard = null;
    activeVideo = null;
    activeCaption = null;
  }

  // Wire up all demo cards
  var cards = document.querySelectorAll(".accelerator-demo-card");
  cards.forEach(function (card) {
    card.addEventListener("click", function (event) {
      if (isExpanded()) return;
      if (event.target.closest(".accelerator-demo-overlay-minimize")) return;
      openOverlay(card);
    });

    // Warm up each video's seekable blob
    var video = card.querySelector(".accelerator-demo-video");
    if (video && "requestIdleCallback" in window) {
      window.requestIdleCallback(function () { prepareSeekableVideo(video).catch(function () {}); });
    } else if (video) {
      window.setTimeout(function () { prepareSeekableVideo(video).catch(function () {}); }, 1500 + Math.random() * 1000);
    }
  });

  minimizeBtn.addEventListener("click", function (event) {
    event.preventDefault(); event.stopPropagation(); closeOverlay();
  });

  backdrop.addEventListener("click", closeOverlay);

  skipControls.addEventListener("click", function (event) {
    var button = event.target.closest("[data-skip-seconds]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    var delta = Number(button.getAttribute("data-skip-seconds"));
    if (Number.isFinite(delta)) skipVideo(delta);
  });

  document.addEventListener("keydown", function (event) {
    if (!isExpanded()) return;
    var tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "Escape") { closeOverlay(); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); skipVideo(skipSeconds); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); skipVideo(-skipSeconds); }
  });
})();

(function () {
  const overlay = document.getElementById("accelerator-demo-overlay");
  const card = document.querySelector(".accelerator-demo-card");
  const video = document.querySelector(".accelerator-demo-video");
  const caption = document.querySelector(".accelerator-demo-caption");
  const overlayWrap = document.querySelector(".accelerator-demo-overlay-video-wrap");
  const backdrop = overlay && overlay.querySelector(".accelerator-demo-overlay-backdrop");
  const minimizeBtn = overlay && overlay.querySelector(".accelerator-demo-overlay-minimize");
  const skipControls = overlayWrap && overlayWrap.querySelector(".accelerator-demo-overlay-skip-controls");

  if (!overlay || !card || !video || !caption || !overlayWrap || !skipControls || !backdrop || !minimizeBtn) {
    return;
  }

  const videoSrc = video.getAttribute("src") || "";
  const videoUrl = new URL(videoSrc, window.location.href).href;
  let seekableUrl = null;
  let seekablePromise = null;
  let lastFocus = null;
  let openToken = 0;
  const skipSeconds = 10;

  function isExpanded() {
    return !overlay.hidden;
  }

  function prepareSeekableVideo() {
    if (seekableUrl) {
      return Promise.resolve(seekableUrl);
    }

    if (seekablePromise) {
      return seekablePromise;
    }

    seekablePromise = fetch(videoUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Video fetch failed");
        }
        return response.blob();
      })
      .then(function (blob) {
        seekableUrl = URL.createObjectURL(blob);
        return seekableUrl;
      })
      .catch(function (error) {
        seekablePromise = null;
        throw error;
      });

    return seekablePromise;
  }

  function swapToSeekableSource(savedTime) {
    if (video.dataset.seekableReady === "true") {
      if (Number.isFinite(savedTime)) {
        video.currentTime = savedTime;
      }
      return Promise.resolve();
    }

    return prepareSeekableVideo()
      .then(function (url) {
        return new Promise(function (resolve) {
          let settled = false;

          function done() {
            if (settled) return;
            settled = true;
            video.removeEventListener("loadedmetadata", done);
            video.dataset.seekableReady = "true";
            if (Number.isFinite(savedTime)) {
              video.currentTime = savedTime;
            }
            resolve();
          }

          video.addEventListener("loadedmetadata", done);

          if (video.src !== url) {
            video.src = url;
            video.load();
          }

          if (video.readyState >= 1) {
            done();
          } else {
            window.setTimeout(done, 4000);
          }
        });
      })
      .catch(function () {
        return Promise.resolve();
      });
  }

  function seekToTime(target) {
    return new Promise(function (resolve) {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        resolve();
        return;
      }

      const clamped = Math.max(0, Math.min(video.duration, target));
      if (Math.abs(video.currentTime - clamped) < 0.05 && !video.seeking) {
        resolve();
        return;
      }

      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", finish);
        resolve();
      }

      video.addEventListener("seeked", finish);
      video.pause();
      video.currentTime = clamped;
      window.setTimeout(finish, 1000);
    });
  }

  function skipVideo(delta) {
    function runSkip() {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const wasPlaying = !video.paused;
      const target = video.currentTime + delta;

      seekToTime(target).then(function () {
        if (wasPlaying) {
          video.play().catch(function () {});
        }
      });
    }

    swapToSeekableSource(video.currentTime).then(runSkip);
  }

  function mountExpandedVideo() {
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
  }

  function openOverlay() {
    if (isExpanded()) return;

    const token = ++openToken;
    lastFocus = document.activeElement;
    const savedTime = video.currentTime;
    const wasPlaying = !video.paused;

    mountExpandedVideo();

    swapToSeekableSource(savedTime).then(function () {
      if (token !== openToken || !isExpanded()) return;
      if (!wasPlaying) {
        video.pause();
      } else {
        video.play().catch(function () {});
      }
    });
  }

  function closeOverlay() {
    if (!isExpanded()) return;

    openToken += 1;
    video.pause();
    video.removeAttribute("controls");
    video.removeAttribute("tabindex");
    video.setAttribute("loop", "");
    video.setAttribute("autoplay", "");
    card.insertBefore(video, caption);

    overlay.hidden = true;
    card.classList.remove("accelerator-demo-card--expanded");
    document.body.classList.remove("accelerator-demo-overlay-open");

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }

    video.play().catch(function () {});
  }

  function handleOpenRequest(event) {
    if (isExpanded()) return;
    if (event.target.closest(".accelerator-demo-overlay-minimize")) return;
    openOverlay();
  }

  card.addEventListener("click", handleOpenRequest);

  minimizeBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    closeOverlay();
  });

  backdrop.addEventListener("click", closeOverlay);

  skipControls.addEventListener("click", function (event) {
    const button = event.target.closest("[data-skip-seconds]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = Number(button.getAttribute("data-skip-seconds"));
    if (Number.isFinite(delta)) {
      skipVideo(delta);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (!isExpanded()) return;

    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (event.key === "Escape") {
      closeOverlay();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      skipVideo(skipSeconds);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      skipVideo(-skipSeconds);
    }
  });

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(function () {
      prepareSeekableVideo().catch(function () {});
    });
  } else {
    window.setTimeout(function () {
      prepareSeekableVideo().catch(function () {});
    }, 1500);
  }
})();

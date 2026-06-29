(function () {
  var root = document.querySelector("[data-story-carousel]");
  if (!root) return;

  var scrollEl = root.querySelector(".story-carousel-scroll");
  var track = root.querySelector(".story-carousel-track");
  var prevBtn = root.querySelector(".story-carousel-btn--prev");
  var nextBtn = root.querySelector(".story-carousel-btn--next");
  if (!scrollEl || !track || !prevBtn || !nextBtn) return;

  function scrollStep() {
    var card = track.querySelector(".story-card");
    if (!card) return 404;
    var gap = parseFloat(getComputedStyle(track).gap) || 24;
    return card.getBoundingClientRect().width + gap;
  }

  function maxScrollLeft() {
    return Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  }

  function clampScroll() {
    var max = maxScrollLeft();
    if (scrollEl.scrollLeft > max) {
      scrollEl.scrollLeft = max;
    }
    if (scrollEl.scrollLeft < 0) {
      scrollEl.scrollLeft = 0;
    }
  }

  function updateControls() {
    clampScroll();
    var maxScroll = maxScrollLeft();
    var atStart = scrollEl.scrollLeft <= 2;
    var atEnd = scrollEl.scrollLeft >= maxScroll - 2;
    var scrollable = maxScroll > 2;

    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
    root.classList.toggle("story-carousel--at-start", atStart);
    root.classList.toggle("story-carousel--at-end", atEnd);
    root.classList.toggle("story-carousel--scrollable", scrollable);
  }

  prevBtn.addEventListener("click", function () {
    var next = Math.max(0, scrollEl.scrollLeft - scrollStep());
    scrollEl.scrollTo({ left: next, behavior: "smooth" });
  });

  nextBtn.addEventListener("click", function () {
    var next = Math.min(maxScrollLeft(), scrollEl.scrollLeft + scrollStep());
    scrollEl.scrollTo({ left: next, behavior: "smooth" });
  });

  scrollEl.addEventListener("scroll", updateControls, { passive: true });
  scrollEl.addEventListener("scrollend", clampScroll);
  window.addEventListener("resize", updateControls);
  updateControls();
})();

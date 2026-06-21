(function () {
  var inner = document.querySelector(".client-marquee-inner");
  if (!inner) return;

  inner.style.display = "flex";
  inner.style.flexWrap = "nowrap";
  inner.style.width = "max-content";

  inner.querySelectorAll(".client-marquee-group").forEach(function (group) {
    group.style.display = "flex";
    group.style.flexShrink = "0";
    group.style.alignItems = "center";
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var animationName = getComputedStyle(inner).animationName;
      if (animationName && animationName !== "none") {
        return;
      }

      var offset = 0;
      var segment = inner.scrollWidth / 4;

      function step() {
        offset -= 0.6;
        if (Math.abs(offset) >= segment) {
          offset = 0;
        }
        inner.style.transform = "translateX(" + offset + "px)";
        requestAnimationFrame(step);
      }

      step();
    });
  });
})();

(function () {
  var toc = document.getElementById("accelerators-toc");
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll("a[data-toc-id]"));
  if (!links.length) return;

  var sections = links
    .map(function (link) {
      return document.getElementById(link.getAttribute("data-toc-id"));
    })
    .filter(Boolean);

  if (!sections.length) return;

  var activeId = null;
  var ticking = false;

  function setActive(id) {
    if (!id || id === activeId) return;
    activeId = id;
    links.forEach(function (link) {
      var isActive = link.getAttribute("data-toc-id") === id;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function markerY() {
    var nav = document.querySelector("nav.nav");
    return (nav ? nav.getBoundingClientRect().bottom : 68) + 20;
  }

  function updateActive() {
    var marker = markerY();
    var current = sections[0].id;

    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= marker) {
        current = sections[i].id;
      }
    }

    var scrollBottom = window.scrollY + window.innerHeight;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    if (docHeight - scrollBottom < 120) {
      current = sections[sections.length - 1].id;
    }

    setActive(current);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateActive();
      ticking = false;
    });
  }

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      setActive(link.getAttribute("data-toc-id"));
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("hashchange", updateActive);

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(onScroll, {
      root: null,
      rootMargin: "-88px 0px -55% 0px",
      threshold: [0, 0.1, 0.25, 0.5, 1],
    });
    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  updateActive();
})();

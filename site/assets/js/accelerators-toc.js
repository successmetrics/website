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
    if (id === activeId) return;
    activeId = id;
    links.forEach(function (link) {
      var isActive = link.getAttribute("data-toc-id") === id;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function updateActive() {
    var marker = 120;
    var current = sections[0] ? sections[0].id : null;

    for (var i = 0; i < sections.length; i++) {
      var top = sections[i].getBoundingClientRect().top;
      if (top <= marker) current = sections[i].id;
      else break;
    }

    if (current) setActive(current);
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
  window.addEventListener("resize", onScroll);

  updateActive();
})();

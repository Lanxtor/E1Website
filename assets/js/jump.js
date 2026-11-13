/*
 * Get E1: the shortcut bar. It sticks under the site header (CSS); here it
 * gets is-stuck once it does (slimmer), and the shortcut of the section in
 * view is marked. On phones the marked chip is scrolled into view in the bar.
 */
(function () {
  "use strict";
  var bar = document.querySelector("[data-jump-bar]");
  if (!bar) return;
  var nav = bar.querySelector(".page-jump");
  var links = [].slice.call(bar.querySelectorAll("a[href^='#']"));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var current = null, ticking = false;

  function headerH() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 68;
  }
  function update() {
    ticking = false;
    var top = headerH();
    bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= top + 1 && window.scrollY > 0);
    var line = top + bar.offsetHeight + 40, on = null;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) on = links[i]; });
    if (bar.getBoundingClientRect().top > top + 1) on = null;
    if (on === current) return;
    if (current) current.classList.remove("is-active");
    current = on;
    if (on) {
      on.classList.add("is-active");
      if (nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: on.offsetLeft - 8, behavior: "smooth" });
      }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

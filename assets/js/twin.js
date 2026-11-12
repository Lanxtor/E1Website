/*
 * Home page hero: the offshore platform as one model.
 *
 * 1. Engineering: the platform is assembled part by part (the <g class="tw-part">
 *    groups written by tools/gen-plant-twin.py, each with its --i order).
 * 2. Operation: one discipline after another marks its equipment (the
 *    <li class="tw-hot"> items over the drawing), with a bubble on wide
 *    screens and the text in the panel on every screen.
 * 3. All marks together: one plant, one model, from engineering to operation.
 * Then it starts again.
 *
 * Only class changes and timers: no requestAnimationFrame and no SVG-only
 * CSS, so it runs the same in every browser (Chrome on iPhone is WebKit).
 * With "reduce motion" the finished picture stands still. The texts come
 * from the page (.tw-texts), so every language shows its own.
 */
(function () {
  "use strict";

  var twin = document.querySelector("[data-twin]");
  if (!twin) return;
  var say = twin.querySelector("[data-twin-say]");
  var hots = [].slice.call(twin.querySelectorAll(".tw-hot"));
  var phases = [].slice.call(twin.querySelectorAll("[data-phase]"));
  var parts = twin.querySelectorAll(".tw-part").length;
  var T = {};
  [].forEach.call(twin.querySelectorAll(".tw-texts [data-t]"), function (li) { T[li.getAttribute("data-t")] = li.textContent.trim(); });

  /* Headline: the part after the comma in the cobalt-to-teal ink (any language). */
  var title = document.querySelector("[data-hero-title]");
  if (title && !title.querySelector("em")) {
    var text = title.textContent.trim();
    var comma = text.indexOf(",");
    if (comma > 0) {
      title.textContent = "";
      title.appendChild(document.createTextNode(text.slice(0, comma + 1) + " "));
      var em = document.createElement("em");
      em.textContent = text.slice(comma + 1).trim();
      title.appendChild(em);
    }
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function phase(name) { phases.forEach(function (p) { p.classList.toggle("is-on", p.getAttribute("data-phase") === name); }); }
  function show(text, discipline) {
    say.textContent = "";
    if (discipline) {
      var small = document.createElement("small");
      small.setAttribute("data-d", discipline);
      small.textContent = T[discipline] || discipline;
      say.appendChild(small);
    }
    say.appendChild(document.createTextNode(text));
  }
  function state(cls) { twin.className = "tw" + (cls ? " " + cls : ""); }

  function finished() {
    state("is-built is-run is-all");
    phase("run");
    hots.forEach(function (h) { h.classList.remove("is-cur", "is-seen"); });
    show(T.end || "");
  }

  function cycle() {
    clear();
    hots.forEach(function (h) { h.classList.remove("is-cur", "is-seen"); });
    state("");
    phase("build");
    show(T.build || "");
    later(function () { state("is-built"); }, 120);
    var t = parts * 380 + 1100;
    later(function () { state("is-built is-run"); phase("run"); show(T.run || ""); }, t);
    t += 2200;
    hots.forEach(function (h, i) {
      later(function () {
        hots.forEach(function (x) { if (x.classList.contains("is-cur")) { x.classList.remove("is-cur"); x.classList.add("is-seen"); } });
        h.classList.add("is-cur");
        show(h.querySelector("span").textContent, h.getAttribute("data-d"));
      }, t + i * 1700);
    });
    t += hots.length * 1700;
    later(finished, t);
    later(cycle, t + 4500);
  }

  if (reduce) { finished(); return; }
  cycle();
  // A hidden tab keeps no timers; it starts from the beginning when shown again.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clear(); else cycle();
  });
})();

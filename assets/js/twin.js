/*
 * Home page hero: the offshore platform as one model.
 *
 * 1. The platform is assembled part by part (the <g class="tw-part"> groups
 *    written by tools/gen-plant-twin.py, each with its --i order).
 * 2. The engineers join one after another, in the order of a plant project
 *    (process, instrumentation, automation, electrical, maintenance; the
 *    <li class="tw-who"> order): a mark on
 *    the equipment, a line to their card (picture, role, equipment and a
 *    thumbnail of their diagram), and they stay, so in the end everyone works
 *    on the same plant together. Then it starts again.
 *
 * Only class changes and timers (no requestAnimationFrame, no SVG-only CSS),
 * so it runs the same in every browser, Chrome on iPhone included. With
 * "reduce motion" the finished picture stands still. On phones the cards are
 * shown one at a time under the drawing, without lines.
 */
(function () {
  "use strict";

  var twin = document.querySelector("[data-twin]");
  if (!twin) return;
  var canvas = twin.querySelector(".tw-canvas");
  var leads = twin.querySelector(".tw-leads");
  var who = [].slice.call(twin.querySelectorAll(".tw-who"));
  var parts = twin.querySelectorAll(".tw-part").length;
  var NS = "http://www.w3.org/2000/svg";

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

  /* Lines from each mark to the nearest edge of its card. */
  function drawLeads() {
    if (!leads) return;
    var box = canvas.getBoundingClientRect();
    leads.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    leads.innerHTML = "";
    who.forEach(function (w) {
      var dot = w.querySelector(".tw-dot").getBoundingClientRect();
      var card = w.querySelector(".tw-card").getBoundingClientRect();
      if (!card.width) return;
      var x1 = dot.left + dot.width / 2 - box.left, y1 = dot.top + dot.height / 2 - box.top;
      var cl = card.left - box.left, cr = card.right - box.left, ct = card.top - box.top, cb = card.bottom - box.top;
      var x2 = Math.max(cl, Math.min(x1, cr)), y2 = Math.max(ct, Math.min(y1, cb));
      if (x2 > cl && x2 < cr && y2 > ct && y2 < cb) return;
      var line = document.createElementNS(NS, "line");
      line.setAttribute("x1", x1.toFixed(1)); line.setAttribute("y1", y1.toFixed(1));
      line.setAttribute("x2", x2.toFixed(1)); line.setAttribute("y2", y2.toFixed(1));
      line.setAttribute("data-d", w.getAttribute("data-d"));
      if (w.classList.contains("is-on")) line.setAttribute("class", "is-on");
      w._line = line;
      leads.appendChild(line);
    });
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function state(cls) { twin.className = "tw" + (cls ? " " + cls : ""); }
  function reset() { if (waves) waves.innerHTML = ""; who.forEach(function (w) { w.classList.remove("is-on", "is-cur", "is-upd"); if (w._line) w._line.removeAttribute("class"); }); }
  /* The change reaches everyone: a wave spreads over the plant from the
     engineer's mark, and each engineer already there sees "Updated" as it
     passes them. Nothing goes through a centre. */
  var waves = twin.querySelector(".tw-waves");
  var WAVE_MS = 2600;
  function centre(el) {
    var b = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top];
  }
  function wave(w) {
    if (!waves) return;
    var box = canvas.getBoundingClientRect();
    var from = centre(w.querySelector(".tw-dot"));
    // The wave stays on the plant: it reaches just past the farthest engineer.
    var reach = 0;
    who.forEach(function (x) {
      var to = centre(x.querySelector(".tw-dot"));
      reach = Math.max(reach, Math.hypot(to[0] - from[0], to[1] - from[1]));
    });
    reach = Math.max(reach * 1.08, box.width * 0.18);
    var ring = document.createElement("span");
    ring.className = "tw-wave";
    ring.setAttribute("data-d", w.getAttribute("data-d"));
    ring.style.left = from[0] + "px";
    ring.style.top = from[1] + "px";
    ring.style.width = ring.style.height = (reach * 2) + "px";
    ring.style.marginLeft = ring.style.marginTop = (-reach) + "px";
    ring.style.animationDuration = WAVE_MS + "ms";
    waves.appendChild(ring);
    setTimeout(function () { ring.remove(); }, WAVE_MS + 200);
    who.forEach(function (x) {
      if (x === w || !x.classList.contains("is-on")) return;
      var to = centre(x.querySelector(".tw-dot"));
      var d = Math.hypot(to[0] - from[0], to[1] - from[1]);
      // the ring grows with ease-out: time to reach distance d
      var k = Math.min(1, d / reach), at = WAVE_MS * (1 - Math.sqrt(1 - k));
      later(function () {
        x.classList.remove("is-upd"); void x.offsetWidth; x.classList.add("is-upd");
        later(function () { x.classList.remove("is-upd"); }, 1700);
      }, at);
    });
  }
  function join(w) {
    who.forEach(function (x) { x.classList.remove("is-cur"); });
    w.classList.add("is-on", "is-cur");
    if (w._line) w._line.setAttribute("class", "is-on");
    later(function () { wave(w); }, 650);
  }

  function finished() {
    state("is-built is-run");
    who.forEach(function (w) { w.classList.add("is-on"); w.classList.remove("is-cur"); });
    drawLeads();
  }

  function cycle() {
    clear();
    reset();
    state("");
    later(function () { state("is-built"); }, 120);
    var t = parts * 380 + 1000;
    later(function () { state("is-built is-run"); drawLeads(); }, t);
    t += 700;
    who.forEach(function (w, i) { later(function () { join(w); }, t + i * 3400); });
    t += who.length * 3400;
    later(function () { who.forEach(function (x) { x.classList.remove("is-cur"); }); }, t);
    later(cycle, t + 5500);
  }

  window.addEventListener("resize", drawLeads);
  window.addEventListener("load", drawLeads);
  if (reduce) { finished(); return; }
  cycle();
  // A hidden tab keeps no timers; it starts from the beginning when shown again.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clear(); else cycle();
  });
})();

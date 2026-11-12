/*
 * Home page hero: the offshore platform as one model.
 *
 * 1. The platform is assembled part by part (the <g class="tw-part"> groups
 *    written by tools/gen-plant-twin.py, each with its --i order).
 * 2. The engineers join one after another (<li class="tw-who">): a mark on
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
  function reset() { who.forEach(function (w) { w.classList.remove("is-on", "is-cur"); if (w._line) w._line.removeAttribute("class"); }); }
  function join(w) {
    who.forEach(function (x) { x.classList.remove("is-cur"); });
    w.classList.add("is-on", "is-cur");
    if (w._line) w._line.setAttribute("class", "is-on");
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
    who.forEach(function (w, i) { later(function () { join(w); }, t + i * 1900); });
    t += who.length * 1900;
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

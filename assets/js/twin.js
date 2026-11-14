/*
 * Home page hero: the offshore platform as one model.
 *
 * The platform is assembled part by part (the <g class="tw-part"> groups
 * written by tools/gen-plant-twin.py, in their --i order), and the engineers
 * join while it is still being built, as engineering starts before the plant
 * is finished: the process engineer once the foundation stands, then
 * instrumentation, automation, electrical and maintenance (the
 * <li class="tw-who"> order), each after the part named in JOIN_AFTER. Each
 * gets a mark on the equipment, a line to their card (picture, role,
 * equipment and a thumbnail of their diagram), and stays, so in the end
 * everyone works on the same plant together. Then it starts again.
 *
 * Only class changes and timers (no requestAnimationFrame, no SVG-only CSS),
 * so it runs the same in every browser, Chrome on iPhone included. With
 * "reduce motion" (often on in iPhones) the same sequence plays with fades
 * only: nothing slides, no waves, no pulsing. On phones the cards are
 * shown one at a time under the drawing, without lines.
 */
(function () {
  "use strict";

  var twin = document.querySelector("[data-twin]");
  if (!twin) return;
  var canvas = twin.querySelector(".tw-canvas");
  var leads = twin.querySelector(".tw-leads");
  var who = [].slice.call(twin.querySelectorAll(".tw-who"));
  var parts = [].slice.call(twin.querySelectorAll(".tw-part")).sort(function (a, b) {
    return (+a.style.getPropertyValue("--i") || 0) - (+b.style.getPropertyValue("--i") || 0);
  });
  /* The part after which each engineer joins (the class of a .tw-part). */
  var JOIN_AFTER = { process: "tw-cellar", instrumentation: "tw-modules", automation: "tw-stacks", electrical: "tw-crane2", maintenance: "tw-bridge" };
  var PART_MS = 250, JOIN_MS = 1700;
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
  function reset() { parts.forEach(function (p) { p.classList.remove("is-up", "is-set"); }); if (waves) waves.innerHTML = ""; who.forEach(function (w) { w.classList.remove("is-on", "is-cur", "is-upd"); if (w._line) w._line.removeAttribute("class"); }); }
  /* The change reaches everyone: a wave spreads over the plant from the
     engineer's mark, and each engineer already there sees "Updated" as it
     passes them. Nothing goes through a centre. */
  var waves = twin.querySelector(".tw-waves");
  var WAVE_MS = 1600;
  function centre(el) {
    var b = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top];
  }
  function wave(w) {
    if (!waves) return;
    var calm = reduce;
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
    if (!calm) {
      waves.appendChild(ring);
      setTimeout(function () { ring.remove(); }, WAVE_MS + 200);
    }
    who.forEach(function (x) {
      if (x === w || !x.classList.contains("is-on")) return;
      var to = centre(x.querySelector(".tw-dot"));
      var d = Math.hypot(to[0] - from[0], to[1] - from[1]);
      // the ring grows with ease-out: time to reach distance d
      var k = Math.min(1, d / reach), at = WAVE_MS * (1 - Math.sqrt(1 - k));
      later(function () {
        x.classList.remove("is-upd"); void x.offsetWidth; x.classList.add("is-upd");
        later(function () { x.classList.remove("is-upd"); }, 1100);
      }, at);
    });
  }
  function join(w) {
    who.forEach(function (x) { x.classList.remove("is-cur"); });
    w.classList.add("is-on", "is-cur");
    if (w._line) w._line.setAttribute("class", "is-on");
    later(function () { wave(w); }, 400);
  }

  function cycle() {
    clear();
    reset();
    state("is-built");
    var t = 120, running = false;
    parts.forEach(function (p) {
      later(function () { p.classList.add("is-up"); }, t);
      later(function () { p.classList.add("is-set"); }, t + 550);
      t += PART_MS;
      who.forEach(function (w) {
        if (!p.classList.contains(JOIN_AFTER[w.getAttribute("data-d")])) return;
        t += 300;
        later(function () {
          if (!running) { running = true; state("is-built is-run"); drawLeads(); }
          join(w);
        }, t);
        t += JOIN_MS;
      });
    });
    // anyone without a part to wait for joins after the last part
    who.forEach(function (w) {
      var after = JOIN_AFTER[w.getAttribute("data-d")];
      if (after && twin.querySelector("." + after)) return;
      later(function () { state("is-built is-run"); drawLeads(); join(w); }, t);
      t += JOIN_MS;
    });
    t += 800;
    later(function () { who.forEach(function (x) { x.classList.remove("is-cur"); }); }, t);
    later(cycle, t + 4000);
  }

  window.addEventListener("resize", drawLeads);
  window.addEventListener("load", drawLeads);
  cycle();
  // A hidden tab keeps no timers; it starts from the beginning when shown again.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clear(); else cycle();
  });
})();

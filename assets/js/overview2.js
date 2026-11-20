/*
 * Overview 2 (overview-2.html): clips, chapters, tabs and the quiet reveals.
 *
 * - Clips play only while on screen, muted and looping, and each has its own
 *   Pause / Play button (WCAG 2.2.2).
 * - With "reduce motion" or Save-Data nothing starts by itself: the still
 *   picture shows, and Play starts a clip.
 * - Chapters seek the Branches clip; the tabs switch the living diagram and
 *   Alex's modes (never rotating by themselves).
 */
(function () {
  "use strict";

  var root = document.body;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var KEY = "e1.o2.paused";
  var paused = false;
  try { paused = sessionStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }
  var still = reduce || saveData;

  /* ---------- clips ---------- */
  var clips = [].slice.call(document.querySelectorAll("[data-clip]"));
  function videoOf(fig) { return fig.querySelector("video"); }
  function label(fig) {
    var v = videoOf(fig), b = fig.querySelector("[data-clip-toggle]");
    if (!v || !b) return;
    var playing = !v.paused;
    b.textContent = playing ? "❚❚ Pause" : "▶ Play";
    b.setAttribute("aria-label", (playing ? "Pause" : "Play") + " the clip: " + (fig.getAttribute("data-name") || "E1"));
    b.setAttribute("aria-pressed", playing ? "false" : "true");
  }
  function load(v) {
    if (v.getAttribute("data-loaded")) return;
    v.setAttribute("data-loaded", "1");
    v.preload = "auto";
    v.load();
  }
  function play(fig) {
    var v = videoOf(fig);
    if (!v) return;
    load(v);
    var p = v.play();
    if (p && p.catch) p.catch(function () { label(fig); });
    label(fig);
  }
  function stop(fig) {
    var v = videoOf(fig);
    if (!v) return;
    v.pause();
    label(fig);
  }
  function visibleClip(fig) {
    var v = videoOf(fig);
    if (!v || v.offsetParent === null) return false;
    var r = fig.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  clips.forEach(function (fig) {
    var v = videoOf(fig);
    if (!v) return;
    v.muted = true;
    v.addEventListener("play", function () { label(fig); });
    v.addEventListener("pause", function () { label(fig); });
    var b = fig.querySelector("[data-clip-toggle]");
    if (b) b.addEventListener("click", function () {
      if (v.paused) { fig._user = "play"; play(fig); } else { fig._user = "pause"; stop(fig); }
    });
    label(fig);
  });
  var seen = new Map();
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var fig = en.target;
        seen.set(fig, en.isIntersecting);
        if (en.isIntersecting) {
          var v = videoOf(fig);
          if (v) load(v);
          if (!paused && !still && fig._user !== "pause" && v && v.offsetParent !== null) play(fig);
        } else {
          stop(fig);
        }
      });
    }, { threshold: 0.35 });
    clips.forEach(function (fig) { io.observe(fig); });
  }

  /* ---------- Pause animations (whole page) ---------- */
  var toggles = [].slice.call(document.querySelectorAll("[data-motion-toggle]"));
  function showMotion() {
    toggles.forEach(function (t) {
      t.textContent = paused ? "▶ Play animations" : "❚❚ Pause animations";
      t.setAttribute("aria-pressed", paused ? "true" : "false");
    });
    root.classList.toggle("o2-still", paused);
  }
  function setPaused(p) {
    paused = p;
    try { sessionStorage.setItem(KEY, p ? "1" : "0"); } catch (e) { /* storage blocked */ }
    clips.forEach(function (fig) {
      fig._user = null;
      if (p) stop(fig); else if (seen.get(fig) && visibleClip(fig)) play(fig);
    });
    document.dispatchEvent(new CustomEvent("o2:motion", { detail: { paused: p } }));
    showMotion();
  }
  toggles.forEach(function (t) { t.addEventListener("click", function () { setPaused(!paused); }); });
  window.E1O2 = { isPaused: function () { return paused || still; } };
  showMotion();
  if (paused) document.dispatchEvent(new CustomEvent("o2:motion", { detail: { paused: true } }));

  /* ---------- chapters (Branches) ---------- */
  [].slice.call(document.querySelectorAll("[data-chapters]")).forEach(function (bar) {
    var fig = document.getElementById(bar.getAttribute("data-chapters"));
    if (!fig) return;
    var v = videoOf(fig);
    if (!v) return;
    var buttons = [].slice.call(bar.querySelectorAll("button[data-t]"));
    function mark() {
      var t = v.currentTime, cur = buttons[0];
      buttons.forEach(function (b) { if (t + 0.05 >= parseFloat(b.getAttribute("data-t"))) cur = b; });
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", b === cur ? "true" : "false"); });
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        load(v);
        var go = function () { v.currentTime = parseFloat(b.getAttribute("data-t")); mark(); fig._user = "play"; play(fig); };
        if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
      });
    });
    v.addEventListener("timeupdate", mark);
    mark();
  });

  /* ---------- tabs (living diagrams, Alex's modes) ---------- */
  [].slice.call(document.querySelectorAll("[role=tablist]")).forEach(function (list) {
    var tabs = [].slice.call(list.querySelectorAll("[role=tab]"));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (!panel) return;
        panel.hidden = !on;
        var fig = panel.matches("[data-clip]") ? panel : panel.querySelector("[data-clip]");
        if (fig) { if (on && !paused && !still) play(fig); else if (!on) stop(fig); }
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
        else if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
      });
    });
  });

  /* ---------- reveals that run once (One model) ---------- */
  var once = [].slice.call(document.querySelectorAll("[data-reveal-once]"));
  if (still || paused || !("IntersectionObserver" in window)) {
    once.forEach(function (el) { el.classList.remove("is-wait"); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        setTimeout(function () { el.classList.remove("is-wait"); }, 200);
        ro.unobserve(el);
      });
    }, { threshold: 0.4 });
    once.forEach(function (el) { ro.observe(el); });
  }

  /* ---------- FEED to wiring: one tag through the thread ---------- */
  var thread = document.querySelector("[data-thread]");
  if (thread) {
    var steps = [].slice.call(thread.querySelectorAll("li"));
    steps.forEach(function (li) {
      li.addEventListener("mouseenter", function () { steps.forEach(function (x) { x.classList.toggle("is-on", x === li); }); });
      li.addEventListener("mouseleave", function () { li.classList.remove("is-on"); });
    });
  }

  /* ---------- the on-this-page bar follows the reading ---------- */
  var links = [].slice.call(document.querySelectorAll(".o2-toc a[href^='#']"));
  if (links.length && "IntersectionObserver" in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var to = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = byId[en.target.id];
        if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) to.observe(s); });
  }
})();

// Overview 2: wires from the central object to each view of it
(function () {
  [].slice.call(document.querySelectorAll("[data-wires]")).forEach(function (box) {
    var svg = box.querySelector("svg.o2-wires"), g = svg && svg.querySelector("g"), core = box.querySelector(".o2-core");
    if (!g || !core) return;
    function draw() {
      var b = box.getBoundingClientRect(), c = core.getBoundingClientRect();
      var cx = c.left + c.width / 2 - b.left, cy = c.top + c.height / 2 - b.top;
      svg.setAttribute("viewBox", "0 0 " + b.width + " " + b.height);
      g.innerHTML = [].slice.call(box.querySelectorAll(".o2-view")).map(function (v) {
        var r = v.getBoundingClientRect();
        return '<path d="M' + cx + " " + cy + " L" + (r.left + r.width / 2 - b.left) + " " + (r.top + r.height / 2 - b.top) + '"/>';
      }).join("");
    }
    draw();
    window.addEventListener("resize", draw);
    window.addEventListener("load", draw);
  });
})();

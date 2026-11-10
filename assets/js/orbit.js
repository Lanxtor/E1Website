/*
 * Home hero experiment: the E1 orbit.
 *
 * <section class="hero" data-hero="orbit">  shows the orbit (this file)
 * <section class="hero" data-hero="clip">   shows the earlier hero video
 * ?hero=clip or ?hero=orbit in the address previews either one.
 *
 * LANXTOR E1 sits in the centre: one data model. The disciplines circle it
 * on two rings. Every few seconds one of them changes something: a pulse
 * runs from it into the model, the model takes it, and the change runs out
 * to everyone else at once. The headline's words rise in one after another.
 * With "reduce motion" the picture stays still.
 */
(function () {
  "use strict";

  var hero = document.querySelector(".hero[data-hero]");
  if (!hero) return;
  var pick = /[?&]hero=(orbit|clip)\b/.exec(location.search);
  if (pick) hero.setAttribute("data-hero", pick[1]);

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Headline: words rise in; the part after the comma (or the last two
     words) gets the moving cobalt-to-teal ink. Works on every language. */
  var title = hero.querySelector("[data-hero-title]");
  if (title && !still) {
    var text = title.textContent.trim();
    var comma = text.indexOf(",");
    var words = text.split(/\s+/);
    var markFrom = comma > 0 ? text.slice(0, comma + 1).split(/\s+/).length : Math.max(0, words.length - 2);
    title.setAttribute("aria-label", text);
    title.innerHTML = words.map(function (w, i) {
      var safe = w.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return '<span class="hw' + (i >= markFrom ? " hw-ink" : "") + '" aria-hidden="true" style="--i:' + i + '">' + safe + "</span>";
    }).join(" ");
    title.classList.add("is-split");
  }

  var orbit = hero.querySelector("[data-orbit]");
  if (!orbit || hero.getAttribute("data-hero") !== "orbit") return;

  var NS = "http://www.w3.org/2000/svg";
  var rings = orbit.querySelector(".orbit-rings");
  var core = orbit.querySelector(".orbit-core");
  var caption = orbit.querySelector(".orbit-caption");
  var nodes = [].slice.call(orbit.querySelectorAll(".orbit-node")).map(function (el) {
    return { el: el, ring: +el.getAttribute("data-ring"), a0: (+el.getAttribute("data-angle")) * Math.PI / 180, x: 0, y: 0 };
  });

  // Ring speeds in radians per second: the inner ring one way, the outer the other.
  var SPEED = { 1: 0.035, 2: -0.022 };
  var W = 0, H = 0, R = {}, narrow = false;
  var lineLayer, packetLayer, ringEls = [];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function build() {
    rings.innerHTML = "";
    ringEls = [];
    // Decorative rings: the two orbits, plus fainter ones in between and outside.
    [0.16, 0.5, 1, 1.32, 2, 2.5].forEach(function (f, i) {
      ringEls.push({ f: f, el: el("ellipse", { "class": "ring" + (f === 1 || f === 2 ? " ring-main" : "") + (i % 2 ? " ring-dash" : "") }, rings) });
    });
    lineLayer = el("g", { "class": "orbit-lines" }, rings);
    packetLayer = el("g", { "class": "orbit-packets" }, rings);
    nodes.forEach(function (n) { n.line = el("line", {}, lineLayer); });
  }

  function measure() {
    W = orbit.clientWidth;
    H = orbit.clientHeight;
    rings.setAttribute("viewBox", "0 0 " + W + " " + H);
    narrow = W < 640;
    // Ellipses, wider than tall, so the picture reads as a plan seen at an angle.
    // On a phone everyone shares one ring, evenly spaced, so nobody overlaps.
    if (narrow) {
      R[1] = { x: W * 0.17, y: H * 0.17 };
      R[2] = { x: W * 0.39, y: H * 0.40 };
    } else {
      R[1] = { x: W * 0.255, y: H * 0.265 };
      R[2] = { x: W * 0.46, y: H * 0.46 };
    }
    ringEls.forEach(function (r) {
      var base = r.f <= 1 ? R[1] : R[2];
      var k = r.f <= 1 ? r.f : r.f / 2;
      r.el.setAttribute("cx", W / 2);
      r.el.setAttribute("cy", H / 2);
      r.el.setAttribute("rx", base.x * k);
      r.el.setAttribute("ry", base.y * k);
    });
  }

  function place(t) {
    var cx = W / 2, cy = H / 2;
    nodes.forEach(function (n, i) {
      var ring = narrow ? 2 : n.ring;
      var a0 = narrow ? -Math.PI / 2 + i * 2 * Math.PI / nodes.length : n.a0;
      var a = a0 + (still ? 0 : t * (narrow ? 0.03 : SPEED[n.ring]));
      n.x = cx + Math.cos(a) * R[ring].x;
      n.y = cy + Math.sin(a) * R[ring].y;
      // Nodes at the back (top) are a little smaller: depth without 3D.
      var depth = 0.86 + 0.14 * ((Math.sin(a) + 1) / 2);
      n.el.style.transform = "translate(" + n.x.toFixed(1) + "px," + n.y.toFixed(1) + "px) translate(-50%,-50%) scale(" + depth.toFixed(3) + ")";
      n.el.style.zIndex = String(Math.round(depth * 100));
      n.line.setAttribute("x1", cx);
      n.line.setAttribute("y1", cy);
      n.line.setAttribute("x2", n.x.toFixed(1));
      n.line.setAttribute("y2", n.y.toFixed(1));
    });
  }

  /* Packets: small dots travelling along a node's line, in or out. */
  var packets = [];
  function send(node, inward, delay, done) {
    packets.push({ node: node, inward: inward, start: performance.now() + (delay || 0), dur: 900, done: done,
      dot: el("circle", { r: 4.5, "class": "packet" + (inward ? " packet-in" : ""), opacity: 0 }, packetLayer) });
  }
  function movePackets(now) {
    packets = packets.filter(function (p) {
      var k = (now - p.start) / p.dur;
      if (k < 0) return true;
      if (k >= 1) { p.dot.remove(); if (p.done) p.done(); return false; }
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var f = p.inward ? 1 - e : e;
      p.dot.setAttribute("cx", (W / 2 + (p.node.x - W / 2) * f).toFixed(1));
      p.dot.setAttribute("cy", (H / 2 + (p.node.y - H / 2) * f).toFixed(1));
      p.dot.setAttribute("opacity", Math.min(1, Math.min(k, 1 - k) * 6).toFixed(2));
      return true;
    });
  }

  /* One change: a node speaks, its change flows into the model, the model
     sends it out to everyone. Then the next node, round the circle. */
  var turn = 0, timer = null;
  function flash(n, cls, ms) {
    n.el.classList.add(cls);
    setTimeout(function () { n.el.classList.remove(cls); }, ms);
  }
  function change() {
    var n = nodes[turn % nodes.length];
    turn += 1;
    orbit.querySelectorAll(".orbit-node.is-saying").forEach(function (x) { x.classList.remove("is-saying"); });
    n.el.classList.add("is-saying");
    if (caption) {
      caption.innerHTML = "<b>" + n.el.querySelector(".orbit-label").textContent + "</b> " + n.el.querySelector(".orbit-say").textContent;
      caption.style.setProperty("--c", getComputedStyle(n.el).getPropertyValue("--c"));
    }
    n.line.classList.add("is-live");
    send(n, true, 250, function () {
      n.line.classList.remove("is-live");
      core.classList.remove("is-taking");
      void core.offsetWidth;
      core.classList.add("is-taking");
      nodes.forEach(function (m, i) {
        if (m === n) return;
        send(m, false, i * 25, function () { flash(m, "is-updated", 900); });
      });
    });
    setTimeout(function () { n.el.classList.remove("is-saying"); }, 2900);
  }

  var running = false, raf = 0, t0 = performance.now();
  function frame(now) {
    place((now - t0) / 1000);
    movePackets(now);
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || still) return;
    running = true;
    raf = requestAnimationFrame(frame);
    change();
    timer = setInterval(change, 3200);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(timer);
  }

  build();
  measure();
  place(0);
  orbit.classList.add("is-on");
  window.addEventListener("resize", function () { measure(); place((performance.now() - t0) / 1000); });

  if (still) return;
  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(orbit);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else if (visible) start();
  });
})();

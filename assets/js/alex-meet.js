/*
 * "Meet Alex" on the home page: "Alex, your co-" types the co-engineer
 * skills of the app one after another (Plant engineer, Process engineer,
 * Automation engineer, Electrical engineer, HAZOP leader; the list is
 * ALEX_SKILLS in Lanxtor/E1 src/ui/alex/alexStore.js), and the matching
 * skill chip lights up. The words come from the chips, so every language
 * types its own. With "reduce motion" the first skill stands still.
 */
(function () {
  "use strict";
  var title = document.querySelector("[data-alex-title]");
  if (!title) return;
  var typed = title.querySelector("[data-alex-typed]");
  var chips = [].slice.call(document.querySelectorAll("[data-alex-skills] li"));
  var words = chips.map(function (li) { return li.textContent.trim(); });
  if (!typed || !words.length) return;

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var i = 0, n = 0, deleting = false, timer = 0, running = false;

  function mark(k) {
    chips.forEach(function (li, j) { li.classList.toggle("is-on", j === k); });
  }

  function tick() {
    var w = words[i];
    if (!deleting) {
      n += 1;
      typed.textContent = w.slice(0, n);
      if (n === 1) mark(i);
      if (n >= w.length) { deleting = true; timer = setTimeout(tick, 1900); return; }
      timer = setTimeout(tick, 55 + Math.random() * 45);
    } else {
      n -= 1;
      typed.textContent = w.slice(0, n);
      if (n <= 0) { deleting = false; i = (i + 1) % words.length; timer = setTimeout(tick, 320); return; }
      timer = setTimeout(tick, 28);
    }
  }

  if (still) { typed.textContent = words[0]; mark(0); return; }

  function start() { if (!running) { running = true; tick(); } }
  function stop() { running = false; clearTimeout(timer); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { if (e[0].isIntersecting) start(); else stop(); }).observe(title);
  } else {
    start();
  }
})();

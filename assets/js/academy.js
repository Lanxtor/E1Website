/*
 * academy.html: the syllabus. Every learning path in its order, its courses
 * with their level, length and outcome, and each course's lessons, from
 * assets/js/academy-syllabus.js (tools/academy/build.py builds it from the
 * user guides). The courses are taught in English on every language's page.
 */
(function () {
  "use strict";

  var box = document.querySelector("[data-syllabus]");
  var syl = window.E1_SYLLABUS;
  if (!box || !syl || !syl.courses || !syl.courses.length) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function duration(min) {
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  /* This page's own address: translated pages have <base href="../">, so a bare #part would go to the English page. */
  var here = location.pathname.replace(/^\//, "");
  var LEVELS = ["Beginner", "Intermediate", "Advanced"];
  var level = "all";
  var byKey = {};
  syl.courses.forEach(function (c) { byKey[c.key] = c; });

  function dots(l) {
    var n = LEVELS.indexOf(l) + 1;
    return '<span class="level" aria-hidden="true">' + [1, 2, 3].map(function (i) { return "<i" + (i <= n ? ' class="on"' : "") + "></i>"; }).join("") + "</span>";
  }

  function course(c) {
    return '<article class="card course-card syllabus-course" data-level="' + esc(c.level) + '" id="course-' + esc(c.key) + '">' +
      '<div class="course-top"><span class="eyebrow">Course ' + c.order + " · " + esc(c.level) + "</span>" + dots(c.level) + "</div>" +
      "<h4>" + esc(c.title) + "</h4>" +
      "<p>" + esc(c.summary) + "</p>" +
      '<p class="course-outcome"><strong>Afterwards:</strong> ' + esc(c.outcome) + "</p>" +
      '<p class="course-meta"><svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg>' +
      c.lessons + " lessons · " + duration(c.minutes) + " · assessment and certificate</p>" +
      '<details class="syllabus-lessons"><summary>Lessons</summary>' +
      c.modules.map(function (m) {
        return '<div class="syllabus-module"><h5>' + esc(m.title) + "</h5><ol>" +
          m.lessons.map(function (l) { return "<li><span>" + esc(l.title) + '</span><span class="outline-time">' + l.minutes + " min</span></li>"; }).join("") +
          "</ol></div>";
      }).join("") +
      '<div class="syllabus-module"><ol><li class="is-quiz"><span>Assessment</span><span class="outline-time">' + c.assessmentMinutes + " min</span></li></ol></div>" +
      "</details>" +
      '<div class="card-actions"><a class="btn btn-ghost btn-sm" href="training.html?course=' + encodeURIComponent(c.key) + '">Open the course</a></div>' +
      "</article>";
  }

  function render() {
    var t = syl.totals;
    var filters = '<div class="syllabus-filter" role="group" aria-label="Level">' +
      [["all", "All levels"]].concat(LEVELS.map(function (l) { return [l, l]; })).map(function (f) {
        return '<button type="button" class="chip' + (level === f[0] ? " is-on" : "") + '" aria-pressed="' + (level === f[0]) + '" data-level-filter="' + f[0] + '">' + f[1] + "</button>";
      }).join("") + "</div>";
    var stats = '<dl class="syllabus-totals">' +
      [[t.paths, "learning paths"], [t.courses, "courses"], [t.lessons, "lessons"], [Math.round(t.minutes / 60), "hours of video"]].map(function (x) {
        return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>";
      }).join("") + "</dl>";
    var sequence = '<ol class="path-sequence">' + syl.paths.map(function (p, i) {
      return '<li><a href="' + esc(here) + "#path-" + esc(p.key) + '"><span class="path-step">' + (i + 1) + "</span><span>" + esc(p.title) + '<span class="muted">' + p.courses.length + " courses · " + duration(p.minutes) + "</span></span></a></li>";
    }).join("") + "</ol>";
    var paths = syl.paths.map(function (p, i) {
      var cs = p.courses.map(function (k) { return byKey[k]; }).filter(function (c) { return c && (level === "all" || c.level === level); });
      if (!cs.length) return "";
      return '<section class="path-block" id="path-' + esc(p.key) + '" aria-labelledby="path-' + esc(p.key) + '-title">' +
        '<header class="path-head"><div><span class="path-step">Path ' + (i + 1) + '</span><h3 id="path-' + esc(p.key) + '-title">' + esc(p.title) + "</h3>" +
        '<p class="muted">' + esc(p.summary) + '</p></div><div class="path-meta"><span>' + p.courses.length + " courses · " + p.lessons + " lessons · " + duration(p.minutes) + "</span></div></header>" +
        '<div class="grid grid-2 course-grid">' + cs.map(course).join("") + "</div></section>";
    }).join("");
    box.innerHTML = stats + sequence + filters + '<p class="meta-line syllabus-note">Courses are taught in English. Every lesson shows its steps on the Sample E1 project, and every course ends with an assessment and a certificate.</p>' + paths;
  }

  box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-level-filter]");
    if (!b) return;
    level = b.getAttribute("data-level-filter");
    render();
    var again = box.querySelector('[data-level-filter="' + level + '"]');
    if (again) again.focus();
  });

  render();
})();

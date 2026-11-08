/*
 * training.html?course={key}[&lesson={id}]: one course. The outline with
 * the person's progress, the lesson's video (its position saved as they
 * watch), and the final assessment that issues the certificate. Routes and
 * shapes: docs/TRAINING.md.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-training]");
  if (!root || !window.E1) return;

  var fmt = E1.format;
  var params = new URLSearchParams(location.search);
  var courseKey = params.get("course") || "";
  var course = null;       // the course as GET /api/training/courses/{key} returns it
  var certificate = null;  // the person's certificate for it, or null
  var lessonId = null;     // the open lesson
  var lastSaved = -1;

  function $(sel) { return root.querySelector(sel); }
  function $all(sel) { return root.querySelectorAll(sel); }

  /* A link or media address from the server: http(s) or a relative path only,
     never javascript: or data:. Anything else becomes "#". */
  function safeUrl(u) {
    var s = String(u == null ? "" : u).trim();
    if (!s) return "";
    var scheme = s.match(/^([a-z][a-z0-9+.-]*):/i);
    return !scheme || /^https?$/i.test(scheme[1]) ? s : "#";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function show(state) {
    $all("[data-state]").forEach(function (el) { el.hidden = el.getAttribute("data-state") !== state; });
  }

  function demoSuffix() { return E1.isDemo() && E1.configured() ? "&demo=1" : ""; }

  function clock(seconds) {
    seconds = Math.max(0, Math.round(seconds || 0));
    var m = Math.floor(seconds / 60), s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function minutes(min) {
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  function meter(done, total) {
    var p = total ? Math.round((done / total) * 100) : 0;
    return '<div class="meter is-progress' + (p >= 100 ? " is-done" : "") + '" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><span style="width:' + p + '%"></span></div>';
  }

  function lessons() {
    return course.modules.reduce(function (all, m) {
      return all.concat(m.lessons.map(function (l) { l.module = m.title; return l; }));
    }, []);
  }

  function findLesson(id) { return lessons().filter(function (l) { return l.id === id; })[0] || null; }

  function locked() { return course.access === "available"; }

  function certHref(id) { return "certificate.html?id=" + encodeURIComponent(id) + demoSuffix(); }

  /* ---------- the frame: head, outline, buy box ---------- */

  function renderHead() {
    document.title = course.title + " — LANXTOR E1 training";
    $("[data-demo-banner]").hidden = !E1.isDemo();
    $("[data-course-meta]").textContent = [course.level, minutes(course.durationMinutes), lessons().length + " lessons"].filter(Boolean).join(" · ");
    $("[data-course-title]").textContent = course.title;
    $("[data-course-summary]").textContent = course.summary;

    var p = course.progress;
    $("[data-course-progress]").innerHTML = locked() ? "" :
      '<span class="course-percent">' + p.percent + "%</span>" +
      meter(p.completedLessons, p.totalLessons) +
      '<span class="meta-line">' + p.completedLessons + " of " + p.totalLessons + " lessons completed</span>";

    var done = $("[data-course-done]");
    if (certificate) {
      done.hidden = false;
      done.innerHTML = '<div><strong>You completed this course.</strong> <span class="muted">Certificate issued ' + fmt.date(certificate.issuedAt) + ".</span></div>" +
        '<a class="btn btn-primary btn-sm" href="' + certHref(certificate.id) + '">View and share your certificate</a>';
    } else {
      done.hidden = true;
    }
  }

  function renderOutline() {
    var html = course.modules.map(function (m) {
      return '<div class="outline-module"><h3>' + esc(m.title) + "</h3><ol>" +
        m.lessons.map(function (l) {
          var state = l.locked ? "locked" : l.completed ? "done" : "";
          var icon = l.locked
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
            : l.completed
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
              : l.type === "quiz"
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/></svg>';
          return '<li><button type="button" class="outline-lesson' + (state ? " is-" + state : "") + (l.id === lessonId ? " is-current" : "") + '" data-open="' + esc(l.id) + '"' +
            (l.id === lessonId ? ' aria-current="step"' : "") + ">" +
            '<span class="outline-icon" aria-hidden="true">' + icon + "</span>" +
            '<span class="outline-title">' + esc(l.title) + (l.preview && locked() ? ' <span class="badge">Free preview</span>' : "") + "</span>" +
            '<span class="outline-time">' + (l.type === "quiz" ? "Quiz" : clock(l.durationSeconds)) + "</span>" +
            '<span class="visually-hidden">' + (l.locked ? "locked" : l.completed ? "completed" : "") + "</span>" +
            "</button></li>";
        }).join("") + "</ol></div>";
    }).join("");
    $("[data-outline]").innerHTML = html;
  }

  function renderBuy() {
    var box = $("[data-buy]");
    if (!locked()) { box.hidden = true; return; }
    box.hidden = false;
    box.className = "buy-box";
    box.innerHTML = '<span class="eyebrow">Get this course</span>' +
      '<p class="buy-price">' + (course.price ? fmt.money(course.price.amount, course.price.currency) : "") + "</p>" +
      "<p>Lifetime access to every lesson, the exercise files and the final assessment, with a certificate when you pass.</p>" +
      '<button class="btn btn-primary" type="button" data-checkout>Buy the course</button>' +
      '<p class="meta-line" data-buy-note>Paid securely through our billing provider. Need it for your whole team? Your organization\'s administrator can add it to your plan.</p>';
  }

  /* ---------- a lesson ---------- */

  function open(id, push) {
    var l = findLesson(id);
    if (!l) return;
    flush();
    flush = noop;
    lessonId = id;
    if (push !== false) {
      var url = "training.html?course=" + encodeURIComponent(course.key) + "&lesson=" + encodeURIComponent(id) + demoSuffix();
      history.replaceState(null, "", url);
    }
    renderOutline();
    var main = $("[data-lesson]");

    if (l.locked) {
      main.innerHTML = lessonHead(l) +
        '<div class="lesson-locked"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' +
        "<p>This lesson is part of the full course. Watch the free preview, or get the course to continue.</p></div>";
      return;
    }

    main.innerHTML = lessonHead(l) + '<p class="muted">Loading the lesson…</p>';
    E1.training.lesson(id).then(function (lesson) {
      if (lessonId !== id) return;
      if (lesson.type === "quiz") renderQuiz(l, lesson);
      else renderVideo(l, lesson);
    }, function (err) {
      if (lessonId !== id) return;
      main.innerHTML = lessonHead(l) + '<p class="notice">' + esc(err.message) + "</p>";
    });
  }

  function lessonHead(l) {
    var all = lessons();
    var i = all.indexOf(l);
    return '<div class="lesson-head"><span class="eyebrow">' + esc(l.module) + " · Lesson " + (i + 1) + " of " + all.length + "</span>" +
      "<h2>" + esc(l.title) + "</h2></div>";
  }

  function neighbours(l) {
    var all = lessons();
    var i = all.indexOf(l);
    return { prev: all[i - 1] || null, next: all[i + 1] || null };
  }

  function navButtons(l, middle) {
    var n = neighbours(l);
    return '<div class="lesson-nav">' +
      (n.prev ? '<button class="btn btn-ghost btn-sm" type="button" data-open="' + esc(n.prev.id) + '">Previous</button>' : "<span></span>") +
      (middle || "") +
      (n.next ? '<button class="btn btn-ghost btn-sm" type="button" data-open="' + esc(n.next.id) + '">Next lesson</button>' : "<span></span>") +
      "</div>";
  }

  function renderVideo(l, lesson) {
    var main = $("[data-lesson]");
    var media = lesson.media || {};
    var tracks = (media.captions || []).map(function (c, i) {
      return '<track kind="subtitles" src="' + esc(safeUrl(c.url)) + '" srclang="' + esc(c.lang) + '" label="' + esc(c.label || c.lang) + '"' + (i === 0 ? " default" : "") + ">";
    }).join("");
    var canMark = !locked();
    main.innerHTML = lessonHead(l) +
      '<div class="player"><video controls playsinline preload="metadata" data-video>' +
      '<source src="' + esc(safeUrl(media.url)) + '" type="' + esc(media.type || "video/mp4") + '">' + tracks +
      "Your browser cannot play this video.</video></div>" +
      navButtons(l, canMark
        ? '<button class="btn ' + (lesson.completed ? "btn-ghost" : "btn-primary") + ' btn-sm" type="button" data-complete' + (lesson.completed ? " disabled" : "") + ">" +
          (lesson.completed ? "Completed" : "Mark as completed") + "</button>"
        : "") +
      ((lesson.notes || []).length ? '<div class="lesson-notes">' + lesson.notes.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" : "") +
      ((lesson.resources || []).length
        ? '<h3 class="sub-head">Exercise files</h3><ul class="mini-list">' + lesson.resources.map(function (r) {
          return '<li><span>' + esc(r.name) + '</span><a class="link-btn" href="' + esc(safeUrl(r.url)) + '" download>Download</a></li>';
        }).join("") + "</ul>"
        : "");

    var video = $("[data-video]");
    var done = Boolean(lesson.completed);
    lastSaved = lesson.position || 0;

    video.addEventListener("loadedmetadata", function () {
      var pos = lesson.position || 0;
      if (!done && pos > 5 && pos < video.duration - 5) video.currentTime = pos;
    });

    function save(completed) {
      if (locked()) return;
      var pos = Math.round(video.currentTime || 0);
      if (!completed && Math.abs(pos - lastSaved) < 5) return;
      lastSaved = pos;
      E1.training.progress(l.id, pos, completed).then(applyProgress, function () { /* tried again on the next save */ });
    }
    flush = function () { if (!video.paused) save(false); };

    video.addEventListener("timeupdate", function () {
      if (!done && video.duration && video.currentTime / video.duration >= 0.9) {
        done = true;
        save(true);
        return;
      }
      if (Math.abs((video.currentTime || 0) - lastSaved) >= 15) save(false);
    });
    video.addEventListener("pause", function () { save(false); });
    video.addEventListener("ended", function () { if (!done) { done = true; save(true); } });
  }

  function noop() {}
  var flush = noop;

  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });

  function renderQuiz(l, quiz) {
    var main = $("[data-lesson]");
    var form = '<form class="quiz" data-quiz novalidate>' +
      '<p class="section-note">Answer every question. You need ' + quiz.passMark + "% to pass" +
      (quiz.score != null ? "; your best score so far is " + quiz.score + "%" : "") + ". You can try as often as you like.</p>" +
      quiz.questions.map(function (q, i) {
        return '<fieldset class="quiz-q" data-q="' + esc(q.id) + '"><legend><span class="quiz-n">' + (i + 1) + "</span>" + esc(q.text) + "</legend>" +
          q.options.map(function (o) {
            return '<label class="quiz-option"><input type="radio" name="' + esc(q.id) + '" value="' + esc(o.id) + '"><span>' + esc(o.text) + "</span></label>";
          }).join("") + "</fieldset>";
      }).join("") +
      '<div class="quiz-actions"><button class="btn btn-primary" type="submit"' + (locked() ? " disabled" : "") + ">Submit answers</button>" +
      '<p class="meta-line" data-quiz-note></p></div>' +
      '<div data-quiz-result aria-live="polite"></div></form>';
    main.innerHTML = lessonHead(l) + form + navButtons(l);

    var el = $("[data-quiz]");
    el.addEventListener("submit", function (e) {
      e.preventDefault();
      var answers = {};
      var missing = 0;
      quiz.questions.forEach(function (q) {
        var picked = el.querySelector('input[name="' + CSS.escape(q.id) + '"]:checked');
        if (picked) answers[q.id] = picked.value; else missing++;
      });
      var note = el.querySelector("[data-quiz-note]");
      if (missing) { note.textContent = missing === 1 ? "One question is not answered yet." : missing + " questions are not answered yet."; return; }
      note.textContent = "";
      var btn = el.querySelector('button[type="submit"]');
      btn.disabled = true;
      E1.training.submitQuiz(l.id, answers).then(function (r) {
        btn.disabled = false;
        (r.results || []).forEach(function (x) {
          var fs = el.querySelector('[data-q="' + CSS.escape(x.id) + '"]');
          if (fs) { fs.classList.toggle("is-right", x.correct); fs.classList.toggle("is-wrong", !x.correct); }
        });
        var box = el.querySelector("[data-quiz-result]");
        if (r.passed) {
          box.innerHTML = '<div class="quiz-result is-pass"><strong>Passed with ' + r.score + "%.</strong> " +
            (r.certificate ? "Your certificate is ready."
              : course.progress.completedLessons < course.progress.totalLessons ? "Complete the remaining lessons to receive your certificate." : "") + "</div>";
        } else {
          box.innerHTML = '<div class="quiz-result is-fail"><strong>' + r.score + "%.</strong> You need " + r.passMark + "% to pass. Review the marked questions and try again.</div>";
        }
        applyProgress(r);
      }, function (err) {
        btn.disabled = false;
        note.textContent = err.message;
      });
    });
  }

  /* ---------- after a save: progress, outline, certificate ---------- */

  function applyProgress(r) {
    if (!r) return;
    if (r.lesson) {
      var l = findLesson(r.lesson.id);
      if (l) { l.completed = r.lesson.completed; l.position = r.lesson.position; }
    }
    if (r.results && r.passed) {
      var q = findLesson(lessonId);
      if (q) q.completed = true;
    }
    if (r.course && r.course.progress) course.progress = r.course.progress;
    var btn = $("[data-complete]");
    var current = findLesson(lessonId);
    if (btn && current && current.completed) { btn.disabled = true; btn.textContent = "Completed"; btn.className = "btn btn-ghost btn-sm"; }
    if (r.certificate) {
      certificate = r.certificate;
      celebrate(r.certificate);
    }
    renderHead();
    renderOutline();
  }

  function celebrate(cert) {
    var links = E1.training.shareLinks(cert);
    var dlg = document.createElement("div");
    dlg.className = "celebrate";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-labelledby", "celebrate-title");
    dlg.innerHTML = '<div class="celebrate-box">' +
      '<span class="cert-seal big-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 13.8 7 22l5-3 5 3-1.5-8.2"/><path d="m9.5 9 1.7 1.7L14.7 7.3"/></svg></span>' +
      '<h2 id="celebrate-title">Congratulations!</h2>' +
      "<p>You completed <strong>" + esc(cert.courseTitle) + "</strong>. Your certificate is in your account, with a link anyone can use to verify it.</p>" +
      '<div class="celebrate-actions">' +
      '<a class="btn btn-primary" href="' + certHref(cert.id) + '">View your certificate</a>' +
      '<a class="btn btn-ghost" href="' + esc(links.linkedinProfile) + '" target="_blank" rel="noopener">Add to LinkedIn profile</a>' +
      "</div>" +
      '<button class="link-btn" type="button" data-close>Close</button></div>';
    document.body.appendChild(dlg);
    var close = dlg.querySelector("[data-close]");
    close.focus();
    function shut() { dlg.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") shut(); }
    close.addEventListener("click", shut);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) shut(); });
    document.addEventListener("keydown", onKey);
  }

  /* ---------- behaviour ---------- */

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-complete],[data-checkout]");
    if (!t) return;
    if (t.hasAttribute("data-open")) {
      open(t.getAttribute("data-open"));
      var head = $("[data-lesson]");
      if (head && head.getBoundingClientRect().top < 0) head.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (t.hasAttribute("data-complete")) {
      var video = $("[data-video]");
      t.disabled = true;
      E1.training.progress(lessonId, video ? Math.round(video.currentTime || 0) : 0, true).then(function (r) {
        applyProgress(r);
        var n = neighbours(findLesson(lessonId)).next;
        if (n && !n.locked) open(n.id);
      }, function (err) { t.disabled = false; alert(err.message); });
    }
    if (t.hasAttribute("data-checkout")) {
      t.disabled = true;
      E1.training.checkout(course.key).then(function (r) {
        t.disabled = false;
        if (r && r.url) location.href = r.url;
        else $("[data-buy-note]").textContent = "Online payment is coming soon. Until then, contact us and we will add the course to your account.";
      }, function (err) { t.disabled = false; $("[data-buy-note]").textContent = err.message; });
    }
  });

  function load() {
    if (!courseKey) { location.replace("account.html#academy-courses"); return; }
    E1.training.course(courseKey).then(function (r) {
      course = r.course;
      certificate = r.certificate || null;
      if (!E1.isDemo()) E1.rememberSignedIn(true);
      renderHead();
      renderBuy();
      var want = params.get("lesson");
      var start = (want && findLesson(want)) ||
        (locked() ? lessons().filter(function (l) { return l.preview; })[0] : findLesson(course.progress.nextLessonId)) ||
        lessons()[0];
      show("ready");
      open(start.id, Boolean(want));
    }, function (err) {
      if (err && err.status === 401) {
        E1.rememberSignedIn(false);
        $("[data-login]").href = "login.html?return=" + encodeURIComponent(location.href);
        show("signed-out");
        return;
      }
      $("[data-error-text]").textContent = (err && err.message) || "The E1 cloud could not be reached.";
      show("error");
    });
  }

  document.addEventListener("DOMContentLoaded", load);
})();

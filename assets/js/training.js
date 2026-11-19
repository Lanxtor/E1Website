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
  var seekTo = null;       // a position to start the next opened lesson at (?t=, a note, a bookmark)
  var myNotes = [];        // the learner's notes in this course
  var myBookmarks = [];    // the learner's bookmarks in this course
  var tab = "overview";    // the lesson's open tab
  var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  if (params.get("t") && !isNaN(Number(params.get("t")))) seekTo = Math.max(0, Number(params.get("t")));

  /* Where E1 runs (assets/js/config.js appUrl), for "Show me how in E1". */
  function appUrl() {
    var u = String((window.E1_CONFIG && window.E1_CONFIG.appUrl) || "https://app.lanxtor.com").replace(/\/+$/, "");
    return u + "/";
  }

  function storedSpeed() {
    try { var v = Number(localStorage.getItem("e1_training_speed")); return SPEEDS.indexOf(v) >= 0 ? v : 1; } catch (e) { return 1; }
  }
  function keepSpeed(v) { try { localStorage.setItem("e1_training_speed", String(v)); } catch (e) { /* the speed is kept for this page only */ } }

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
    var path = window.E1_SYLLABUS && course.path ? (window.E1_SYLLABUS.paths.filter(function (p) { return p.key === course.path; })[0] || null) : null;
    $("[data-course-meta]").textContent = [path ? path.title : "", course.level, minutes(course.durationMinutes), lessons().length + " lessons"].filter(Boolean).join(" · ");
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
      var doneIn = m.lessons.filter(function (l) { return l.completed; }).length;
      return '<div class="outline-module"><h3><span>' + esc(m.title) + '</span><span class="outline-count">' + doneIn + "/" + m.lessons.length + "</span></h3><ol>" +
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
            '<span class="outline-title">' + esc(l.title) + (l.preview && locked() ? ' <span class="badge">Free preview</span>' : "") +
            (myBookmarks.some(function (b) { return b.lessonId === l.id; }) ? ' <span class="outline-mark" title="Bookmarked">Bookmarked</span>' : "") + "</span>" +
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
    box.innerHTML = '<span class="eyebrow">Get the E1 Academy</span>' +
      '<p class="buy-price">' + (course.price ? fmt.money(course.price.amount, course.price.currency) : "") + "</p>" +
      "<p>Every course of the Academy: all lessons, the exercise files and the assessments, with a certificate for each course you pass. Included with the yearly E1 Editor license.</p>" +
      '<button class="btn btn-primary" type="button" data-checkout>Get the Academy</button>' +
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
        "<p>This lesson is part of the E1 Academy. Watch the free preview, or get the Academy to continue.</p></div>";
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
    var resume = seekTo == null && !lesson.completed && (lesson.position || 0) > 5 ? lesson.position : null;
    main.innerHTML = lessonHead(l) +
      '<div class="player"><video controls playsinline preload="metadata" data-video>' +
      '<source src="' + esc(safeUrl(media.url)) + '" type="' + esc(media.type || "video/mp4") + '">' + tracks +
      "Your browser cannot play this video.</video></div>" +
      '<div class="player-tools">' +
      '<label class="player-speed">Speed <select data-speed aria-label="Playback speed">' + SPEEDS.map(function (v) {
        return '<option value="' + v + '"' + (v === storedSpeed() ? " selected" : "") + ">" + v + "×</option>";
      }).join("") + "</select></label>" +
      (canMark ? '<button class="btn btn-ghost btn-sm" type="button" data-bookmark>Bookmark this moment</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-note-here>Add a note here</button>' : "") +
      '<span class="meta-line" data-player-status aria-live="polite">' + (resume != null ? "Continuing at " + clock(resume) + ". " : "") + "</span>" +
      (resume != null ? '<button class="link-btn" type="button" data-restart>Start from the beginning</button>' : "") +
      "</div>" +
      navButtons(l, canMark
        ? '<button class="btn ' + (lesson.completed ? "btn-ghost" : "btn-primary") + ' btn-sm" type="button" data-complete' + (lesson.completed ? " disabled" : "") + ">" +
          (lesson.completed ? "Completed" : "Mark as completed") + "</button>"
        : "") +
      lessonTabs(l, lesson);
    lessonData = lesson;
    var video = $("[data-video]");
    var done = Boolean(lesson.completed);
    lastSaved = lesson.position || 0;

    video.playbackRate = storedSpeed();
    var start = seekTo;
    seekTo = null;
    function place() {
      var pos = start != null ? start : lesson.position || 0;
      if (start != null) video.currentTime = Math.min(pos, Math.max(0, (video.duration || pos) - 0.5));
      else if (!done && pos > 5 && pos < video.duration - 5) video.currentTime = pos;
    }
    if (video.readyState >= 1) place();
    else video.addEventListener("loadedmetadata", place);

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

  var lessonData = null;

  /* ---------- under the video: overview, transcript, my notes, bookmarks ---------- */

  function lessonTabs(l, lesson) {
    var tabs = [["overview", "Overview"], ["transcript", "Transcript"], ["notes", "My notes"], ["bookmarks", "Bookmarks"]];
    return '<div class="lesson-tabs" role="tablist" aria-label="About this lesson">' + tabs.map(function (t) {
      return '<button type="button" role="tab" id="tab-' + t[0] + '" aria-controls="panel-' + t[0] + '" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' +
        t[1] + (t[0] === "notes" ? ' <span class="tab-count" data-count-notes>' + notesOf(l.id).length + "</span>" : "") +
        (t[0] === "bookmarks" ? ' <span class="tab-count" data-count-bookmarks>' + myBookmarks.length + "</span>" : "") + "</button>";
    }).join("") + "</div>" +
      tabs.map(function (t) {
        return '<div class="lesson-panel" role="tabpanel" id="panel-' + t[0] + '" aria-labelledby="tab-' + t[0] + '" data-panel="' + t[0] + '"' + (tab === t[0] ? "" : " hidden") + ">" + panel(t[0], l, lesson) + "</div>";
      }).join("");
  }

  function panel(name, l, lesson) {
    if (name === "overview") {
      return ((lesson.notes || []).length ? '<div class="lesson-notes">' + lesson.notes.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" : "") +
        ((lesson.guide || []).length
          ? '<h3 class="sub-head">Read more, or let E1 show you</h3><ul class="mini-list lesson-guide">' + lesson.guide.map(function (g) {
            /* The triangle: the user guide's feature, and the E1 Guide lesson that shows it in E1 itself. */
            var show = (g.showMe || [])[0];
            return '<li><a href="' + esc(safeUrl(g.page)) + '" target="_blank" rel="noopener" aria-label="Read more in the user guide: ' + esc(g.title) + '">Read more: ' + esc(g.title) + "</a>" +
              (show ? '<a class="show-me" href="' + esc(appUrl() + "?guide=" + encodeURIComponent(show.id)) + '" target="_blank" rel="noopener" title="Opens E1 at the E1 Guide lesson ' + esc(show.title) + '">Show me how in E1</a>' : "") + "</li>";
          }).join("") + "</ul>"
          : "") +
        ((lesson.resources || []).length
          ? '<h3 class="sub-head">Exercise files</h3><ul class="mini-list">' + lesson.resources.map(function (r) {
            return '<li><span>' + esc(r.name) + '</span><a class="link-btn" href="' + esc(safeUrl(r.url)) + '" download>Download</a></li>';
          }).join("") + "</ul>"
          : "");
    }
    if (name === "transcript") {
      var lines = lesson.transcript || [];
      if (!lines.length) return '<p class="muted">The transcript comes with the lesson\'s film.</p>';
      return '<ol class="transcript">' + lines.map(function (x) {
        return '<li><button type="button" class="link-btn time" data-seek="' + Number(x.at || 0) + '">' + clock(x.at) + "</button><span>" + esc(x.text) + "</span></li>";
      }).join("") + "</ol>";
    }
    if (name === "notes") {
      var mine = notesOf(l.id);
      var form = locked() ? "" :
        '<form class="note-form" data-note-form><label for="note-text">A note at <span data-note-at>' + clock(currentTime()) + "</span></label>" +
        '<textarea id="note-text" name="text" rows="3" maxlength="4000" placeholder="What you want to remember from this moment"></textarea>' +
        '<div class="note-actions"><button class="btn btn-primary btn-sm" type="submit">Save note</button><span class="meta-line" data-note-msg aria-live="polite"></span></div></form>';
      return form + (mine.length
        ? '<ul class="note-list">' + mine.map(noteItem).join("") + "</ul>"
        : '<p class="muted" data-notes-empty>No notes in this lesson yet. Pause where you want and write what you want to remember: the note keeps the moment.</p>');
    }
    if (name === "bookmarks") {
      if (!myBookmarks.length) return '<p class="muted">No bookmarks in this course yet. Use Bookmark this moment under the video to come back to a step.</p>';
      return '<ul class="note-list">' + myBookmarks.map(function (b) {
        return '<li class="note-item" data-bookmark-id="' + esc(b.id) + '"><button type="button" class="link-btn time" data-goto="' + esc(b.lessonId) + '" data-at="' + Number(b.position) + '">' + clock(b.position) + "</button>" +
          '<span class="note-text">' + esc(b.lessonTitle || "") + '</span><button type="button" class="link-btn" data-unbookmark="' + esc(b.id) + '">Remove</button></li>';
      }).join("") + "</ul>";
    }
    return "";
  }

  function noteItem(n) {
    return '<li class="note-item" data-note-id="' + esc(n.id) + '"><button type="button" class="link-btn time" data-seek="' + Number(n.position) + '">' + clock(n.position) + "</button>" +
      '<span class="note-text">' + esc(n.text) + "</span>" +
      '<span class="note-tools"><button type="button" class="link-btn" data-edit-note="' + esc(n.id) + '">Edit</button>' +
      '<button type="button" class="link-btn" data-delete-note="' + esc(n.id) + '">Delete</button></span></li>';
  }

  function notesOf(id) {
    return myNotes.filter(function (n) { return n.lessonId === id; }).sort(function (a, b) { return a.position - b.position; });
  }

  function currentTime() { var v = $("[data-video]"); return v ? v.currentTime || 0 : 0; }

  function refreshPanel(name) {
    var l = findLesson(lessonId);
    var el = $('[data-panel="' + name + '"]');
    if (!l || !el || !lessonData) return;
    el.innerHTML = panel(name, l, lessonData);
    var cn = $("[data-count-notes]"); if (cn) cn.textContent = notesOf(l.id).length;
    var cb = $("[data-count-bookmarks]"); if (cb) cb.textContent = myBookmarks.length;
  }

  function showTab(name) {
    tab = name;
    $all("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === name)); });
    $all("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    if (name === "notes") {
      var at = $("[data-note-at]"); if (at) at.textContent = clock(currentTime());
    }
  }

  function status(text) { var s = $("[data-player-status]"); if (s) s.textContent = text; }

  function seek(at) {
    var v = $("[data-video]");
    if (!v) return;
    v.currentTime = Math.max(0, Number(at) || 0);
    status("At " + clock(v.currentTime) + ".");
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
    var t = e.target.closest("[data-open],[data-complete],[data-checkout],[data-tab],[data-seek],[data-goto],[data-bookmark],[data-unbookmark],[data-note-here],[data-edit-note],[data-delete-note],[data-restart]");
    if (!t) return;
    if (t.hasAttribute("data-tab")) { showTab(t.getAttribute("data-tab")); return; }
    if (t.hasAttribute("data-seek")) { seek(t.getAttribute("data-seek")); return; }
    if (t.hasAttribute("data-restart")) { seek(0); t.remove(); return; }
    if (t.hasAttribute("data-goto")) {
      var at = Number(t.getAttribute("data-at")) || 0;
      if (t.getAttribute("data-goto") === lessonId) seek(at);
      else { seekTo = at; open(t.getAttribute("data-goto")); }
      return;
    }
    if (t.hasAttribute("data-bookmark")) {
      E1.training.addBookmark(lessonId, currentTime()).then(function (r) {
        var b = r.bookmark;
        if (!myBookmarks.some(function (x) { return x.id === b.id; })) myBookmarks.unshift(b);
        status("Bookmarked at " + clock(b.position) + ".");
        refreshPanel("bookmarks");
        renderOutline();
      }, function (err) { status(err.message); });
      return;
    }
    if (t.hasAttribute("data-unbookmark")) {
      var bid = t.getAttribute("data-unbookmark");
      E1.training.deleteBookmark(bid).then(function () {
        myBookmarks = myBookmarks.filter(function (x) { return x.id !== bid; });
        refreshPanel("bookmarks");
        renderOutline();
      }, function (err) { status(err.message); });
      return;
    }
    if (t.hasAttribute("data-note-here")) {
      var v0 = $("[data-video]"); if (v0 && !v0.paused) v0.pause();
      showTab("notes");
      var ta = $("#note-text"); if (ta) ta.focus();
      return;
    }
    if (t.hasAttribute("data-edit-note")) {
      var nid = t.getAttribute("data-edit-note");
      var n = myNotes.filter(function (x) { return x.id === nid; })[0];
      var li = t.closest(".note-item");
      if (!n || !li) return;
      li.innerHTML = '<form class="note-form" data-note-edit="' + esc(nid) + '"><label class="visually-hidden" for="edit-' + esc(nid) + '">Note</label>' +
        '<textarea id="edit-' + esc(nid) + '" name="text" rows="3" maxlength="4000">' + esc(n.text) + "</textarea>" +
        '<div class="note-actions"><button class="btn btn-primary btn-sm" type="submit">Save</button><button class="link-btn" type="button" data-cancel-edit>Cancel</button><span class="meta-line" data-note-msg></span></div></form>';
      li.querySelector("textarea").focus();
      li.querySelector("[data-cancel-edit]").addEventListener("click", function () { refreshPanel("notes"); });
      return;
    }
    if (t.hasAttribute("data-delete-note")) {
      var did = t.getAttribute("data-delete-note");
      E1.training.deleteNote(did).then(function () {
        myNotes = myNotes.filter(function (x) { return x.id !== did; });
        refreshPanel("notes");
      }, function (err) { status(err.message); });
      return;
    }
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

  root.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-note-form],[data-note-edit]");
    if (!form) return;
    e.preventDefault();
    var text = form.querySelector("textarea").value.trim();
    var msg = form.querySelector("[data-note-msg]");
    if (!text) { msg.textContent = "Write something first."; return; }
    var id = form.getAttribute("data-note-edit");
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    E1.training.saveNote({ id: id, lessonId: lessonId, position: currentTime(), text: text }).then(function (r) {
      var n = r.note;
      myNotes = myNotes.filter(function (x) { return x.id !== n.id; }).concat([n]);
      refreshPanel("notes");
      var m = $("[data-note-form] [data-note-msg]");
      if (m) m.textContent = id ? "Note changed." : "Note saved at " + clock(n.position) + ".";
    }, function (err) { btn.disabled = false; msg.textContent = err.message; });
  });

  /* The notes field says the moment it will keep while the video plays. */
  root.addEventListener("timeupdate", function (e) {
    if (e.target.matches && e.target.matches("[data-video]")) {
      var at = $("[data-note-at]");
      if (at && document.activeElement !== $("#note-text")) at.textContent = clock(e.target.currentTime);
    }
  }, true);
  root.addEventListener("change", function (e) {
    if (e.target.matches("[data-speed]")) {
      var v = Number(e.target.value);
      keepSpeed(v);
      var video = $("[data-video]"); if (video) video.playbackRate = v;
    }
  });

  function loadMine() {
    if (locked()) return Promise.resolve();
    return Promise.all([
      E1.training.notes(course.key).then(function (r) { myNotes = (r && r.notes) || []; }, function () { myNotes = []; }),
      E1.training.bookmarks(course.key).then(function (r) { myBookmarks = (r && r.bookmarks) || []; }, function () { myBookmarks = []; })
    ]);
  }

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
      loadMine().then(function () { open(start.id, Boolean(want)); });
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

/*
 * account.html: the signed-in person's profile, academy (courses from
 * GET /api/training when the server has it), licenses, usage,
 * organizations, projects, permissions, billing and downloads, from
 * GET /api/account/overview (assets/js/e1-api.js).
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-account]");
  if (!root || !window.E1) return;

  var fmt = E1.format;
  var LICENSE_NAMES = { editor: "Editor", reviewer: "Reviewer", viewer: "Viewer", administrator: "Administrator" };
  var LICENSE_CAPS = {
    editor: "Full use of E1: view, edit, review, export and Alex, the AI co-engineer, within your project roles.",
    reviewer: "View, comment, approve branches, export and ask Alex, the AI co-engineer. No editing.",
    viewer: "View and export only.",
    administrator: "Manage the organization: members, licenses, groups, roles, sign-on and policies. No project editing."
  };
  var ROLE_NAMES = {
    owner: "Owner", admin: "Administrator", "library-admin": "Library administrator",
    "catalog-maintainer": "Catalog maintainer", member: "Member", guest: "Guest"
  };
  var STATUS_NAMES = {
    trialing: "Trial", active: "Active", past_due: "Payment due", grace: "Grace period",
    read_only: "Read-only", canceled: "Cancelled"
  };

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

  function pct(used, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
  }

  function meter(used, total) {
    var p = pct(used, total);
    var level = p >= 100 ? " is-full" : p >= 80 ? " is-high" : "";
    return '<div class="meter' + level + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '">' +
      '<span style="width:' + p + '%"></span></div>';
  }

  function table(el, head, rows, empty) {
    if (!rows.length) {
      el.innerHTML = '<tbody><tr><td class="muted">' + esc(empty) + "</td></tr></tbody>";
      return;
    }
    el.innerHTML = "<thead><tr>" + head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
  }

  function initials(name, email) {
    var source = String(name || email || "?").trim();
    var parts = source.split(/\s+/).filter(Boolean);
    return ((parts[0] || "?").charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
  }

  /* ---------- sections ---------- */

  function renderHead(d) {
    $("[data-avatar]").textContent = initials(d.user.name, d.user.email);
    $("[data-user-name]").textContent = d.user.name || d.user.email;
    $("[data-user-email]").textContent = d.user.email;
    $all("[data-org-name]").forEach(function (el) { el.textContent = d.org ? d.org.name : "your organization"; });

    var select = $("[data-org-select]");
    select.innerHTML = (d.orgs || []).map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (d.org && o.id === d.org.id ? " selected" : "") + ">" + esc(o.name) + "</option>";
    }).join("");
    select.parentNode.hidden = (d.orgs || []).length < 2;

    var app = $("[data-open-app]");
    if (E1.appUrl()) { app.href = E1.appUrl(); app.hidden = false; }
  }

  function renderOverview(d) {
    var lic = d.license ? (d.license.name || LICENSE_NAMES[d.license.type]) : "No license";
    var ai = d.aiUsage || {};
    var st = d.storage || {};
    var sub = d.subscription || {};
    var tiles = [
      { label: "License", value: esc(lic), sub: esc(d.org ? d.org.name : ""), href: "#licenses" },
      { label: ai.unit === "tokens" ? "AI tokens used (you)" : "AI credits used (you)", value: fmt.number(ai.you && (ai.unit === "tokens" ? ai.you.tokens : ai.you.credits)), sub: ai.you ? fmt.number(ai.you.requests) + " requests this period" : "", href: "#usage" },
      { label: "Storage used (you)", value: fmt.bytes(st.you && st.you.bytes), sub: st.organization ? fmt.bytes(st.organization.bytes) + (st.organization.quota ? " of " + fmt.bytes(st.organization.quota) : "") + " for the organization" : "", href: "#usage" },
      { label: "Plan", value: esc(sub.planName || sub.plan || "–"), sub: esc(STATUS_NAMES[sub.status] || sub.status || ""), href: "#billing" },
      { label: "Organizations", value: String((d.orgs || []).length), sub: "", href: "#organizations" },
      { label: "Projects", value: String((d.projects || []).length), sub: "you can open", href: "#projects" }
    ];
    $("[data-overview]").innerHTML = tiles.map(function (t) {
      return '<a class="stat" href="' + t.href + '"><span class="stat-label">' + t.label + '</span><span class="stat-value">' + t.value + "</span>" +
        (t.sub ? '<span class="stat-sub">' + t.sub + "</span>" : "") + "</a>";
    }).join("");
  }

  function renderLicenses(d) {
    var box = $("[data-my-license]");
    if (d.license) {
      var type = d.license.type;
      box.innerHTML = '<span class="eyebrow">Your license</span><h3>' + esc(d.license.name || LICENSE_NAMES[type] || type) + "</h3>" +
        "<p>" + esc(LICENSE_CAPS[type] || "") + "</p>" +
        '<p class="meta-line">Assigned ' + fmt.date(d.license.assignedAt) + "</p>";
    } else {
      box.innerHTML = '<span class="eyebrow">Your license</span><h3>No license</h3>' +
        "<p>You are a member of this organization without a seat. Ask an administrator to assign you a license.</p>";
    }

    var seats = (d.subscription && d.subscription.seats) || {};
    var rows = Object.keys(LICENSE_NAMES).filter(function (k) { return seats[k]; }).map(function (k) {
      var s = seats[k];
      return [esc(LICENSE_NAMES[k]) + (d.license && d.license.type === k ? ' <span class="badge">Yours</span>' : ""),
        fmt.number(s.used) + " of " + fmt.number(s.total), '<div class="meter-cell">' + meter(s.used, s.total) + "</div>"];
    });
    table($("[data-seats]"), ["License type", "Seats used", ""], rows, "No seats in this organization.");
  }

  function renderUsage(d) {
    var ai = d.aiUsage || {};
    var st = d.storage || {};
    $("[data-usage-period]").textContent = ai.periodStart
      ? "This billing period: " + fmt.date(ai.periodStart) + " – " + fmt.date(ai.periodEnd) + "."
      : "";

    var org = ai.organization || {};
    var tokens = ai.unit === "tokens";
    var unit = tokens ? "tokens" : "credits";
    var amount = function (x) { return x ? (tokens ? x.tokens : x.credits) : 0; };
    var cap = org.personalCap;
    var mine = amount(ai.you) || 0;
    $("[data-ai-usage]").innerHTML =
      '<span class="eyebrow">Alex, AI co-engineer</span>' +
      '<h3><span class="big">' + fmt.number(mine) + "</span> " + unit + " used by you</h3>" +
      (cap ? meter(mine, cap) + '<p class="meta-line">Your monthly cap: ' + fmt.number(cap) + " " + unit + "</p>" : "") +
      '<p class="meta-line">Organization: ' + fmt.number(amount(org)) + " " + unit +
      (org.included ? " of " + fmt.number(org.included) + " included" : "") + "</p>" +
      (org.included ? meter(amount(org) || 0, org.included) : "") +
      ((ai.byModel || []).length
        ? '<ul class="mini-list">' + ai.byModel.map(function (m) {
          return "<li><span>" + esc(m.model) + "</span><span>" + fmt.number(amount(m)) + " " + unit + " · " + fmt.number(m.requests) + " requests</span></li>";
        }).join("") + "</ul>"
        : "") +
      '<p class="meta-line">' + (tokens ? "Plans will include AI credits; until then usage is shown in tokens. " : "") +
      "When the credits run out, only AI requests stop. Viewing, editing and export always go on.</p>";

    var so = st.organization || {};
    $("[data-storage]").innerHTML =
      '<span class="eyebrow">Cloud storage</span>' +
      '<h3><span class="big">' + fmt.bytes(st.you && st.you.bytes) + "</span> stored by you</h3>" +
      '<p class="meta-line">Organization: ' + fmt.bytes(so.bytes) + (so.quota ? " of " + fmt.bytes(so.quota) : "") + "</p>" +
      (so.quota ? meter(so.bytes || 0, so.quota) : "") +
      ((st.byProject || []).length
        ? '<ul class="mini-list">' + st.byProject.map(function (p) {
          return "<li><span>" + esc(p.project) + "</span><span>" + fmt.bytes(p.bytes) + "</span></li>";
        }).join("") + "</ul>"
        : "") +
      '<p class="meta-line">Project databases, attached files and chat attachments, on Microsoft Azure in the EU.</p>';
  }

  function renderOrgs(d) {
    var rows = (d.orgs || []).map(function (o) {
      var current = d.org && o.id === d.org.id;
      return [esc(o.name) + (current ? ' <span class="badge">Current</span>' : ""),
        esc(ROLE_NAMES[o.role] || o.role || "–"),
        esc(LICENSE_NAMES[o.license] || o.license || "No license"),
        current ? "" : '<button class="link-btn" type="button" data-switch="' + esc(o.id) + '">Switch</button>'];
    });
    table($("[data-orgs]"), ["Organization", "Your role", "License", ""], rows, "You do not belong to an organization yet.");
  }

  function renderProjects(d) {
    var rows = (d.projects || []).map(function (p) {
      return [esc(p.name), esc(p.roleName || p.role || "–"), p.objects != null ? fmt.number(p.objects) : "–", fmt.date(p.lastOpenedAt)];
    });
    table($("[data-projects]"), ["Project", "Your role", "Objects", "Last opened"], rows, "No projects yet. Create one in E1.");
  }

  function renderPermissions(d) {
    var roles = (d.roles && d.roles.org) || [];
    $("[data-org-roles]").innerHTML = '<span class="eyebrow">Organization roles</span>' +
      (roles.length ? '<ul class="mini-list">' + roles.map(function (r) {
        return "<li><span>" + esc(r.name || ROLE_NAMES[r.key] || r.key) + "</span></li>";
      }).join("") + "</ul>" : '<p>No organization role.</p>') +
      '<p class="meta-line">Project roles are listed under Projects.</p>';

    var groups = d.groups || [];
    $("[data-groups]").innerHTML = '<span class="eyebrow">Groups</span>' +
      (groups.length ? '<ul class="mini-list">' + groups.map(function (g) { return "<li><span>" + esc(g.name) + "</span></li>"; }).join("") + "</ul>"
        : "<p>You are not in a group.</p>");

    var perms = (d.roles && d.roles.permissions) || [];
    $("[data-permissions]").innerHTML = perms.length
      ? perms.map(function (p) { return "<li><code>" + esc(p) + "</code></li>"; }).join("")
      : '<li class="muted">None at organization level.</li>';

    var packs = d.packages || [];
    $("[data-packages]").innerHTML = packs.length
      ? packs.map(function (p) { return "<li>" + esc(p.name) + (p.version ? ' <span class="muted">' + esc(p.version) + "</span>" : "") + "</li>"; }).join("")
      : '<li class="muted">No content packages.</li>';
  }

  function renderBilling(d) {
    var sub = d.subscription || {};
    var bill = d.billing || {};
    var trial = sub.trialEndsAt ? '<p class="meta-line">Trial ends ' + fmt.date(sub.trialEndsAt) + "</p>" : "";
    var source = sub.source === "license_file" ? '<p class="meta-line">Licensed by a signed license file (customer installation).</p>' : "";
    $("[data-plan]").innerHTML = '<span class="eyebrow">Plan</span>' +
      "<h3>" + esc(sub.planName || sub.plan || "–") + ' <span class="badge status-' + esc(sub.status || "") + '">' + esc(STATUS_NAMES[sub.status] || sub.status || "") + "</span></h3>" +
      (sub.periodEnd ? '<p class="meta-line">Current period ' + fmt.date(sub.periodStart) + " – " + fmt.date(sub.periodEnd) + "</p>" : "") +
      trial + source +
      ((sub.addOns || []).length ? '<p class="meta-line">Add-ons: ' + sub.addOns.map(esc).join(", ") + "</p>" : "");

    var pay = '<span class="eyebrow">Payment</span>';
    if (bill.nextInvoice) pay += "<h3>" + fmt.money(bill.nextInvoice.amount, bill.nextInvoice.currency) + '</h3><p class="meta-line">Next invoice ' + fmt.date(bill.nextInvoice.date) + "</p>";
    if (bill.paymentMethod) pay += '<p class="meta-line">' + esc(bill.paymentMethod) + "</p>";
    if (bill.canManage && (bill.portal || E1.isDemo())) {
      pay += '<button class="btn btn-primary btn-sm" type="button" data-billing-portal>Manage billing</button>' +
        '<p class="meta-line">Change plan or seats, update the payment method and company details, or cancel. Payments are handled by our billing provider; E1 never sees your card.</p>';
    } else if (bill.canManage) {
      pay += "<p>Online payment is coming soon. Until then, contact us to change your plan or seats.</p>";
    } else {
      pay += "<p>Only owners and billing administrators of this organization manage payment.</p>";
    }
    $("[data-payment]").innerHTML = pay;

    var rows = (bill.invoices || []).map(function (i) {
      return [esc(i.id), fmt.date(i.date), fmt.money(i.amount, i.currency), esc(i.status),
        i.url ? '<a class="link-btn" href="' + esc(i.url) + '" target="_blank" rel="noopener">PDF</a>' : ""];
    });
    table($("[data-invoices]"), ["Invoice", "Date", "Amount", "Status", ""], rows,
      bill.canManage ? "No invoices yet." : "Invoices are visible to the organization's billing administrators.");
  }

  /* ---------- academy: courses, progress, certificates ---------- */

  var COURSE_STATUS = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };

  /*
   * The hosted courses (GET /api/training, docs/TRAINING.md): when the server
   * answers, the Academy shows them, with links to the course player
   * (training.html) and the public certificate page (certificate.html).
   * Until those routes exist it falls back to the overview's `academy`.
   */
  var TRAINING_STATUS = {
    not_started: ["Not started", ""],
    in_progress: ["In progress", "status-trialing"],
    completed: ["Completed", "status-active"]
  };

  function demoSuffix() {
    return E1.isDemo() && E1.configured() ? "&demo=1" : "";
  }

  function courseHref(c, lesson) {
    return "training.html?course=" + encodeURIComponent(c.key) + (lesson ? "&lesson=" + encodeURIComponent(lesson) : "") + demoSuffix();
  }

  function certHref(id) {
    return "certificate.html?id=" + encodeURIComponent(id) + demoSuffix();
  }

  function duration(min) {
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  function levelLine(c) {
    var parts = [c.level, c.durationMinutes ? duration(c.durationMinutes) : "", c.lessons ? c.lessons + " lessons" : ""];
    return parts.filter(Boolean).map(esc).join(" · ");
  }

  /* Course progress: unlike the usage meters, full is good. */
  function progressMeter(done, total) {
    var p = pct(done, total);
    return '<div class="meter is-progress' + (p >= 100 ? " is-done" : "") + '" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '">' +
      '<span style="width:' + p + '%"></span></div>';
  }

  function courseCard(c) {
    var p = c.progress || { percent: 0, completedLessons: 0, totalLessons: c.lessons, status: "not_started" };
    var locked = c.access === "available";
    var st = TRAINING_STATUS[p.status] || TRAINING_STATUS.not_started;
    var badge = locked
      ? '<span class="badge">' + (c.price ? fmt.money(c.price.amount, c.price.currency) : "Available") + "</span>"
      : '<span class="badge ' + st[1] + '">' + st[0] + "</span>";
    var action;
    if (locked) action = '<a class="btn btn-ghost btn-sm" href="' + courseHref(c) + '">See the course</a>';
    else if (p.status === "completed") {
      action = (c.certificateId ? '<a class="btn btn-primary btn-sm" href="' + certHref(c.certificateId) + '">View certificate</a> ' : "") +
        '<a class="btn btn-ghost btn-sm" href="' + courseHref(c) + '">Review the course</a>';
    } else if (p.status === "in_progress") action = '<a class="btn btn-primary btn-sm" href="' + courseHref(c, p.nextLessonId) + '">Continue</a>';
    else action = '<a class="btn btn-primary btn-sm" href="' + courseHref(c) + '">Start the course</a>';

    return '<article class="card course-card' + (locked ? " is-locked" : "") + '">' +
      '<span class="eyebrow">' + levelLine(c) + "</span>" +
      "<h3>" + esc(c.title) + badge + "</h3>" +
      "<p>" + esc(c.summary) + "</p>" +
      (locked
        ? '<p class="meta-line">Not included in your plan. Buy it for yourself or your organization.</p>'
        : progressMeter(p.completedLessons, p.totalLessons) +
          '<p class="meta-line">' + fmt.number(p.completedLessons) + " of " + fmt.number(p.totalLessons) + " lessons · " + p.percent + "%" +
          (p.lastActivityAt ? " · last studied " + fmt.date(p.lastActivityAt) : "") + "</p>") +
      '<div class="card-actions">' + action + "</div>" +
      "</article>";
  }

  function renderTrainingAcademy(t) {
    var courses = t.courses || [];
    var certs = t.certificates || [];
    var taking = courses.filter(function (c) { return c.access !== "available"; });
    var done = taking.filter(function (c) { return c.progress && c.progress.status === "completed"; }).length;
    var active = taking.filter(function (c) { return c.progress && c.progress.status === "in_progress"; });
    var lessons = taking.reduce(function (n, c) { return n + ((c.progress && c.progress.completedLessons) || 0); }, 0);
    var tiles = [
      { label: "Courses completed", value: String(done), sub: "of " + taking.length + " in your plan", href: "#academy-courses" },
      { label: "In progress", value: String(active.length), sub: lessons + " lessons completed", href: "#academy-courses" },
      { label: "More courses", value: String(courses.length - taking.length), sub: "to add to your plan", href: "#academy-courses" },
      { label: "Certificates", value: String(certs.length), sub: certs.length ? "earned" : "Finish a course to earn one", href: "#academy-certificates" }
    ];
    $("[data-academy-stats]").innerHTML = tiles.map(function (x) {
      return '<a class="stat" href="' + x.href + '"><span class="stat-label">' + x.label + '</span><span class="stat-value">' + x.value + "</span>" +
        (x.sub ? '<span class="stat-sub">' + esc(x.sub) + "</span>" : "") + "</a>";
    }).join("");

    var current = active.slice().sort(function (a, b) {
      return String(b.progress.lastActivityAt || "").localeCompare(String(a.progress.lastActivityAt || ""));
    })[0];
    var cont = current
      ? '<a class="continue-card" href="' + courseHref(current, current.progress.nextLessonId) + '">' +
        '<span class="continue-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/></svg></span>' +
        '<span class="continue-text"><span class="eyebrow">Continue where you left off</span>' +
        "<strong>" + esc(current.title) + "</strong>" +
        '<span class="muted">' + (current.progress.nextLessonTitle ? "Next: " + esc(current.progress.nextLessonTitle) + " · " : "") + current.progress.percent + "% done</span></span>" +
        '<span class="continue-meter">' + progressMeter(current.progress.completedLessons, current.progress.totalLessons) + "</span></a>"
      : "";
    $("[data-academy-courses]").innerHTML = cont + '<div class="grid grid-2 course-grid">' + courses.map(courseCard).join("") + "</div>";

    table($("[data-academy-certificates]"), ["Certificate", "Earned", "Credential", ""],
      certs.map(function (c) {
        var links = E1.training.shareLinks(c);
        return [
          "<strong>" + esc(c.courseTitle) + "</strong>",
          esc(fmt.date(c.issuedAt)),
          "<code>" + esc(c.id) + "</code>",
          '<a class="link-btn" href="' + certHref(c.id) + '">View and share</a> · ' +
            '<a class="link-btn" href="' + esc(links.linkedinProfile) + '" target="_blank" rel="noopener">Add to LinkedIn</a>'
        ];
      }),
      "No certificates yet. Complete a course and pass its final assessment to earn your first one.");
  }

  function renderAcademy(d) {
    if (d.training && !d.training.error && (d.training.courses || []).length) {
      renderTrainingAcademy(d.training);
      return;
    }
    var ac = d.academy || {};
    var courses = ac.courses || [];
    var certs = ac.certificates || [];
    var done = courses.filter(function (c) { return c.status === "completed"; }).length;
    var active = courses.filter(function (c) { return c.status === "in_progress"; }).length;
    var lessons = courses.reduce(function (n, c) { return n + (c.lessonsDone || 0); }, 0);
    var minutes = courses.reduce(function (n, c) { return n + (c.minutesWatched || 0); }, 0);
    var tiles = [
      { label: "Courses completed", value: String(done), sub: courses.length ? "of " + courses.length + " available" : "Courses coming soon", href: "#academy-courses" },
      { label: "In progress", value: String(active), sub: lessons + " lessons watched", href: "#academy-courses" },
      { label: "Time learning", value: minutes >= 60 ? (Math.round(minutes / 6) / 10) + " h" : minutes + " min", sub: ac.discussions ? fmt.number(ac.discussions) + " discussion posts" : "", href: "#academy-courses" },
      { label: "Certificates", value: String(certs.length), sub: certs.length ? "earned" : "Finish a course to earn one", href: "#academy-certificates" }
    ];
    $("[data-academy-stats]").innerHTML = tiles.map(function (t) {
      return '<a class="stat" href="' + t.href + '"><span class="stat-label">' + t.label + '</span><span class="stat-value">' + t.value + "</span>" +
        (t.sub ? '<span class="stat-sub">' + esc(t.sub) + "</span>" : "") + "</a>";
    }).join("");

    var list = $("[data-academy-courses]");
    if (!courses.length) {
      list.innerHTML = '<div class="card course-empty"><h3>Video courses are on their way.</h3>' +
        "<p class=\"muted\">Short films that walk you through E1 will appear here. Your progress, discussions and certificates will be kept with them.</p></div>";
    } else {
      list.innerHTML = courses.map(function (c) {
        var total = c.lessons || 0, seen = c.lessonsDone || 0;
        var left = Math.max(0, (c.minutes || 0) - (c.minutesWatched || 0));
        var label = c.status === "completed" ? "Watch again" : c.status === "in_progress" ? "Continue" : "Start";
        var action = c.url
          ? '<a class="btn btn-ghost btn-sm" href="' + esc(safeUrl(c.url)) + '">' + label + "</a>"
          : '<span class="badge">Coming soon</span>';
        return '<article class="card course">' +
          '<div class="course-body">' +
            (c.category ? '<span class="eyebrow">' + esc(c.category) + "</span>" : "") +
            "<h3>" + esc(c.title) + "</h3>" +
            (c.summary ? '<p class="muted">' + esc(c.summary) + "</p>" : "") +
            meter(seen, total).replace('class="meter', 'class="meter course-meter' + (c.status === "completed" ? " is-done" : "")).replace(/ is-(full|high)/, "") +
            '<p class="course-meta">' + esc(COURSE_STATUS[c.status] || "") + " · " + seen + " of " + total + " lessons" +
              (c.status === "in_progress" && left ? " · " + left + " min left" : "") +
              (c.certificate ? " · certificate" : "") + "</p>" +
          "</div>" +
          '<div class="course-action">' + action + "</div>" +
        "</article>";
      }).join("");
    }

    table($("[data-academy-certificates]"), ["Certificate", "Earned", "Credential", ""],
      certs.map(function (c) {
        return [
          "<strong>" + esc(c.title) + "</strong>",
          esc(fmt.date(c.issuedAt)),
          "<code>" + esc(c.credentialId || "–") + "</code>",
          c.url ? '<a class="link-btn" href="' + esc(safeUrl(c.url)) + '">Download PDF</a>' : ""
        ];
      }),
      "No certificates yet. Complete a course to earn your first one.");
  }

  function render(d) {
    $("[data-demo-banner]").hidden = !E1.isDemo();
    renderHead(d);
    renderOverview(d);
    renderAcademy(d);
    renderLicenses(d);
    renderUsage(d);
    renderOrgs(d);
    renderProjects(d);
    renderPermissions(d);
    renderBilling(d);
    show("ready");
    highlightNav();
  }

  /* ---------- behaviour ---------- */

  function load() {
    show("loading");
    /* The training routes are optional: until the server has them, the Academy uses the overview's data. */
    var training = E1.training.list().catch(function (err) {
      return { error: (err && err.message) || "Training could not be loaded." };
    });
    Promise.all([E1.overview(), training]).then(function (both) {
      var d = both[0];
      d.training = both[1];
      if (!E1.isDemo()) {
        E1.rememberSignedIn(true);
        var headerLogin = document.querySelector('.nav-actions a[href="login.html"]');
        if (headerLogin) { headerLogin.href = "account.html"; headerLogin.textContent = "Account"; headerLogin.setAttribute("aria-current", "page"); }
      }
      render(d);
    }, function (err) {
      if (err && err.status === 401) {
        E1.rememberSignedIn(false);
        show("signed-out");
        return;
      }
      $("[data-error-text]").textContent = (err && err.message) || "The E1 cloud could not be reached.";
      show("error");
    });
  }

  function switchOrg(id) {
    E1.switchOrg(id).then(load, function (err) { alert(err.message); });
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-switch],[data-logout],[data-retry],[data-billing-portal]");
    if (!t) return;
    if (t.hasAttribute("data-switch")) switchOrg(t.getAttribute("data-switch"));
    if (t.hasAttribute("data-retry")) load();
    if (t.hasAttribute("data-logout")) {
      E1.logout().then(function () { location.href = "index.html"; });
    }
    if (t.hasAttribute("data-billing-portal")) {
      t.disabled = true;
      E1.billingPortal().then(function (r) {
        t.disabled = false;
        if (r && r.url) location.href = r.url;
        else alert("The billing portal is not connected yet.");
      }, function (err) { t.disabled = false; alert(err.message); });
    }
  });

  root.addEventListener("change", function (e) {
    if (e.target.matches("[data-org-select]")) switchOrg(e.target.value);
  });

  function highlightNav() {
    var links = $all(".account-nav a");
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    $all(".account-section").forEach(function (s) { io.observe(s); });
  }

  document.addEventListener("DOMContentLoaded", load);
})();

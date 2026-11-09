/*
 * The website's connection to the E1 cloud on Azure.
 *
 * Sign-in is the E1 server's own: the website never sees a password. "Log in"
 * sends the browser to {apiBase}/auth/login, the server signs the person in
 * through Microsoft Entra External ID and returns them to account.html with
 * the e1_session cookie set on the server's domain. Every call below sends
 * that cookie (credentials: "include").
 *
 * The routes and the shape of every answer are in docs/AZURE-INTEGRATION.md.
 * When apiBase is empty (or the page has ?demo=1) the same functions answer
 * with the preview data at the bottom of this file, so the pages can be
 * designed and reviewed before the server routes exist.
 */
(function () {
  "use strict";

  var config = window.E1_CONFIG || {};
  var base = String(config.apiBase || "").replace(/\/+$/, "");
  var csrf = "";

  function forcedDemo() {
    try { return new URLSearchParams(location.search).get("demo") === "1"; } catch (e) { return false; }
  }

  var E1 = {
    configured: function () { return Boolean(base); },
    isDemo: function () { return !base || forcedDemo(); },
    appUrl: function () { return String(config.appUrl || base || ""); }
  };

  function ApiError(status, code, message) {
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.message = message;
  }
  ApiError.prototype = Object.create(Error.prototype);
  E1.ApiError = ApiError;

  function request(method, path, body) {
    var headers = { Accept: "application/json" };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      if (csrf) headers["X-E1-CSRF"] = csrf;
    }
    return fetch(base + path, {
      method: method,
      credentials: "include",
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = (data && data.error) || {};
          throw new ApiError(res.status, err.code || "http_" + res.status, err.message || "The E1 cloud answered " + res.status + ".");
        }
        return data;
      });
    }, function () {
      throw new ApiError(0, "unreachable", "The E1 cloud could not be reached. Check your connection and try again.");
    });
  }

  function later(value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, 250); });
  }

  /** Where the account page lives, absolute, for the server's return address. */
  function accountPage() {
    return new URL("account.html", location.href).href;
  }

  /**
   * The address that starts a sign-in (or a sign-up: the Entra user flow
   * offers "Create account" on the same page; signup=1 asks the server to
   * open it on that step).
   */
  E1.loginUrl = function (mode, returnTo) {
    if (!base) return "";
    var url = base + "/auth/login?return=" + encodeURIComponent(returnTo || accountPage());
    if (mode === "signup") url += "&signup=1";
    return url;
  };

  /** Sign in with a company's Microsoft account (E1 server: identity/microsoft.mjs). */
  E1.microsoftLoginUrl = function (returnTo) {
    if (!base) return "";
    return base + "/auth/login/microsoft?return=" + encodeURIComponent(returnTo || accountPage());
  };

  /** GET /auth/providers: which sign-ins the E1 server offers ({ microsoft }). */
  E1.providers = function () {
    if (E1.isDemo() || !base) return later({ microsoft: false });
    return request("GET", "/auth/providers").catch(function () { return { microsoft: false }; });
  };

  /** GET /auth/me: who is signed in. Resolves null when nobody is. */
  E1.me = function () {
    if (E1.isDemo()) return later({ user: DEMO.user, org: DEMO.org, orgs: DEMO.orgs });
    return request("GET", "/auth/me").catch(function (err) {
      if (err.status === 401) return null;
      throw err;
    });
  };

  /** GET /api/account/overview: everything the account page shows. */
  E1.overview = function () {
    if (E1.isDemo()) return later(JSON.parse(JSON.stringify(DEMO)));
    return request("GET", "/api/account/overview").then(function (data) {
      csrf = (data && data.csrf) || "";
      return data;
    });
  };

  /** POST /auth/switch: work in another organization. */
  E1.switchOrg = function (orgId) {
    if (E1.isDemo()) {
      DEMO.org = DEMO.orgs.filter(function (o) { return o.id === orgId; })[0] || DEMO.org;
      return later({ ok: true });
    }
    return request("POST", "/auth/switch", { org: orgId });
  };

  /** POST /api/account/billing/portal: a link to the billing provider's portal. */
  E1.billingPortal = function () {
    if (E1.isDemo()) return later({ url: "" });
    return request("POST", "/api/account/billing/portal", { return: accountPage() + "#billing" });
  };

  /*
   * The Shape E1 board (shape-e1.html) on the server: reading is public,
   * posting, voting and commenting need sign-in. Only when apiBase is set;
   * otherwise board.js keeps its examples and the visitor's browser storage.
   */
  E1.community = {
    /** GET /api/community/requests → { requests, viewer, csrf, categories } */
    list: function () {
      return request("GET", "/api/community/requests").then(function (data) {
        if (data && data.csrf) csrf = data.csrf;
        return data;
      });
    },
    post: function (fields) { return request("POST", "/api/community/requests", fields); },
    vote: function (id, on) { return request(on ? "POST" : "DELETE", "/api/community/requests/" + encodeURIComponent(id) + "/vote"); },
    comment: function (id, body) { return request("POST", "/api/community/requests/" + encodeURIComponent(id) + "/comments", { body: body }); }
  };

  /*
   * Training (the Academy on account.html, training.html, certificate.html). The
   * routes and shapes are in docs/TRAINING.md. Progress and certificates
   * belong to the person; which courses they may take depends on the
   * organization they work in (plan, add-ons, purchases). In the preview the
   * same functions answer from DEMO_TRAINING, with the visitor's progress kept
   * in their own browser so the pages can be tried end to end.
   */
  E1.training = {
    /** GET /api/training → { courses, certificates, learner, csrf } */
    list: function () {
      if (E1.isDemo()) return later(demoTraining.list());
      return request("GET", "/api/training").then(function (data) {
        if (data && data.csrf) csrf = data.csrf;
        return data;
      });
    },
    /** GET /api/training/courses/{key} → { course, certificate, csrf } */
    course: function (key) {
      if (E1.isDemo()) return later(demoTraining.course(key));
      return request("GET", "/api/training/courses/" + encodeURIComponent(key)).then(function (data) {
        if (data && data.csrf) csrf = data.csrf;
        return data;
      });
    },
    /** GET /api/training/lessons/{id} → the lesson with a short-lived media address, or its quiz. */
    lesson: function (id) {
      if (E1.isDemo()) return later(demoTraining.lesson(id));
      return request("GET", "/api/training/lessons/" + encodeURIComponent(id));
    },
    /** POST /api/training/lessons/{id}/progress { position, completed } → { lesson, course, certificate } */
    progress: function (id, position, completed) {
      if (E1.isDemo()) return Promise.resolve(demoTraining.progress(id, position, completed));
      return request("POST", "/api/training/lessons/" + encodeURIComponent(id) + "/progress", { position: position, completed: Boolean(completed) });
    },
    /** POST /api/training/lessons/{id}/quiz { answers } → { passed, score, passMark, results, course, certificate } */
    submitQuiz: function (id, answers) {
      if (E1.isDemo()) return later(demoTraining.quiz(id, answers));
      return request("POST", "/api/training/lessons/" + encodeURIComponent(id) + "/quiz", { answers: answers });
    },
    /** POST /api/training/courses/{key}/checkout → { url } of the billing provider's checkout. */
    checkout: function (key) {
      if (E1.isDemo()) return later({ url: "" });
      return request("POST", "/api/training/courses/" + encodeURIComponent(key) + "/checkout", {
        return: new URL("training.html?course=" + encodeURIComponent(key), location.href).href
      });
    },
    /** GET /api/training/certificates/{id}: public, no sign-in. Resolves null when unknown. */
    certificate: function (id) {
      if (E1.isDemo()) return later(demoTraining.certificate(id));
      return fetch(base + "/api/training/certificates/" + encodeURIComponent(id), { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (res.status === 404) return null;
          if (!res.ok) throw new ApiError(res.status, "http_" + res.status, "The E1 cloud answered " + res.status + ".");
          return res.json();
        }, function () {
          throw new ApiError(0, "unreachable", "The E1 cloud could not be reached. Check your connection and try again.");
        });
    },
    /** The public address of a certificate, for sharing and for "Add to profile". */
    certificateUrl: function (id) {
      var site = String(config.siteUrl || "").replace(/\/+$/, "");
      var page = "certificate.html?id=" + encodeURIComponent(id);
      return site ? site + "/" + page : new URL(page, location.href).href;
    },
    /**
     * Where each "Share" button goes. LinkedIn's "Add to profile" puts the
     * certificate in the person's Licenses & certifications section, with
     * the verification link; the others open a post with the link.
     */
    shareLinks: function (cert) {
      var url = E1.training.certificateUrl(cert.id);
      var issued = new Date(cert.issuedAt);
      var text = "I earned the " + cert.courseTitle + " certificate from LANXTOR E1.";
      var add = "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" +
        "&name=" + encodeURIComponent(cert.courseTitle) +
        (config.linkedinOrgId ? "&organizationId=" + encodeURIComponent(config.linkedinOrgId) : "&organizationName=" + encodeURIComponent("LANXTOR")) +
        (isNaN(issued) ? "" : "&issueYear=" + issued.getFullYear() + "&issueMonth=" + (issued.getMonth() + 1)) +
        "&certUrl=" + encodeURIComponent(url) +
        "&certId=" + encodeURIComponent(cert.id);
      return {
        url: url,
        text: text,
        linkedinProfile: add,
        linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url),
        x: "https://x.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url),
        facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url),
        email: "mailto:?subject=" + encodeURIComponent(cert.courseTitle + " certificate") + "&body=" + encodeURIComponent(text + "\n\n" + url)
      };
    }
  };

  /** POST /auth/logout. */
  E1.logout = function () {
    E1.rememberSignedIn(false);
    if (E1.isDemo()) return later({ ok: true });
    return request("POST", "/auth/logout").catch(function () { return { ok: true }; });
  };

  /** The release manifest of the download area. */
  E1.releases = function () {
    var local = "assets/data/releases.json";
    function get(url) {
      return fetch(url, { cache: "no-cache" }).then(function (res) {
        if (!res.ok) throw new Error("No release manifest");
        return res.json();
      });
    }
    var url = config.releases || local;
    return url === local ? get(local) : get(url).catch(function () { return get(local); });
  };

  /* A hint for the header only ("Account" instead of "Log in"); never trusted. */
  E1.rememberSignedIn = function (yes) {
    try {
      if (yes) localStorage.setItem("e1_signed_in", "1");
      else localStorage.removeItem("e1_signed_in");
    } catch (e) { /* storage blocked: the header just says "Log in" */ }
  };
  E1.probablySignedIn = function () {
    try { return localStorage.getItem("e1_signed_in") === "1"; } catch (e) { return false; }
  };

  /* ---------- formatting shared by the pages ---------- */

  E1.format = {
    bytes: function (n) {
      if (n == null) return "–";
      var units = ["B", "KB", "MB", "GB", "TB"];
      var i = 0;
      var v = Number(n);
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
      return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + " " + units[i];
    },
    number: function (n) {
      return n == null ? "–" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
    },
    date: function (iso) {
      if (!iso) return "–";
      var d = new Date(iso);
      return isNaN(d) ? "–" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    },
    money: function (amount, currency) {
      try {
        return Number(amount).toLocaleString(undefined, { style: "currency", currency: currency || "USD" });
      } catch (e) { return amount + " " + (currency || ""); }
    }
  };

  /* ---------- preview data (apiBase empty or ?demo=1) ----------
   * Shaped exactly like GET /api/account/overview. Names follow the E1 product:
   * license types and roles come from src/domain/access/catalog.mjs, the
   * subscription and seats from migration 0006, AI credits from design 09.
   */
  var DEMO = {
    csrf: "",
    user: { id: "u-demo", email: "alex.morgan@example.com", name: "Alex Morgan", locale: "en", timeZone: "Europe/Berlin" },
    org: { id: "org-acme", name: "Acme Process Engineering" },
    orgs: [
      { id: "org-acme", name: "Acme Process Engineering", role: "admin", license: "editor" },
      { id: "org-personal", name: "Alex Morgan (personal)", role: "owner", license: "editor" }
    ],
    license: { type: "editor", name: "Editor", assignedAt: "2026-09-14T09:12:00Z" },
    roles: {
      org: [{ key: "admin", name: "Administrator" }],
      permissions: [
        "org.manage-members", "org.manage-licenses", "org.manage-groups", "org.view-audit",
        "project.create", "library.view", "catalog.view", "token.create"
      ]
    },
    groups: [{ id: "g1", name: "Process engineering" }, { id: "g2", name: "Plant 3 retrofit" }],
    subscription: {
      plan: "team",
      planName: "Team",
      status: "active",
      source: "billing",
      periodStart: "2026-11-01T00:00:00Z",
      periodEnd: "2026-12-01T00:00:00Z",
      trialEndsAt: null,
      addOns: ["Plant package"],
      seats: {
        editor: { used: 7, total: 10 },
        reviewer: { used: 4, total: 10 },
        viewer: { used: 18, total: 50 },
        administrator: { used: 2, total: 5 }
      }
    },
    aiUsage: {
      periodStart: "2026-11-01T00:00:00Z",
      periodEnd: "2026-12-01T00:00:00Z",
      you: { credits: 412.5, requests: 186 },
      organization: { credits: 2310, included: 5000, personalCap: 800 },
      byModel: [
        { model: "GPT-4.1 mini", credits: 168.0, requests: 140 },
        { model: "Claude Sonnet", credits: 244.5, requests: 46 }
      ]
    },
    storage: {
      you: { bytes: 1288490189 },
      organization: { bytes: 21474836480, quota: 107374182400 },
      byProject: [
        { project: "Plant 3 — Hydrogen unit", bytes: 734003200 },
        { project: "Compressor station retrofit", bytes: 412090368 },
        { project: "Chat attachments", bytes: 142396621 }
      ]
    },
    projects: [
      { id: "p-1", name: "Plant 3 — Hydrogen unit", role: "lead", roleName: "Lead engineer", lastOpenedAt: "2026-11-03T16:40:00Z", objects: 4210 },
      { id: "p-2", name: "Compressor station retrofit", role: "engineer", roleName: "Engineer", lastOpenedAt: "2026-10-29T08:05:00Z", objects: 1388 },
      { id: "p-3", name: "Utility steam network", role: "reviewer", roleName: "Reviewer", lastOpenedAt: "2026-10-12T11:20:00Z", objects: 962 }
    ],
    academy: {
      discussions: 6,
      courses: [
        { id: "c-start", title: "E1 in 30 minutes", category: "Getting started", summary: "Open a project, find your way around the model and make your first change.", lessons: 6, lessonsDone: 6, minutes: 32, minutesWatched: 32, status: "completed", certificate: true, url: "" },
        { id: "c-pid", title: "P&ID and process design", category: "Process", summary: "Equipment, lines and instruments in one model, from flowsheet to P&ID.", lessons: 9, lessonsDone: 4, minutes: 74, minutesWatched: 31, status: "in_progress", certificate: true, url: "" },
        { id: "c-branches", title: "Branches, pull and push", category: "Collaboration", summary: "Work on modification projects in a branch and bring the changes back to main.", lessons: 5, lessonsDone: 0, minutes: 41, minutesWatched: 0, status: "not_started", certificate: false, url: "" }
      ],
      certificates: [
        { id: "cert-1", title: "E1 Foundations", issuedAt: "2026-10-21T10:00:00Z", credentialId: "E1-F-26-0412", url: "" }
      ]
    },
    packages: [{ key: "core", name: "Core", version: "1.1.0" }, { key: "plant", name: "Plant", version: "1.1.0" }],
    billing: {
      canManage: true,
      provider: "Billing provider",
      nextInvoice: { date: "2026-12-01T00:00:00Z", amount: 1490, currency: "USD" },
      paymentMethod: "Card ending 4242",
      invoices: [
        { id: "INV-2026-011", date: "2026-11-01T00:00:00Z", amount: 1490, currency: "USD", status: "paid", url: "" },
        { id: "INV-2026-010", date: "2026-10-01T00:00:00Z", amount: 1490, currency: "USD", status: "paid", url: "" },
        { id: "INV-2026-009", date: "2026-09-01T00:00:00Z", amount: 1192, currency: "USD", status: "paid", url: "" }
      ]
    }
  };

  /* ---------- training preview (apiBase empty or ?demo=1) ----------
   * The catalog and quizzes are examples. On the server the answers never
   * reach the browser: the quiz is graded by POST .../quiz.
   */
  var DEMO_CLIP = "assets/clips/hero.mp4";

  function v(id, title, seconds, extra) {
    var l = { id: id, type: "video", title: title, durationSeconds: seconds };
    for (var k in extra || {}) l[k] = extra[k];
    return l;
  }
  function q(id, title) { return { id: id, type: "quiz", title: title || "Final assessment", durationSeconds: 600 }; }

  var DEMO_TRAINING = {
    courses: [
      {
        key: "e1-fundamentals",
        title: "E1 Fundamentals",
        summary: "Find your way around E1: projects, branches, drawings, lists and the catalog, and your first design from start to export.",
        level: "Beginner",
        access: "included",
        price: null,
        passMark: 75,
        modules: [
          { title: "Getting around", lessons: [
            v("f1", "Welcome to E1", 200, { preview: true }),
            v("f2", "Projects, branches and the object tree", 465),
            v("f3", "Navigating drawings and lists", 370)
          ] },
          { title: "Your first design", lessons: [
            v("f4", "Create a project", 330),
            v("f5", "Place equipment and lines", 545),
            v("f6", "Properties, tags and the catalog", 495)
          ] },
          { title: "Working together", lessons: [
            v("f7", "Share a project and set roles", 400),
            v("f8", "Export to PDF, DWG and Excel", 355)
          ] },
          { title: "Assessment", lessons: [q("f9")] }
        ]
      },
      {
        key: "process-design",
        title: "Process design in E1",
        summary: "From process flow diagram to P&ID: streams, line lists, valves, instruments and the consistency checks that keep them in step.",
        level: "Intermediate",
        access: "included",
        price: null,
        passMark: 75,
        modules: [
          { title: "Process flow diagrams", lessons: [
            v("p1", "From PFD to P&ID", 510, { preview: true }),
            v("p2", "Streams and mass balance", 670)
          ] },
          { title: "P&ID in depth", lessons: [
            v("p3", "Line lists and piping specs", 580),
            v("p4", "Valves, instruments and loops", 625),
            v("p5", "Checks and consistency rules", 470)
          ] },
          { title: "Assessment", lessons: [q("p6")] }
        ]
      },
      {
        key: "collaboration",
        title: "Collaboration, branches and review",
        summary: "Work on a branch, pull and push, comment and approve, and release a revision your whole team can trust.",
        level: "Beginner",
        access: "included",
        price: null,
        passMark: 75,
        modules: [
          { title: "Branches", lessons: [
            v("c1", "Why branches", 270, { preview: true }),
            v("c2", "Pull, push and merge", 490)
          ] },
          { title: "Review", lessons: [
            v("c3", "Comment and approve", 380),
            v("c4", "Release a revision", 345)
          ] },
          { title: "Assessment", lessons: [q("c5")] }
        ]
      },
      {
        key: "instrumentation-electrical",
        title: "Instrumentation and electrical",
        summary: "The instrument index, datasheets and loop diagrams, then cable schedules and single-line diagrams, all from one model.",
        level: "Advanced",
        access: "available",
        price: { amount: 149, currency: "USD" },
        passMark: 75,
        modules: [
          { title: "Instrumentation", lessons: [
            v("i1", "Course overview", 240, { preview: true }),
            v("i2", "Instrument index and datasheets", 720),
            v("i3", "Loop diagrams", 630)
          ] },
          { title: "Electrical", lessons: [
            v("i4", "Cable schedules", 560),
            v("i5", "Single-line diagrams", 705)
          ] },
          { title: "Assessment", lessons: [q("i6")] }
        ]
      }
    ],
    notes: [
      "This is a preview lesson. In the live course this is where the lesson's video plays, with chapters and captions, streamed only to people who have the course.",
      "Use the notes and the downloadable exercise files to follow along in your own E1 project. Your position in the video is saved, so you can stop at any time and continue on another device."
    ],
    quizzes: {
      f9: [
        { id: "q1", text: "You have a Viewer license. What can you do in a project?", options: [["a", "Edit objects if your project role allows it"], ["b", "View and export only"], ["c", "Approve branches"]], answer: "b" },
        { id: "q2", text: "Where do you make changes without affecting the version your colleagues use?", options: [["a", "On a branch"], ["b", "In an exported copy"], ["c", "In the company library"]], answer: "a" },
        { id: "q3", text: "What happens when your organization's AI credits run out?", options: [["a", "The project becomes read-only"], ["b", "Only AI requests stop; viewing, editing and export go on"], ["c", "Export is disabled until the next period"]], answer: "b" },
        { id: "q4", text: "Which formats can a drawing be exported to?", options: [["a", "PDF, DWG and Excel lists"], ["b", "Only PDF"], ["c", "Only the E1 project format"]], answer: "a" }
      ],
      p6: [
        { id: "q1", text: "What does a P&ID show that a PFD usually does not?", options: [["a", "Main process streams"], ["b", "Valves, instruments and control loops"], ["c", "Only the mass balance"]], answer: "b" },
        { id: "q2", text: "Where are pipe size, class and fluid of every line kept together?", options: [["a", "In the line list"], ["b", "In the drawing title block"], ["c", "In the project's chat"]], answer: "a" },
        { id: "q3", text: "What do consistency checks compare?", options: [["a", "Drawings with lists and the model, so they stay in step"], ["b", "File sizes between revisions"], ["c", "User licenses"]], answer: "a" },
        { id: "q4", text: "A stream's flow changes. Where should you change it?", options: [["a", "On every drawing by hand"], ["b", "Once, on the stream object; drawings and lists follow"], ["c", "In an exported spreadsheet"]], answer: "b" }
      ],
      c5: [
        { id: "q1", text: "Why work on a branch?", options: [["a", "To change a design without disturbing the version others use"], ["b", "To make the project faster"], ["c", "To avoid needing a license"]], answer: "a" },
        { id: "q2", text: "Which license can approve a branch but not edit?", options: [["a", "Viewer"], ["b", "Reviewer"], ["c", "Administrator"]], answer: "b" },
        { id: "q3", text: "What does \"push\" do?", options: [["a", "Sends your branch's changes to the shared project"], ["b", "Deletes your branch"], ["c", "Exports a PDF"]], answer: "a" },
        { id: "q4", text: "What is a released revision?", options: [["a", "A fixed, approved state of the design that can be issued"], ["b", "Any autosave"], ["c", "A draft comment"]], answer: "a" }
      ],
      i6: [
        { id: "q1", text: "What is the instrument index?", options: [["a", "The list of every instrument with its tag, service and data"], ["b", "A drawing's legend"], ["c", "The cable price list"]], answer: "a" },
        { id: "q2", text: "What does a loop diagram show?", options: [["a", "How an instrument is wired from field to control system"], ["b", "The plot plan"], ["c", "Only the pipe route"]], answer: "a" },
        { id: "q3", text: "Where do cable schedules get their ends from?", options: [["a", "Typed by hand"], ["b", "The connected equipment and instruments in the model"], ["c", "An external spreadsheet only"]], answer: "b" },
        { id: "q4", text: "A single-line diagram shows…", options: [["a", "Power distribution, one line per circuit"], ["b", "Every pipe in 3D"], ["c", "The org chart"]], answer: "a" }
      ]
    },
    /* The progress the preview starts with. */
    seed: {
      progress: {
        f1: { completed: true, position: 200 }, f2: { completed: true, position: 465 }, f3: { completed: true, position: 370 },
        f4: { completed: true, position: 330 }, f5: { completed: true, position: 545 }, f6: { completed: false, position: 190 },
        p1: { completed: true, position: 510 }, p2: { completed: true, position: 670 }, p3: { completed: true, position: 580 },
        p4: { completed: true, position: 625 }, p5: { completed: true, position: 470 }, p6: { completed: true, position: 0, score: 100 }
      },
      activity: { "e1-fundamentals": "2026-11-03T18:12:00Z", "process-design": "2026-10-21T15:40:00Z" },
      last: { "e1-fundamentals": "f6", "process-design": "p6" },
      certificates: [
        { id: "E1C-7KQ3-M9XP-2DWA", courseKey: "process-design", issuedAt: "2026-10-21T15:40:00Z", score: 100 }
      ],
      owned: []
    }
  };

  var demoTraining = (function () {
    var KEY = "e1_demo_training_v1";
    var memory = null;

    function load() {
      if (memory) return memory;
      try { memory = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { memory = null; }
      if (!memory || !memory.progress) memory = JSON.parse(JSON.stringify(DEMO_TRAINING.seed));
      return memory;
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* the preview keeps it in memory */ }
    }

    function findCourse(key) {
      return DEMO_TRAINING.courses.filter(function (c) { return c.key === key; })[0] || null;
    }
    function lessonsOf(c) {
      return c.modules.reduce(function (all, m) { return all.concat(m.lessons); }, []);
    }
    function findLesson(id) {
      for (var i = 0; i < DEMO_TRAINING.courses.length; i++) {
        var c = DEMO_TRAINING.courses[i];
        var hit = lessonsOf(c).filter(function (l) { return l.id === id; })[0];
        if (hit) return { course: c, lesson: hit };
      }
      return null;
    }
    function access(c) {
      return load().owned.indexOf(c.key) >= 0 ? "owned" : c.access;
    }
    function canTake(c) { return access(c) !== "available"; }
    function learnerName() { return DEMO.user.name || DEMO.user.email; }

    function certOf(key) {
      return load().certificates.filter(function (x) { return x.courseKey === key; })[0] || null;
    }
    function publicCert(x) {
      var c = findCourse(x.courseKey);
      return {
        id: x.id, status: "valid", holderName: learnerName(), courseKey: x.courseKey,
        courseTitle: c ? c.title : x.courseKey, level: c ? c.level : "", hours: c ? hours(c) : null,
        issuedAt: x.issuedAt, score: x.score, issuer: "LANXTOR"
      };
    }
    function hours(c) {
      var s = lessonsOf(c).reduce(function (t, l) { return t + (l.durationSeconds || 0); }, 0);
      return Math.max(0.5, Math.round(s / 1800) / 2);
    }

    function progressOf(c) {
      var st = load();
      var ls = lessonsOf(c);
      var done = ls.filter(function (l) { return st.progress[l.id] && st.progress[l.id].completed; }).length;
      var any = ls.some(function (l) { return st.progress[l.id]; });
      var next = ls.filter(function (l) { return !(st.progress[l.id] && st.progress[l.id].completed); })[0];
      var last = st.last[c.key] && !(st.progress[st.last[c.key]] || {}).completed ? st.last[c.key] : null;
      var nextId = last || (next ? next.id : ls[0].id);
      return {
        completedLessons: done,
        totalLessons: ls.length,
        percent: ls.length ? Math.round((done / ls.length) * 100) : 0,
        status: certOf(c.key) ? "completed" : any ? "in_progress" : "not_started",
        nextLessonId: nextId,
        nextLessonTitle: ls.filter(function (l) { return l.id === nextId; })[0].title,
        lastActivityAt: st.activity[c.key] || null
      };
    }

    function summary(c) {
      var cert = certOf(c.key);
      return {
        key: c.key, title: c.title, summary: c.summary, level: c.level, access: access(c), price: c.price,
        durationMinutes: Math.round(lessonsOf(c).reduce(function (t, l) { return t + l.durationSeconds; }, 0) / 60),
        lessons: lessonsOf(c).length, progress: progressOf(c), certificateId: cert ? cert.id : null
      };
    }

    function detail(c) {
      var st = load();
      var take = canTake(c);
      return {
        key: c.key, title: c.title, summary: c.summary, level: c.level, access: access(c), price: c.price, passMark: c.passMark,
        durationMinutes: summary(c).durationMinutes, progress: progressOf(c),
        modules: c.modules.map(function (m) {
          return {
            title: m.title,
            lessons: m.lessons.map(function (l) {
              var p = st.progress[l.id] || {};
              return {
                id: l.id, type: l.type, title: l.title, durationSeconds: l.durationSeconds, preview: Boolean(l.preview),
                locked: !take && !l.preview, completed: Boolean(p.completed), position: p.position || 0
              };
            })
          };
        })
      };
    }

    function maybeCertify(c) {
      var st = load();
      if (certOf(c.key)) return null;
      var all = lessonsOf(c).every(function (l) { return st.progress[l.id] && st.progress[l.id].completed; });
      if (!all) return null;
      var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      var id = "E1C";
      for (var g = 0; g < 3; g++) {
        id += "-";
        for (var i = 0; i < 4; i++) id += abc.charAt(Math.floor(Math.random() * abc.length));
      }
      var quiz = lessonsOf(c).filter(function (l) { return l.type === "quiz"; })[0];
      var cert = { id: id, courseKey: c.key, issuedAt: new Date().toISOString(), score: quiz ? (st.progress[quiz.id] || {}).score : null };
      st.certificates.push(cert);
      return publicCert(cert);
    }

    function fail(status, code, message) { return Promise.reject(new ApiError(status, code, message)); }

    return {
      list: function () {
        return {
          csrf: "",
          learner: { name: learnerName() },
          courses: DEMO_TRAINING.courses.map(summary),
          certificates: load().certificates.map(publicCert).sort(function (a, b) { return a.issuedAt < b.issuedAt ? 1 : -1; })
        };
      },
      course: function (key) {
        var c = findCourse(key);
        if (!c) return fail(404, "not_found", "There is no course with this address.");
        var cert = certOf(key);
        return { csrf: "", course: detail(c), certificate: cert ? publicCert(cert) : null };
      },
      lesson: function (id) {
        var hit = findLesson(id);
        if (!hit) return fail(404, "not_found", "There is no such lesson.");
        if (!canTake(hit.course) && !hit.lesson.preview) return fail(403, "not_entitled", "This lesson is part of a course you do not have yet.");
        var p = load().progress[id] || {};
        var out = { id: id, type: hit.lesson.type, title: hit.lesson.title, courseKey: hit.course.key, completed: Boolean(p.completed), position: p.position || 0 };
        if (hit.lesson.type === "video") {
          out.durationSeconds = hit.lesson.durationSeconds;
          out.media = { url: DEMO_CLIP, type: "video/mp4", expiresAt: null, captions: [] };
          out.notes = DEMO_TRAINING.notes;
          out.resources = [];
        } else {
          out.passMark = hit.course.passMark;
          out.score = p.score == null ? null : p.score;
          out.questions = (DEMO_TRAINING.quizzes[id] || []).map(function (x) {
            return { id: x.id, text: x.text, options: x.options.map(function (o) { return { id: o[0], text: o[1] }; }) };
          });
        }
        return out;
      },
      progress: function (id, position, completed) {
        var hit = findLesson(id);
        if (!hit) return fail(404, "not_found", "There is no such lesson.");
        if (!canTake(hit.course) && !hit.lesson.preview) return fail(403, "not_entitled", "This lesson is part of a course you do not have yet.");
        var st = load();
        var p = st.progress[id] || { completed: false, position: 0 };
        if (hit.lesson.type === "video") {
          p.position = Math.max(0, Math.round(position || 0));
          p.completed = p.completed || Boolean(completed);
        }
        st.progress[id] = p;
        st.activity[hit.course.key] = new Date().toISOString();
        st.last[hit.course.key] = id;
        var cert = canTake(hit.course) ? maybeCertify(hit.course) : null;
        save();
        return { lesson: { id: id, completed: p.completed, position: p.position }, course: { key: hit.course.key, progress: progressOf(hit.course) }, certificate: cert };
      },
      quiz: function (id, answers) {
        var hit = findLesson(id);
        var bank = DEMO_TRAINING.quizzes[id];
        if (!hit || !bank) return fail(404, "not_found", "There is no such assessment.");
        if (!canTake(hit.course)) return fail(403, "not_entitled", "This assessment is part of a course you do not have yet.");
        var right = 0;
        var results = bank.map(function (x) {
          var ok = answers && answers[x.id] === x.answer;
          if (ok) right++;
          return { id: x.id, correct: ok };
        });
        var score = Math.round((right / bank.length) * 100);
        var passed = score >= hit.course.passMark;
        var st = load();
        var p = st.progress[id] || { completed: false, position: 0 };
        p.score = Math.max(p.score || 0, score);
        p.completed = p.completed || passed;
        st.progress[id] = p;
        st.activity[hit.course.key] = new Date().toISOString();
        st.last[hit.course.key] = id;
        var cert = passed ? maybeCertify(hit.course) : null;
        save();
        return { passed: passed, score: score, passMark: hit.course.passMark, results: results, course: { key: hit.course.key, progress: progressOf(hit.course) }, certificate: cert };
      },
      certificate: function (id) {
        var x = load().certificates.filter(function (c) { return c.id === id; })[0];
        return x ? publicCert(x) : null;
      }
    };
  })();

  window.E1 = E1;
})();

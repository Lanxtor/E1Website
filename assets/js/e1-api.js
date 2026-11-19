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

  // Where the signed-in person's organization has its E1 (E1 design 43.1, cells): the answers of
  // /auth/me, the account overview and /auth/switch name it as `server`. It is followed only when
  // it is the address the website signs in at, or an https host under it.
  var orgServer = "";

  function originOf(address) {
    try {
      var url = new URL(String(address || ""));
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url : null;
    } catch (e) { return null; }
  }

  function trustedServer(named) {
    var url = typeof named === "string" ? originOf(named) : null;
    var home = originOf(base);
    if (!url || !home) return "";
    if (url.origin === home.origin) return url.origin;
    return url.protocol === "https:" && url.hostname.slice(-(home.hostname.length + 1)) === "." + home.hostname ? url.origin : "";
  }

  function noteServer(data) {
    if (data && data.server !== undefined) orgServer = trustedServer(data.server);
    return data;
  }

  var E1 = {
    configured: function () { return Boolean(base); },
    isDemo: function () { return !base || forcedDemo(); },
    /** Where "Open E1 in the browser" goes: the organization's E1 once a sign-in answer named it, else the configured address. */
    appUrl: function () { return String(orgServer || config.appUrl || base || ""); },
    trustedServer: trustedServer
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
    return url + E1.campaignQuery("&");
  };

  /*
   * The campaign tag of the link that brought the visitor (utm_source,
   * utm_medium, utm_campaign, utm_content, utm_term), read from this page's
   * address only: nothing is stored in the browser. main.js passes it on in
   * the links between the site's pages, and the sign-in address carries it to
   * the E1 server, which keeps it with a trial the sign-up starts (E1
   * server/identity/campaign.mjs). Empty when the address has no utm_source.
   */
  var CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  E1.campaign = function () {
    var out = [];
    try {
      var params = new URLSearchParams(location.search);
      if (!params.get("utm_source")) return out;
      CAMPAIGN_KEYS.forEach(function (key) {
        var value = params.get(key);
        if (value) out.push([key, value.slice(0, 80)]);
      });
    } catch (e) { /* an address without a query */ }
    return out;
  };
  /** The tag as a query: "" or lead + "utm_source=…&utm_campaign=…". */
  E1.campaignQuery = function (lead) {
    var pairs = E1.campaign();
    if (!pairs.length) return "";
    return lead + pairs.map(function (p) { return p[0] + "=" + encodeURIComponent(p[1]); }).join("&");
  };

  /** Sign in with a company's Microsoft account (E1 server: identity/microsoft.mjs). */
  E1.microsoftLoginUrl = function (returnTo) {
    if (!base) return "";
    return base + "/auth/login/microsoft?return=" + encodeURIComponent(returnTo || accountPage()) + E1.campaignQuery("&");
  };

  /** GET /auth/providers: which sign-ins the E1 server offers ({ microsoft }). */
  E1.providers = function () {
    if (E1.isDemo() || !base) return later({ microsoft: false });
    return request("GET", "/auth/providers").catch(function () { return { microsoft: false }; });
  };

  /** GET /auth/me: who is signed in. Resolves null when nobody is. */
  E1.me = function () {
    if (E1.isDemo()) return later({ user: DEMO.user, org: DEMO.org, orgs: DEMO.orgs });
    return request("GET", "/auth/me").then(noteServer).catch(function (err) {
      if (err.status === 401) return null;
      throw err;
    });
  };

  /** GET /api/account/overview: everything the account page shows. */
  E1.overview = function () {
    if (E1.isDemo()) return later(JSON.parse(JSON.stringify(DEMO)));
    return request("GET", "/api/account/overview").then(function (data) {
      csrf = (data && data.csrf) || "";
      return noteServer(data);
    });
  };

  /**
   * POST /api/account/profile: the person's first and last name (the profile E1, E1
   * Reviewer for iPad and E1 Mobile show, with their picture). The full name is
   * the two together, so every place that shows the person shows them.
   */
  E1.saveProfile = function (givenName, familyName) {
    var given = String(givenName || "").trim(), family = String(familyName || "").trim();
    if (E1.isDemo()) {
      DEMO.user.givenName = given; DEMO.user.familyName = family; DEMO.user.name = [given, family].filter(Boolean).join(" ");
      return later({ ok: true, user: DEMO.user });
    }
    return request("POST", "/api/account/profile", { givenName: given, familyName: family });
  };

  var PICTURE_MAX_BYTES = 256 * 1024, PICTURE_MAX_SIDE = 512, PICTURE_MAX_INPUT = 30 * 1024 * 1024;

  /** A photo of any usual size, scaled in the browser to at most 512 px a side (WebP, or JPEG where the browser cannot write WebP), so it fits E1's 256 KB. */
  function fitPicture(file) {
    var unreadable = new ApiError(400, "invalid", "This file could not be read as a picture. Choose a PNG, JPEG, GIF or WebP photo.");
    var small = /^image\/(png|jpeg|gif|webp)$/.test(file.type) && file.size <= PICTURE_MAX_BYTES;
    return decodePicture(file).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) throw unreadable;
      // Small enough already: sent as it is, once it is known to be a picture.
      if (small) { if (img.close) img.close(); return file; }
      var scale = Math.min(1, PICTURE_MAX_SIDE / Math.max(w, h));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (img.close) img.close();
      var tries = [["image/webp", 0.85], ["image/jpeg", 0.85], ["image/jpeg", 0.7], ["image/jpeg", 0.5]];
      return new Promise(function (resolve, reject) {
        (function next(i) {
          if (i >= tries.length) return reject(new ApiError(413, "invalid", "This picture could not be made small enough. Choose another one."));
          canvas.toBlob(function (blob) {
            if (blob && blob.type === tries[i][0] && blob.size <= PICTURE_MAX_BYTES) resolve(blob);
            else next(i + 1);
          }, tries[i][0], tries[i][1]);
        })(0);
      });
    }, function () { throw unreadable; });
  }

  /** The file decoded without a blob: URL, which the site's Content-Security-Policy (img-src 'self' data:) refuses. */
  function decodePicture(file) {
    var viaDataUrl = function () {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    if (typeof createImageBitmap === "function") return createImageBitmap(file).catch(viaDataUrl);
    return viaDataUrl();
  }

  /** POST /api/account/picture: a new picture (any usual photo; scaled down here to fit E1's 256 KB) → { picture }. */
  E1.uploadPicture = function (file) {
    if (!file || !/^image\//.test(file.type)) return Promise.reject(new ApiError(400, "invalid", "Choose a picture: a PNG, JPEG, GIF or WebP photo."));
    if (file.size > PICTURE_MAX_INPUT) return Promise.reject(new ApiError(413, "invalid", "The picture is larger than 30 MB. Choose a smaller one."));
    return fitPicture(file).then(sendPicture);
  };

  function sendPicture(file) {
    if (E1.isDemo()) {
      DEMO.user.picture = URL.createObjectURL(file);
      return later({ ok: true, picture: DEMO.user.picture });
    }
    var headers = { Accept: "application/json", "Content-Type": file.type };
    if (csrf) headers["X-E1-CSRF"] = csrf;
    return fetch(base + "/api/account/picture", { method: "POST", credentials: "include", headers: headers, body: file }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) throw new ApiError(res.status, (data && data.error && data.error.code) || "http_" + res.status, (data && data.error && data.error.message) || "The picture could not be saved.");
        return data;
      });
    }, function () {
      throw new ApiError(0, "unreachable", "The E1 cloud could not be reached. Check your connection and try again.");
    });
  }

  /** DELETE /api/account/picture: no picture (the sign-in provider's comes back at the next sign-in). */
  E1.removePicture = function () {
    if (E1.isDemo()) { DEMO.user.picture = null; return later({ ok: true }); }
    return request("DELETE", "/api/account/picture");
  };

  /** POST /auth/switch: work in another organization. */
  E1.switchOrg = function (orgId) {
    if (E1.isDemo()) {
      DEMO.org = DEMO.orgs.filter(function (o) { return o.id === orgId; })[0] || DEMO.org;
      return later({ ok: true });
    }
    return request("POST", "/auth/switch", { org: orgId }).then(noteServer);
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
    /** GET /api/training/notes[?course=key] → { notes: [{ id, lessonId, lessonTitle, courseKey, courseTitle, position, text, createdAt, updatedAt }] }, newest first. */
    notes: function (courseKey) {
      if (E1.isDemo()) return later(demoTraining.notes(courseKey));
      return request("GET", "/api/training/notes" + (courseKey ? "?course=" + encodeURIComponent(courseKey) : ""));
    },
    /** POST /api/training/notes { id?, lessonId, position, text } → { note }: a new note, or the note with that id changed. */
    saveNote: function (note) {
      if (E1.isDemo()) return Promise.resolve(demoTraining.saveNote(note));
      return request("POST", "/api/training/notes", { id: note.id || null, lessonId: note.lessonId, position: Math.round(note.position || 0), text: String(note.text || "") });
    },
    /** DELETE /api/training/notes/{id} → { ok } */
    deleteNote: function (id) {
      if (E1.isDemo()) return Promise.resolve(demoTraining.deleteNote(id));
      return request("DELETE", "/api/training/notes/" + encodeURIComponent(id));
    },
    /** GET /api/training/bookmarks[?course=key] → { bookmarks: [{ id, lessonId, lessonTitle, courseKey, courseTitle, position, createdAt }] }, newest first. */
    bookmarks: function (courseKey) {
      if (E1.isDemo()) return later(demoTraining.bookmarks(courseKey));
      return request("GET", "/api/training/bookmarks" + (courseKey ? "?course=" + encodeURIComponent(courseKey) : ""));
    },
    /** POST /api/training/bookmarks { lessonId, position } → { bookmark } */
    addBookmark: function (lessonId, position) {
      if (E1.isDemo()) return Promise.resolve(demoTraining.addBookmark(lessonId, position));
      return request("POST", "/api/training/bookmarks", { lessonId: lessonId, position: Math.round(position || 0) });
    },
    /** DELETE /api/training/bookmarks/{id} → { ok } */
    deleteBookmark: function (id) {
      if (E1.isDemo()) return Promise.resolve(demoTraining.deleteBookmark(id));
      return request("DELETE", "/api/training/bookmarks/" + encodeURIComponent(id));
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
    /*
     * A calendar day, the same everywhere: an invoice's date ("2027-07-01") or
     * a billing period's first instant (UTC midnight). Written in UTC, so a
     * visitor west of Greenwich does not see the day before.
     */
    day: function (iso) {
      if (!iso) return "–";
      var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? iso + "T00:00:00Z" : iso);
      return isNaN(d) ? "–" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
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
  /* Preview dates are counted back from today, but never from before
   * 15 July 2027, so no preview date falls before day zero (19 May 2027). */
  var DEMO_NOW = Math.max(Date.now(), Date.UTC(2027, 6, 15, 12));
  function demoAgo(days, hour, minute) {
    var d = new Date(DEMO_NOW - days * 86400000);
    d.setUTCHours(hour || 0, minute || 0, 0, 0);
    return d.toISOString();
  }
  function demoMonth(offset) {
    var d = new Date(DEMO_NOW);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString();
  }
  function demoInvoiceId(offset) {
    var d = new Date(demoMonth(offset));
    return "INV-" + d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2);
  }

  var DEMO = {
    csrf: "",
    user: { id: "u-demo", email: "alex.morgan@example.com", name: "Alex Morgan", givenName: "Alex", familyName: "Morgan", picture: null, locale: "en", timeZone: "Europe/Berlin" },
    org: { id: "org-acme", name: "Acme Process Engineering" },
    orgs: [
      { id: "org-acme", name: "Acme Process Engineering", role: "admin", license: "editor" },
      { id: "org-personal", name: "Alex Morgan (personal)", role: "owner", license: "editor" }
    ],
    license: { type: "editor", name: "Editor", assignedAt: demoAgo(60, 9, 12) },
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
      periodStart: demoMonth(0),
      periodEnd: demoMonth(1),
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
      periodStart: demoMonth(0),
      periodEnd: demoMonth(1),
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
      { id: "p-1", name: "Plant 3 — Hydrogen unit", role: "lead", roleName: "Lead engineer", lastOpenedAt: demoAgo(2, 16, 40), objects: 4210 },
      { id: "p-2", name: "Compressor station retrofit", role: "engineer", roleName: "Engineer", lastOpenedAt: demoAgo(7, 8, 5), objects: 1388 },
      { id: "p-3", name: "Utility steam network", role: "reviewer", roleName: "Reviewer", lastOpenedAt: demoAgo(24, 11, 20), objects: 962 }
    ],
    academy: {
      discussions: 6,
      courses: [
        { id: "c-start", title: "E1 in 30 minutes", category: "Getting started", summary: "Open a project, find your way around the model and make your first change.", lessons: 6, lessonsDone: 6, minutes: 32, minutesWatched: 32, status: "completed", certificate: true, url: "" },
        { id: "c-pid", title: "P&ID and process design", category: "Process", summary: "Equipment, lines and instruments in one model, from flowsheet to P&ID.", lessons: 9, lessonsDone: 4, minutes: 74, minutesWatched: 31, status: "in_progress", certificate: true, url: "" },
        { id: "c-branches", title: "Branches, pull and push", category: "Collaboration", summary: "Work on modification projects in a branch and bring the changes back to main.", lessons: 5, lessonsDone: 0, minutes: 41, minutesWatched: 0, status: "not_started", certificate: false, url: "" }
      ],
      certificates: [
        { id: "cert-1", title: "E1 Foundations", issuedAt: demoAgo(15, 10, 0), credentialId: "E1-F-0412", url: "" }
      ]
    },
    packages: [{ key: "core", name: "Core", version: "1.0.0" }, { key: "plant", name: "Plant", version: "1.0.0" }],
    billing: {
      canManage: true,
      provider: "Billing provider",
      nextInvoice: { date: demoMonth(1), amount: 1490, currency: "USD" },
      paymentMethod: "Card ending 4242",
      invoices: [
        { id: demoInvoiceId(0), date: demoMonth(0), amount: 1490, currency: "USD", status: "paid", url: "" },
        { id: demoInvoiceId(-1), date: demoMonth(-1), amount: 1490, currency: "USD", status: "paid", url: "" },
        { id: demoInvoiceId(-2), date: demoMonth(-2), amount: 1192, currency: "USD", status: "paid", url: "" }
      ]
    }
  };

  /* ---------- training preview (apiBase empty or ?demo=1) ----------
   * The catalog and quizzes are examples. On the server the answers never
   * reach the browser: the quiz is graded by POST .../quiz.
   */
  var DEMO_CLIP = "assets/clips/academy-first-pid-01.mp4";

  function v(id, title, seconds, extra) {
    var l = { id: id, type: "video", title: title, durationSeconds: seconds };
    for (var k in extra || {}) l[k] = extra[k];
    return l;
  }
  function q(id, title) { return { id: id, type: "quiz", title: title || "Final assessment", durationSeconds: 600 }; }

  /*
   * The preview's courses are the Academy syllabus (assets/js/academy-syllabus.js,
   * built by tools/academy/build.py from the user guides): every course with its
   * modules and lessons, and a final assessment. The assessment questions are
   * examples, the same for every course, until each course's own are written.
   */
  var SYLLABUS = window.E1_SYLLABUS || { paths: [], courses: [] };
  function demoCourse(sc) {
    var first = true;
    return {
      key: sc.key, title: sc.title, summary: sc.summary, outcome: sc.outcome, path: sc.path, level: sc.level,
      access: "included", price: null, passMark: 75,
      modules: sc.modules.map(function (m) {
        return { title: m.title, lessons: m.lessons.map(function (l) {
          var lesson = v(l.id, l.title, l.minutes * 60, { preview: first, features: l.features });
          first = false;
          return lesson;
        }) };
      }).concat([{ title: "Assessment", lessons: [q(sc.key + "-quiz")] }])
    };
  }
  var DEMO_QUIZ = [
    { id: "q1", text: "What is a symbol on a P&ID in E1?", options: [["a", "A representation of the object, which is the single source of truth"], ["b", "A drawing element with its own copy of the data"], ["c", "A picture you update by hand"]], answer: "a" },
    { id: "q2", text: "You change a pump's design pressure on its object. What follows?", options: [["a", "Only the drawing you are on"], ["b", "Every drawing, list and datasheet that shows the pump"], ["c", "Nothing until you export"]], answer: "b" },
    { id: "q3", text: "Alex changes the project in the Agent tab. How are those changes made?", options: [["a", "Under your name, through the same commands you use, and you can undo them"], ["b", "By a separate AI account nobody can undo"], ["c", "Only in an exported copy"]], answer: "a" },
    { id: "q4", text: "Where do you find each feature step by step?", options: [["a", "In the user guides, and in E1 with the E1 Guide"], ["b", "Only in a printed manual"], ["c", "Nowhere: you ask support"]], answer: "a" }
  ];

  var DEMO_TRAINING = {
    courses: SYLLABUS.courses.map(demoCourse),
    /* The progress the preview starts with: Getting started half done, Projects and the explorer completed. */
    seed: (function () {
      var progress = {}, gs = SYLLABUS.courses[0], pe = SYLLABUS.courses[1];
      function ids(c) { return c ? c.modules.reduce(function (a, m) { return a.concat(m.lessons.map(function (l) { return l; })); }, []) : []; }
      ids(gs).slice(0, 5).forEach(function (l) { progress[l.id] = { completed: true, position: l.minutes * 60 }; });
      var sixth = ids(gs)[5];
      if (sixth) progress[sixth.id] = { completed: false, position: 190 };
      ids(pe).forEach(function (l) { progress[l.id] = { completed: true, position: l.minutes * 60 }; });
      if (pe) progress[pe.key + "-quiz"] = { completed: true, position: 0, score: 100 };
      var second = ids(gs)[1];
      return {
        progress: progress,
        activity: gs && pe ? (function (a) { a[gs.key] = demoAgo(2, 18, 12); a[pe.key] = demoAgo(15, 15, 40); return a; })({}) : {},
        last: gs && sixth ? (function (a) { a[gs.key] = sixth.id; return a; })({}) : {},
        certificates: pe ? [{ id: "E1C-7KQ3-M9XP-2DWA", courseKey: pe.key, issuedAt: demoAgo(15, 15, 40), score: 100 }] : [],
        owned: [],
        notes: second ? [{ id: "n-demo-1", lessonId: second.id, position: 95, text: "The passkey replaces the password: set it up on the laptop and the phone.", createdAt: demoAgo(3, 10, 4), updatedAt: demoAgo(3, 10, 4) }] : [],
        bookmarks: sixth ? [{ id: "b-demo-1", lessonId: sixth.id, position: 120, createdAt: demoAgo(2, 18, 10) }] : []
      };
    })()
  };

  var demoTraining = (function () {
    var KEY = "e1_demo_training_v3";
    var memory = null;

    function load() {
      if (memory) return memory;
      try { memory = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { memory = null; }
      if (!memory || !memory.progress || !memory.notes) memory = JSON.parse(JSON.stringify(DEMO_TRAINING.seed));
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
        key: c.key, title: c.title, summary: c.summary, path: c.path, level: c.level, access: access(c), price: c.price,
        durationMinutes: Math.round(lessonsOf(c).reduce(function (t, l) { return t + l.durationSeconds; }, 0) / 60),
        lessons: lessonsOf(c).length, progress: progressOf(c), certificateId: cert ? cert.id : null
      };
    }

    function detail(c) {
      var st = load();
      var take = canTake(c);
      return {
        key: c.key, title: c.title, summary: c.summary, outcome: c.outcome, path: c.path, level: c.level, access: access(c), price: c.price, passMark: c.passMark,
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

    /* Rejected now, handed to the page 250 ms later (later()): marked as handled so the
       browser does not report it as an uncaught error in the meantime. */
    function fail(status, code, message) {
      var p = Promise.reject(new ApiError(status, code, message));
      p.catch(function () {});
      return p;
    }

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
          var fs = hit.lesson.features || [];
          out.notes = ["Preview: the film of this lesson is being recorded. It shows each step on Sample E1, labels exactly as on screen, and ends with a short recap."];
          out.guide = fs.map(function (f) { return { id: f.id, title: f.title, page: f.page, showMe: f.showMe || [] }; });
          var step = fs.length ? hit.lesson.durationSeconds / (fs.length + 1) : 0;
          out.transcript = [{ at: 0, text: "In this lesson: " + fs.map(function (f) { return f.title; }).join("; ") + "." }].concat(fs.map(function (f, i) {
            return { at: Math.round(step * (i + 1)), text: f.summary || f.title };
          }));
          out.resources = [];
        } else {
          out.passMark = hit.course.passMark;
          out.score = p.score == null ? null : p.score;
          out.questions = DEMO_QUIZ.map(function (x) {
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
        var bank = hit && hit.lesson.type === "quiz" ? DEMO_QUIZ : null;
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
      },
      notes: function (courseKey) {
        return { notes: load().notes.map(placed).filter(inCourse(courseKey)).sort(newest) };
      },
      saveNote: function (note) {
        var hit = findLesson(note.lessonId);
        var text = String(note.text || "").trim();
        if (!hit) return fail(404, "not_found", "There is no such lesson.");
        if (!text) return fail(400, "empty", "Write something first.");
        if (text.length > 4000) return fail(400, "too_long", "A note can be at most 4000 characters.");
        var st = load();
        var now = new Date().toISOString();
        var x = note.id ? st.notes.filter(function (n) { return n.id === note.id; })[0] : null;
        if (note.id && !x) return fail(404, "not_found", "That note no longer exists.");
        if (x) { x.text = text; x.updatedAt = now; }
        else {
          x = { id: "n-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), lessonId: note.lessonId, position: Math.max(0, Math.round(note.position || 0)), text: text, createdAt: now, updatedAt: now };
          st.notes.push(x);
        }
        save();
        return { note: placed(x) };
      },
      deleteNote: function (id) {
        var st = load();
        st.notes = st.notes.filter(function (n) { return n.id !== id; });
        save();
        return { ok: true };
      },
      bookmarks: function (courseKey) {
        return { bookmarks: load().bookmarks.map(placed).filter(inCourse(courseKey)).sort(newest) };
      },
      addBookmark: function (lessonId, position) {
        if (!findLesson(lessonId)) return fail(404, "not_found", "There is no such lesson.");
        var st = load();
        var pos = Math.max(0, Math.round(position || 0));
        var same = st.bookmarks.filter(function (b) { return b.lessonId === lessonId && Math.abs(b.position - pos) < 3; })[0];
        if (same) return { bookmark: placed(same) };
        var b = { id: "b-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), lessonId: lessonId, position: pos, createdAt: new Date().toISOString() };
        st.bookmarks.push(b);
        save();
        return { bookmark: placed(b) };
      },
      deleteBookmark: function (id) {
        var st = load();
        st.bookmarks = st.bookmarks.filter(function (b) { return b.id !== id; });
        save();
        return { ok: true };
      }
    };

    /* A note or bookmark with its lesson's and course's titles, as the server sends it. */
    function placed(x) {
      var hit = findLesson(x.lessonId);
      var out = {};
      for (var k in x) out[k] = x[k];
      out.lessonTitle = hit ? hit.lesson.title : "";
      out.courseKey = hit ? hit.course.key : "";
      out.courseTitle = hit ? hit.course.title : "";
      return out;
    }
    function inCourse(key) { return function (x) { return !key || x.courseKey === key; }; }
    function newest(a, b) { return (a.updatedAt || a.createdAt) < (b.updatedAt || b.createdAt) ? 1 : -1; }
  })();

  window.E1 = E1;
})();

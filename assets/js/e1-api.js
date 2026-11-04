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

  /** POST /auth/logout. */
  E1.logout = function () {
    E1.rememberSignedIn(false);
    if (E1.isDemo()) return later({ ok: true });
    return request("POST", "/auth/logout").catch(function () { return { ok: true }; });
  };

  /** The release manifest of the download area. */
  E1.releases = function () {
    return fetch(config.releases || "assets/data/releases.json", { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("No release manifest");
      return res.json();
    });
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
        return Number(amount).toLocaleString(undefined, { style: "currency", currency: currency || "EUR" });
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
    packages: [{ key: "core", name: "Core", version: "1.1.0" }, { key: "plant", name: "Plant", version: "1.1.0" }],
    billing: {
      canManage: true,
      provider: "Billing provider",
      nextInvoice: { date: "2026-12-01T00:00:00Z", amount: 1490, currency: "EUR" },
      paymentMethod: "Card ending 4242",
      invoices: [
        { id: "INV-2026-011", date: "2026-11-01T00:00:00Z", amount: 1490, currency: "EUR", status: "paid", url: "" },
        { id: "INV-2026-010", date: "2026-10-01T00:00:00Z", amount: 1490, currency: "EUR", status: "paid", url: "" },
        { id: "INV-2026-009", date: "2026-09-01T00:00:00Z", amount: 1192, currency: "EUR", status: "paid", url: "" }
      ]
    }
  };

  window.E1 = E1;
})();

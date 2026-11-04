/*
 * The download area: Windows, macOS and Linux cards built from the release
 * manifest (assets/data/releases.json, or the address in E1_CONFIG.releases).
 * Used by download.html and the Downloads section of account.html.
 *
 * <div data-downloads></div>            the cards
 * <p data-release-line></p>             version and date (optional)
 * <ul data-release-notes></ul>          release notes (optional)
 *
 * A file whose url is null shows "Coming soon". The visitor's own system is
 * shown first and marked "Your system".
 */
(function () {
  "use strict";

  var ORDER = ["windows", "mac", "linux"];

  function detectOs() {
    var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "";
    ua = ua.toLowerCase();
    if (ua.indexOf("win") !== -1) return "windows";
    if (ua.indexOf("mac") !== -1) return "mac";
    if (ua.indexOf("linux") !== -1 || ua.indexOf("x11") !== -1) return "linux";
    return "";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function size(n) {
    return window.E1 ? E1.format.bytes(n) : n + " B";
  }

  function card(key, platform, version, mine) {
    var files = (platform.files || []).map(function (f) {
      if (!f.url) {
        return '<span class="btn btn-ghost btn-sm" aria-disabled="true">' + esc(f.label) + " · Coming soon</span>";
      }
      var meta = [f.size ? size(f.size) : "", f.sha256 ? "SHA-256 " + esc(f.sha256.slice(0, 12)) + "…" : ""].filter(Boolean).join(" · ");
      return '<a class="btn ' + (mine ? "btn-primary" : "btn-ghost") + ' btn-sm" href="' + esc(f.url) + '" download' +
        (f.sha256 ? ' title="SHA-256 ' + esc(f.sha256) + '"' : "") + ">" + esc(f.label) + "</a>" +
        (meta ? '<span class="meta">' + meta + "</span>" : "");
    }).join("");

    return '<div class="card download-card' + (mine ? " is-mine" : "") + '">' +
      "<h3>" + esc(platform.name) + (mine ? ' <span class="badge">Your system</span>' : "") + "</h3>" +
      '<p class="muted">' + esc(platform.requirements) + "</p>" +
      '<span class="meta">Version ' + esc(version) + "</span>" +
      '<div class="download-files">' + files + "</div>" +
      "</div>";
  }

  function render(manifest) {
    var mine = detectOs();
    var keys = ORDER.filter(function (k) { return manifest.platforms && manifest.platforms[k]; });
    if (mine) keys.sort(function (a, b) { return (b === mine) - (a === mine); });

    document.querySelectorAll("[data-downloads]").forEach(function (mount) {
      mount.innerHTML = keys.map(function (k) { return card(k, manifest.platforms[k], manifest.version, k === mine); }).join("");
    });

    document.querySelectorAll("[data-release-line]").forEach(function (el) {
      el.textContent = "Current version " + manifest.version + (manifest.date ? " · released " + (window.E1 ? E1.format.date(manifest.date) : manifest.date) : "") +
        (manifest.channel ? " · " + manifest.channel + " channel" : "");
    });

    document.querySelectorAll("[data-release-notes]").forEach(function (list) {
      list.innerHTML = (manifest.notes || []).map(function (n) {
        return "<li><span>" + esc(n.version) + (n.date ? " · " + esc(window.E1 ? E1.format.date(n.date) : n.date) : "") + '</span><span class="muted">' + esc(n.text) + "</span></li>";
      }).join("");
    });
  }

  function load() {
    if (!document.querySelector("[data-downloads]")) return;
    var get = window.E1 ? E1.releases() : fetch("assets/data/releases.json").then(function (r) { return r.json(); });
    get.then(render, function () {
      document.querySelectorAll("[data-downloads]").forEach(function (mount) {
        mount.innerHTML = '<p class="muted">Downloads are not available right now.</p>';
      });
    });
  }

  window.E1Downloads = { load: load, detectOs: detectOs };
  document.addEventListener("DOMContentLoaded", load);
})();

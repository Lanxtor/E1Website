/*
 * certificate.html?id={id}: a training certificate anyone with the link can
 * open to verify it (GET /api/training/certificates/{id}, public), and the
 * holder's tools to share it, add it to LinkedIn, download it as an image or
 * print it. The certificate is drawn as SVG, so the page, the PNG and the
 * print are the same picture. Shapes: docs/TRAINING.md.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-certificate-page]");
  if (!root || !window.E1) return;

  var fmt = E1.format;
  var id = (new URLSearchParams(location.search).get("id") || "").trim();
  var cert = null;
  var shareFile = null;
  var W = 1600, H = 1131; // A4 landscape

  function $(sel) { return root.querySelector(sel); }
  function $all(sel) { return root.querySelectorAll(sel); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function show(state) {
    $all("[data-state]").forEach(function (el) { el.hidden = el.getAttribute("data-state") !== state; });
  }

  function longDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  }

  /* Font size that keeps a line of text inside the given width. */
  function fit(text, max, width, ratio) {
    var len = String(text || "").length || 1;
    return Math.round(Math.min(max, width / (len * ratio)));
  }

  /* ---------- the certificate as SVG ---------- */

  function svg(c) {
    var url = E1.training.certificateUrl(c.id).replace(/^https?:\/\//, "");
    var font = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
    var nameSize = fit(c.holderName, 92, 1240, 0.56);
    var courseSize = fit(c.courseTitle, 56, 1240, 0.54);
    var details = ["LANXTOR E1 training", c.level, c.hours ? c.hours + (c.hours === 1 ? " hour" : " hours") : "", c.score != null ? "Final assessment " + c.score + "%" : ""]
      .filter(Boolean).join("   ·   ");
    var revoked = c.status === "revoked";

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' +
      esc("Certificate of completion: " + c.holderName + ", " + c.courseTitle + ", issued " + longDate(c.issuedAt)) + '" font-family="' + font + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1565c0"/><stop offset="1" stop-color="#0b2a4a"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
      '<rect x="36" y="36" width="' + (W - 72) + '" height="' + (H - 72) + '" fill="none" stroke="#0b2a4a" stroke-width="3"/>' +
      '<rect x="52" y="52" width="' + (W - 104) + '" height="' + (H - 104) + '" fill="none" stroke="#e6e8eb" stroke-width="2"/>' +
      '<path d="M36 36h220L36 256z" fill="url(#g)"/>' +
      '<path d="M' + (W - 36) + " " + (H - 36) + "h-220l220-220z" + '" fill="url(#g)"/>' +

      // brand
      '<g transform="translate(' + (W / 2 - 118) + ',128)">' +
      '<rect x="0" y="0" width="56" height="56" rx="14" fill="#0b2a4a"/>' +
      '<path d="M16 16v24h24" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<circle cx="37" cy="19" r="4.6" fill="#f08c2e"/>' +
      '<text x="76" y="40" font-size="34" font-weight="700" letter-spacing="3" fill="#0b2a4a">LANXTOR</text></g>' +

      '<text x="' + W / 2 + '" y="290" text-anchor="middle" font-size="26" font-weight="600" letter-spacing="9" fill="#5b6470">CERTIFICATE OF COMPLETION</text>' +
      '<text x="' + W / 2 + '" y="380" text-anchor="middle" font-size="28" fill="#5b6470">This certifies that</text>' +
      '<text x="' + W / 2 + '" y="' + (470 + nameSize * 0.12) + '" text-anchor="middle" font-size="' + nameSize + '" font-weight="700" letter-spacing="-1" fill="#0b2a4a">' + esc(c.holderName) + "</text>" +
      '<line x1="' + (W / 2 - 360) + '" y1="530" x2="' + (W / 2 + 360) + '" y2="530" stroke="#e6e8eb" stroke-width="2"/>' +
      '<text x="' + W / 2 + '" y="596" text-anchor="middle" font-size="28" fill="#5b6470">has successfully completed the course</text>' +
      '<text x="' + W / 2 + '" y="' + (684 + courseSize * 0.1) + '" text-anchor="middle" font-size="' + courseSize + '" font-weight="600" fill="#1565c0">' + esc(c.courseTitle) + "</text>" +
      '<text x="' + W / 2 + '" y="760" text-anchor="middle" font-size="24" fill="#5b6470">' + esc(details) + "</text>" +

      // footer: date, seal, ID
      '<text x="200" y="905" font-size="20" font-weight="600" letter-spacing="3" fill="#5b6470">ISSUED</text>' +
      '<text x="200" y="948" font-size="30" font-weight="600" fill="#0b2a4a">' + esc(longDate(c.issuedAt)) + "</text>" +
      '<line x1="200" y1="972" x2="560" y2="972" stroke="#0b2a4a" stroke-width="2"/>' +
      '<text x="200" y="1006" font-size="20" fill="#5b6470">' + esc(c.issuer || "LANXTOR") + "</text>" +

      '<g transform="translate(' + W / 2 + ',935)">' +
      '<circle r="86" fill="url(#g)"/><circle r="72" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 6"/>' +
      '<text y="-14" text-anchor="middle" font-size="20" font-weight="700" letter-spacing="3" fill="#fff">E1</text>' +
      '<text y="16" text-anchor="middle" font-size="15" font-weight="600" letter-spacing="2.5" fill="#fff">CERTIFIED</text>' +
      '<path d="M-14 34l9 9 19-19" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +

      '<text x="' + (W - 200) + '" y="905" text-anchor="end" font-size="20" font-weight="600" letter-spacing="3" fill="#5b6470">CERTIFICATE ID</text>' +
      '<text x="' + (W - 200) + '" y="948" text-anchor="end" font-size="30" font-weight="600" fill="#0b2a4a" font-family="ui-monospace, Menlo, Consolas, monospace">' + esc(c.id) + "</text>" +
      '<line x1="' + (W - 560) + '" y1="972" x2="' + (W - 200) + '" y2="972" stroke="#0b2a4a" stroke-width="2"/>' +
      '<text x="' + (W - 200) + '" y="1006" text-anchor="end" font-size="20" fill="#5b6470">Verify this certificate at</text>' +
      '<text x="' + (W - 200) + '" y="1034" text-anchor="end" font-size="' + fit(url, 20, 420, 0.52) + '" fill="#5b6470">' + esc(url) + "</text>" +

      (revoked
        ? '<g transform="translate(' + W / 2 + "," + H / 2 + ') rotate(-18)"><rect x="-330" y="-70" width="660" height="140" rx="12" fill="#fff" fill-opacity=".85" stroke="#b42318" stroke-width="6"/>' +
          '<text y="26" text-anchor="middle" font-size="76" font-weight="800" letter-spacing="8" fill="#b42318">REVOKED</text></g>'
        : "") +
      "</svg>";
  }

  /* ---------- page ---------- */

  function render(c) {
    cert = c;
    var revoked = c.status === "revoked";
    document.title = c.courseTitle + " — certificate of " + c.holderName + " — LANXTOR E1";
    $("[data-demo-banner]").hidden = !E1.isDemo();

    $("[data-verify]").className = "cert-verify" + (revoked ? " is-revoked" : "");
    $("[data-verify]").innerHTML = revoked
      ? '<strong>This certificate has been revoked.</strong> <span>It is no longer valid.</span>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>' +
        "<span><strong>Verified certificate.</strong> Issued by " + esc(c.issuer || "LANXTOR") + " to <strong>" + esc(c.holderName) + "</strong> on " + fmt.date(c.issuedAt) +
        " for completing <strong>" + esc(c.courseTitle) + "</strong>.</span>";

    $("[data-cert-figure]").innerHTML = svg(c) +
      '<figcaption class="visually-hidden">Certificate ' + esc(c.id) + "</figcaption>";

    var links = E1.training.shareLinks(c);
    $all("[data-share]").forEach(function (a) { a.href = links[a.getAttribute("data-share")]; });
    $(".cert-side").hidden = revoked;
    if (navigator.share) {
      $("[data-native-share]").hidden = false;
      png(1).then(function (blob) {
        try { shareFile = new File([blob], fileName(), { type: "image/png" }); } catch (e) { shareFile = null; }
      }, function () { shareFile = null; });
    }
    show("ready");
  }

  function load() {
    if (!id) { show("not-found"); return; }
    show("loading");
    E1.training.certificate(id).then(function (c) {
      if (!c) { show("not-found"); return; }
      render(c);
    }, function (err) {
      $("[data-error-text]").textContent = (err && err.message) || "The E1 cloud could not be reached.";
      show("error");
    });
  }

  /* The certificate drawn on a canvas, as a PNG blob. */
  function png(scale) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = W * scale;
        canvas.height = H * scale;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error("The image could not be made.")); }, "image/png");
      };
      img.onerror = function () { reject(new Error("The image could not be made.")); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(cert));
    });
  }

  function fileName() {
    return "LANXTOR-E1-certificate-" + cert.id + ".png";
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-retry],[data-copy],[data-download-png],[data-print],[data-native-share]");
    if (!t) return;
    if (t.hasAttribute("data-retry")) load();
    if (t.hasAttribute("data-print")) window.print();

    if (t.hasAttribute("data-copy")) {
      var url = E1.training.certificateUrl(cert.id);
      var label = t.querySelector("[data-copy-label]");
      var done = function () { label.textContent = "Copied"; setTimeout(function () { label.textContent = "Copy link"; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
      } else {
        prompt("Copy this link:", url);
      }
    }

    if (t.hasAttribute("data-download-png")) {
      t.disabled = true;
      png(1.5).then(function (blob) {
        t.disabled = false;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName();
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }, function (err) { t.disabled = false; alert(err.message); });
    }

    if (t.hasAttribute("data-native-share")) {
      var links = E1.training.shareLinks(cert);
      var data = { title: cert.courseTitle + " certificate", text: links.text, url: links.url };
      // With the image where the device can share files (phones: Instagram, WhatsApp, …).
      // The file is made in advance: share() must run while the tap still counts.
      if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) data.files = [shareFile];
      navigator.share(data).catch(function () { /* cancelled */ });
    }
  });

  document.addEventListener("DOMContentLoaded", load);
})();

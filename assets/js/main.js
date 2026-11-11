(function () {
  "use strict";

  var BRAND = "LANXTOR";
  var T = function (s, v) { return window.E1_T ? window.E1_T(s, v) : s; };
  var H = function (h) { return window.E1_href ? window.E1_href(h) : h; };
  var PRODUCT = "E1";

  var NAV = [
    { href: "index.html", label: "Home" },
    { href: "solutions.html", label: "Solutions" },
    { href: "academy.html", label: "Academy" },
    { href: "shape-e1.html", label: "Contact us" },
    { href: "about.html", label: "About us" }
  ];

  var CHEVRON_SVG =
    '<svg class="chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var LOGO_SVG =
    '<svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
    '<rect x="1" y="1" width="30" height="30" rx="8" fill="#0b2a4a"/>' +
    '<path d="M9 9v14h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="21" cy="11" r="2.6" fill="#f08c2e"/>' +
    "</svg>";

  var PLAY_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none"/></svg>';

  function currentPage() {
    var file = location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  /* "Account" once the person has signed in on this browser, else "Log in". */
  function accountLink() {
    var signedIn = window.E1 && E1.probablySignedIn();
    var page = currentPage();
    if (signedIn) {
      return '<a class="btn btn-ghost btn-sm" href="account.html"' + (page === "account.html" ? ' aria-current="page"' : "") + ">" + T("Account") + "</a>";
    }
    return '<a class="btn btn-ghost btn-sm" href="login.html">' + T("Log in") + "</a>";
  }

  var GLOBE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  /* Language switch: the same page in another language. */
  function langSwitch() {
    var langs = window.E1_LANGS;
    if (!langs) return "";
    var cur = window.E1_LANG || "en";
    var items = langs.map(function (l) {
      return '<li><a href="' + window.E1_hrefFor(l.code) + '" data-lang-pick="' + l.code + '" lang="' + l.code + '"' +
        (l.code === cur ? ' aria-current="true"' : "") + ">" + l.name + "</a></li>";
    }).join("");
    return '<div class="lang-switch">' +
      '<button type="button" class="lang-toggle" aria-expanded="false" aria-label="' + T("Language") + '">' +
      GLOBE_SVG + "<span>" + cur.toUpperCase() + "</span>" + CHEVRON_SVG + "</button>" +
      '<ul class="lang-menu">' + items + "</ul></div>";
  }

  /*
   * Cookie notice. The site uses only storage it needs to work (language,
   * currency, sign-in), which needs no consent; the notice tells visitors so,
   * once. If optional cookies (analytics) are ever added, ask here first and
   * read the answer from E1_consent() before loading them.
   */
  var COOKIE_KEY = "e1.cookies";
  window.E1_consent = function () { try { return localStorage.getItem(COOKIE_KEY) || ""; } catch (e) { return ""; } };

  function showCookieNotice() {
    if (document.querySelector(".cookie-notice")) return;
    var box = document.createElement("div");
    box.className = "cookie-notice";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", T("Cookies"));
    box.innerHTML =
      "<p><b>" + T("Cookies") + ".</b> " +
      T("We only use cookies and browser storage that this website needs to work, such as your language, your currency and staying signed in. No tracking, no advertising.") +
      ' <a href="' + H("privacy.html#cookies") + '">' + T("Privacy policy") + "</a></p>" +
      '<button type="button" class="btn btn-primary btn-sm">' + T("OK") + "</button>";
    box.querySelector("button").addEventListener("click", function () {
      try { localStorage.setItem(COOKIE_KEY, "necessary"); } catch (e) {}
      box.remove();
    });
    document.body.appendChild(box);
  }

  function initCookies() {
    if (!window.E1_consent()) showCookieNotice();
    document.querySelectorAll("[data-cookie-settings]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); showCookieNotice(); });
    });
  }

  /*
   * Page tabs: <nav data-page-tabs> with <a href="#x" data-tab="x"> links and
   * sections with data-tab-panel="x". One panel shows at a time; the first is
   * the default, and the address (#x) opens a tab directly. Without JS, all
   * sections stay visible and the links jump to them.
   */
  function initPageTabs() {
    var nav = document.querySelector("[data-page-tabs]");
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll("[data-tab]"));
    var panels = document.querySelectorAll("[data-tab-panel]");
    function show(id, scroll) {
      if (!links.some(function (a) { return a.getAttribute("data-tab") === id; })) id = links[0].getAttribute("data-tab");
      links.forEach(function (a) {
        if (a.getAttribute("data-tab") === id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      panels.forEach(function (p) {
        p.hidden = p.getAttribute("data-tab-panel") !== id;
        if (!p.hidden) p.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
      });
      if (scroll) nav.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("data-tab");
        history.replaceState(null, "", "#" + id);
        show(id, false);
      });
    });
    show(location.hash.slice(1), !!location.hash);
    window.addEventListener("hashchange", function () { show(location.hash.slice(1), true); });
  }

  function initLangSwitch() {
    var box = document.querySelector(".lang-switch");
    if (!box) return;
    var btn = box.querySelector(".lang-toggle");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = box.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    box.querySelectorAll("[data-lang-pick]").forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.E1_rememberLang) window.E1_rememberLang(a.getAttribute("data-lang-pick"));
      });
    });
    document.addEventListener("click", function () { box.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { box.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); } });
  }

  function renderHeader() {
    var mount = document.getElementById("site-header");
    if (!mount) return;
    var page = currentPage();

    var links = NAV.map(function (item) {
      if (item.children) {
        var active = item.children.some(function (c) { return c.href === page; });
        var sub = item.children.map(function (c) {
          var cur = c.href === page ? ' aria-current="page"' : "";
          return '<li><a href="' + H(c.href) + '"' + cur + ">" +
            '<span class="sub-label">' + T(c.label) + "</span>" +
            (c.desc ? '<span class="sub-desc">' + c.desc + "</span>" : "") +
            "</a></li>";
        }).join("");
        return '<li class="has-sub' + (active ? " is-active" : "") + '">' +
          '<button type="button" class="sub-toggle" aria-expanded="false">' + T(item.label) + CHEVRON_SVG + "</button>" +
          '<ul class="submenu">' + sub + "</ul></li>";
      }
      var current = item.href === page ? ' aria-current="page"' : "";
      return '<li><a href="' + H(item.href) + '"' + current + ">" + T(item.label) + "</a></li>";
    }).join("");

    mount.outerHTML =
      '<header class="site-header">' +
      '<div class="container">' +
      '<a class="brand" href="' + H("index.html") + '" aria-label="' + BRAND + '">' + LOGO_SVG + "<span>" + BRAND + "</span></a>" +
      '<nav class="nav" aria-label="Main">' +
      '<ul class="nav-links">' + links + "</ul>" +
      '<div class="nav-actions">' +
      langSwitch() +
      accountLink() +
      '<a class="btn btn-primary btn-sm" href="' + H("download.html") + '">' + T("Get E1") + "</a>" +
      "</div>" +
      "</nav>" +
      (page === "download.html" ? "" : '<a class="btn btn-primary btn-sm header-cta" href="' + H("download.html") + '">' + T("Get E1") + "</a>") +
      '<button class="nav-toggle" aria-label="' + T("Toggle menu") + '" aria-expanded="false"><span></span><span></span><span></span></button>' +
      "</div>" +
      "</header>";
  }

  function renderFooter() {
    var mount = document.getElementById("site-footer");
    if (!mount) return;
    var year = new Date().getFullYear();

    mount.outerHTML =
      '<footer class="site-footer">' +
      '<div class="container">' +
      '<div class="footer-grid">' +
      "<div>" +
      '<a class="brand" href="' + H("index.html") + '">' + LOGO_SVG + "<span>" + BRAND + "</span></a>" +
      "<p>" + T("Engineering software for production plants and energy.") + "</p>" +
      "</div>" +
      "<div><h2 class=\"footer-h\">" + T("Product") + "</h2><ul>" +
      '<li><a href="' + H("index.html") + '">' + T("Overview") + "</a></li>" +
      '<li><a href="' + H("solutions.html") + '">' + T("Solutions") + "</a></li>" +
      '<li><a href="' + H("academy.html") + '">' + T("Academy") + "</a></li>" +
      '<li><a href="' + H("download.html") + '">' + T("Get E1") + "</a></li>" +
      '<li><a href="' + H("download.html#pricing") + '">' + T("Pricing") + "</a></li>" +
      "</ul></div>" +
      "<div><h2 class=\"footer-h\">" + T("Company") + "</h2><ul>" +
      '<li><a href="' + H("about.html") + '">' + T("About us") + "</a></li>" +
      '<li><a href="' + H("shape-e1.html") + '">' + T("Contact us") + "</a></li>" +
      '<li><a href="' + H("contact-sales.html") + '">' + T("Contact sales") + "</a></li>" +
      '<li><a href="account.html">' + T("Your account") + "</a></li>" +
      '<li><a href="' + H("privacy.html") + '">' + T("Privacy policy") + "</a></li>" +
      '<li><a href="https://www.linkedin.com/company/lanxtor/" target="_blank" rel="noopener">LinkedIn</a></li>' +
      "</ul></div>" +
      "</div>" +
      '<div class="footer-bottom"><span>&copy; ' + year + " Lanxtor Inc. " + T("All rights reserved.") + "</span>" +
      '<nav class="footer-legal" aria-label="' + T("Legal") + '">' +
      '<a href="' + H("legal.html") + '">' + T("Legal notice") + "</a>" +
      '<a href="' + H("privacy.html") + '">' + T("Privacy policy") + "</a>" +
      '<a href="' + H("privacy.html#cookies") + '" data-cookie-settings>' + T("Cookies") + "</a>" +
      '<a href="' + H("terms.html") + '">' + T("Terms of use") + "</a>" +
      '<a href="e1-terms.html">' + T("License agreement") + "</a>" +
      '<a href="' + H("security.html") + '">' + T("Security") + "</a>" +
      "</nav></div>" +
      "</div>" +
      "</footer>";
  }

  function initHeaderBehaviour() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    if (!header) return;

    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }

    var subs = document.querySelectorAll(".has-sub");
    var closeAll = function (except) {
      subs.forEach(function (li) {
        if (li === except) return;
        li.classList.remove("is-open");
        li.querySelector(".sub-toggle").setAttribute("aria-expanded", "false");
      });
    };

    subs.forEach(function (li) {
      var btn = li.querySelector(".sub-toggle");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeAll(li);
        var open = li.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });

    document.addEventListener("click", function () { closeAll(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /*
   * Clips: <figure class="clip" data-src="assets/clips/x.mp4" data-label="...">
   * The video is created lazily, plays while on screen and pauses off screen.
   * If the file is missing, the placeholder stays visible.
   */
  function initClips() {
    var clips = document.querySelectorAll(".clip");

    clips.forEach(function (clip) {
      var label = clip.getAttribute("data-label") || T("Clip placeholder");
      var ph = document.createElement("div");
      ph.className = "clip-placeholder";
      ph.innerHTML = PLAY_SVG + "<span>" + label + "</span>";
      clip.appendChild(ph);
    });

    if (!("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var clip = entry.target;
        var src = clip.getAttribute("data-src");
        if (!src) return;

        var video = clip.querySelector("video");

        if (entry.isIntersecting) {
          if (!video) {
            video = document.createElement("video");
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = "auto";
            video.setAttribute("aria-hidden", "true");
            var poster = clip.getAttribute("data-poster");
            if (poster) video.poster = poster;
            video.addEventListener("loadeddata", function () { clip.classList.add("is-ready"); });
            video.addEventListener("error", function () { clip.classList.remove("is-ready"); });
            video.src = src;
            clip.insertBefore(video, clip.firstChild);
          }
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        } else if (video) {
          video.pause();
        }
      });
    }, { threshold: 0.35 });

    clips.forEach(function (clip) { io.observe(clip); });
  }

  /*
   * login.html: no password is typed here. "Continue" sends the browser to the
   * E1 server's sign-in (Microsoft Entra External ID), which returns to
   * account.html signed in. Sign up uses the same page of the provider.
   */
  function initAuthTabs() {
    var box = document.querySelector("[data-auth]");
    if (!box) return;

    var tabs = box.querySelectorAll(".tabs button");
    var title = box.querySelector("[data-auth-title]");
    var lead = box.querySelector("[data-auth-lead]");
    var submit = box.querySelector("[data-auth-submit]");
    var notice = box.querySelector("[data-auth-notice]");
    var api = window.E1;
    var returnTo = new URLSearchParams(location.search).get("return") || "";
    var mode = "login";

    function setMode(next) {
      mode = next;
      var signup = mode === "signup";
      tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.mode === mode)); });
      title.textContent = signup ? "Create your account" : "Welcome back";
      lead.textContent = signup
        ? "Create your account and start your free 30-day trial, for you and your team."
        : "Sign in to see your licenses, usage, projects and downloads.";
      submit.textContent = signup ? "Start your free 30-day trial" : "Continue to sign in";
      // Sign up: the trial panel next to the form (15 people, 30 days).
      var promo = document.querySelector("[data-trial-promo]");
      if (promo) {
        promo.hidden = !signup;
        box.parentElement.classList.toggle("has-promo", signup);
      }
      var url = api && api.isDemo() ? "" : api && api.loginUrl(mode, returnTo && new URL(returnTo, location.href).href);
      submit.setAttribute("href", url || "account.html?demo=1");
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () { setMode(t.dataset.mode); });
    });

    if (location.hash === "#signup") setMode("signup");
    else setMode("login");

    // Companies whose Microsoft accounts are connected to E1 sign in with them.
    var microsoft = box.querySelector("[data-auth-microsoft]");
    if (microsoft && api && api.configured() && !api.isDemo()) {
      api.providers().then(function (p) {
        if (!p || !p.microsoft) return;
        microsoft.setAttribute("href", api.microsoftLoginUrl(returnTo && new URL(returnTo, location.href).href));
        microsoft.hidden = false;
      });
    }

    submit.addEventListener("click", function (e) {
      if (api && api.configured()) return;
      // Not connected yet: say so, and offer the preview of the account page.
      e.preventDefault();
      notice.hidden = false;
      notice.innerHTML = 'Sign-in is not connected to the E1 cloud yet. <a href="account.html?demo=1">See a preview of the account page</a>.';
    });
  }

  function initCatalog() {
    var list = document.querySelector("[data-catalog-list]");
    if (!list) return;

    var items = Array.prototype.slice.call(list.querySelectorAll(".catalog-item"));
    var search = document.querySelector("[data-catalog-search]");
    var chips = Array.prototype.slice.call(document.querySelectorAll("[data-catalog-filter]"));
    var countEl = document.querySelector("[data-catalog-count]");
    var emptyEl = document.querySelector("[data-catalog-empty]");
    var resetBtn = document.querySelector("[data-catalog-reset]");
    var activeFilter = "all";

    function normalize(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/&amp;/g, "&")
        .replace(/[^a-z0-9+&#.\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function apply() {
      var query = normalize(search ? search.value : "");
      var visible = 0;

      items.forEach(function (item) {
        var categories = normalize(item.getAttribute("data-category")).split(" ");
        var haystack = normalize([
          item.getAttribute("data-tags"),
          item.textContent
        ].join(" "));

        var categoryOk = activeFilter === "all" || categories.indexOf(activeFilter) !== -1;
        var searchOk = !query || haystack.indexOf(query) !== -1;
        var show = categoryOk && searchOk;

        item.classList.toggle("is-hidden", !show);
        if (show) visible += 1;
      });

      if (countEl) {
        countEl.textContent = visible === items.length
          ? visible + " " + T("features")
          : T("Showing {visible} of {total}", { visible: visible, total: items.length });
      }

      if (emptyEl) emptyEl.hidden = visible !== 0;
      list.hidden = visible === 0;
    }

    function setFilter(filter) {
      activeFilter = filter;
      chips.forEach(function (chip) {
        var on = chip.getAttribute("data-catalog-filter") === filter;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", String(on));
      });
      apply();
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        setFilter(chip.getAttribute("data-catalog-filter"));
      });
    });

    if (search) {
      search.addEventListener("input", apply);
      search.addEventListener("search", apply);
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (search) search.value = "";
        setFilter("all");
        if (search) search.focus();
      });
    }

    apply();
  }

  /*
   * Launch strip: <div class="launch" data-launch="YYYY-MM-DD">
   * Update the counters by changing data-count on each <dd>.
   */
  function initLaunch() {
    var box = document.querySelector("[data-launch]");
    if (!box) return;

    var countdown = box.querySelector("[data-launch-countdown]");
    var launch = new Date(box.getAttribute("data-launch") + "T00:00:00");
    if (countdown && !isNaN(launch)) {
      var days = Math.ceil((launch - new Date()) / 86400000);
      countdown.textContent = days > 1 ? "in " + days + " days" : days === 1 ? "tomorrow" : days === 0 ? "today" : "live";
    }

    var counters = box.querySelectorAll("[data-count]");
    var format = function (n) { return Math.round(n).toLocaleString("en-US"); };
    var run = function () {
      counters.forEach(function (el) {
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        if (target === 0) { el.textContent = "0"; return; }
        var start = performance.now();
        var step = function (now) {
          var t = Math.min((now - start) / 1400, 1);
          el.textContent = format(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };

    if (!("IntersectionObserver" in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(box);
  }

  renderHeader();
  renderFooter();

  document.addEventListener("DOMContentLoaded", function () {
    initHeaderBehaviour();
    initLangSwitch();
    initCookies();
    initPageTabs();
    initReveal();
    initClips();
    initAuthTabs();
    initCatalog();
    initLaunch();
  });
})();

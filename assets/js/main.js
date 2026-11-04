(function () {
  "use strict";

  var BRAND = "LANXTOR";
  var PRODUCT = "E1";

  var NAV = [
    { href: "solutions.html", label: "Solutions" },
    { href: "user-guides.html", label: "User guides" },
    { href: "shape-e1.html", label: "Shape E1 with us" },
    { href: "pricing.html", label: "Pricing" },
    { href: "about.html", label: "About us" }
  ];

  var CHEVRON_SVG =
    '<svg class="chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var LOGO_SVG =
    '<svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
    '<rect x="1" y="1" width="30" height="30" rx="8" fill="#0e1116"/>' +
    '<path d="M9 9v14h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="21" cy="11" r="2.6" fill="#1f5cff"/>' +
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
      return '<a class="btn btn-ghost btn-sm" href="account.html"' + (page === "account.html" ? ' aria-current="page"' : "") + ">Account</a>";
    }
    return '<a class="btn btn-ghost btn-sm" href="login.html">Log in</a>';
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
          return '<li><a href="' + c.href + '"' + cur + ">" +
            '<span class="sub-label">' + c.label + "</span>" +
            (c.desc ? '<span class="sub-desc">' + c.desc + "</span>" : "") +
            "</a></li>";
        }).join("");
        return '<li class="has-sub' + (active ? " is-active" : "") + '">' +
          '<button type="button" class="sub-toggle" aria-expanded="false">' + item.label + CHEVRON_SVG + "</button>" +
          '<ul class="submenu">' + sub + "</ul></li>";
      }
      var current = item.href === page ? ' aria-current="page"' : "";
      return '<li><a href="' + item.href + '"' + current + ">" + item.label + "</a></li>";
    }).join("");

    mount.outerHTML =
      '<header class="site-header">' +
      '<div class="container">' +
      '<a class="brand" href="index.html" aria-label="' + BRAND + ' home">' + LOGO_SVG + "<span>" + BRAND + "</span></a>" +
      '<nav class="nav" aria-label="Main">' +
      '<ul class="nav-links">' + links + "</ul>" +
      '<div class="nav-actions">' +
      accountLink() +
      '<a class="btn btn-primary btn-sm" href="download.html">Get ' + PRODUCT + "</a>" +
      "</div>" +
      "</nav>" +
      '<button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
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
      '<a class="brand" href="index.html">' + LOGO_SVG + "<span>" + BRAND + "</span></a>" +
      "<p>Engineering software for plants, machines and harnesses.</p>" +
      "</div>" +
      "<div><h4>Product</h4><ul>" +
      '<li><a href="index.html">Overview</a></li>' +
      '<li><a href="solutions.html">Solutions</a></li>' +
      '<li><a href="pricing.html">Pricing</a></li>' +
      '<li><a href="download.html">Download</a></li>' +
      '<li><a href="user-guides.html">User guides</a></li>' +
      "</ul></div>" +
      "<div><h4>Company</h4><ul>" +
      '<li><a href="about.html">About us</a></li>' +
      '<li><a href="shape-e1.html">Shape E1 with us</a></li>' +
      '<li><a href="about.html#contact">Contact</a></li>' +
      '<li><a href="account.html">Your account</a></li>' +
      '<li><a href="#">Privacy</a></li>' +
      "</ul></div>" +
      "</div>" +
      '<div class="footer-bottom"><span>&copy; ' + year + " " + BRAND + ". All rights reserved.</span><span>" + PRODUCT + "</span></div>" +
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
      var label = clip.getAttribute("data-label") || "Clip placeholder";
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
        ? "Create a free account to start your E1 cloud workspace."
        : "Sign in to see your licenses, usage, projects and downloads.";
      submit.textContent = signup ? "Continue to sign up" : "Continue to sign in";
      var url = api && api.isDemo() ? "" : api && api.loginUrl(mode, returnTo && new URL(returnTo, location.href).href);
      submit.setAttribute("href", url || "account.html?demo=1");
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () { setMode(t.dataset.mode); });
    });

    if (location.hash === "#signup") setMode("signup");
    else setMode("login");

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
          ? visible + " features"
          : "Showing " + visible + " of " + items.length;
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
    initReveal();
    initClips();
    initAuthTabs();
    initCatalog();
    initLaunch();
  });
})();

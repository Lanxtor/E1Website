/*
 * Alex, the website assistant: the chat panel, the "Ask Alex" button on every
 * page, any ask box on a page ([data-ask], none at the moment) and the suggested questions.
 *
 * Answers come from the E1 server: POST <apiBase>/api/site/assistant
 * (Lanxtor/E1, server/site/assistant.mjs), which asks the installation's own
 * model (on Azure the GPT-4.1 deployment). The server reads what Alex knows
 * from assets/data/assistant-knowledge.txt (tools/chat/build_knowledge.py).
 * Most visitors click rather than type, so after every answer Alex offers
 * 3 to 5 suggested questions that follow the direction of the conversation
 * (QUESTIONS below: each question names its own follow-ups; a typed question
 * is matched to a topic by its words).
 * The conversation is kept for this browser tab only (sessionStorage), so it
 * follows the visitor from page to page; "New conversation" (the panel's
 * header and the ask box) clears it.
 */
(function () {
  "use strict";

  var T = function (s) { return window.E1_T ? window.E1_T(s) : s; };
  var H = function (h) { return window.E1_href ? window.E1_href(h) : h; };
  var LANG = window.E1_LANG || "en";
  var KEY = "e1.chat";
  var CONFIG = window.E1_CONFIG || {};
  var BASE = CONFIG.apiBase ? String(CONFIG.apiBase).replace(/\/+$/, "") : "";
  var API = BASE + "/api/site/assistant";

  var ICON = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>'
  };

  /*
   * The suggested questions. id: [question, topic, follow-ups]. After an
   * answer Alex offers the unasked follow-ups of the last question, topped up
   * from the same topic and its related topics (RELATED), and, from the
   * second question on, one next step ("How do I get started?" and the like).
   * Every question is a js string of tools/i18n (translated with E1_T).
   */
  var QUESTIONS = {
    what: ["What is E1?", "product", ["disciplines", "alexApp", "industries", "cost", "cloud"]],
    disciplines: ["Which disciplines does E1 cover?", "product", ["pid", "deliverables", "brownfield", "companies"]],
    pid: ["How does E1 handle P&IDs and instruments?", "product", ["deliverables", "alexChanges", "disciplines", "courses"]],
    deliverables: ["Can E1 generate datasheets and reports?", "product", ["pid", "brownfield", "review", "licenses"]],
    brownfield: ["Does E1 support brownfield modifications?", "product", ["branches", "deliverables", "industries", "trial"]],
    industries: ["Which industries is E1 made for?", "product", ["disciplines", "brownfield", "servers", "trial"]],
    platforms: ["Does E1 run on Mac and in the browser?", "deploy", ["download", "cloud", "servers", "trial"]],

    cost: ["What does E1 cost?", "pricing", ["licenses", "credits", "trial", "students", "enterprise"]],
    licenses: ["What is the difference between Viewer, Reviewer and Editor?", "pricing", ["credits", "alexLicense", "review", "cost"]],
    credits: ["How many AI credits are included?", "pricing", ["alexApp", "licenses", "enterprise", "trial"]],
    currency: ["Can I see the prices in my currency?", "pricing", ["cost", "licenses", "enterprise", "trial"]],
    enterprise: ["What does an Enterprise license include?", "pricing", ["servers", "sso", "credits", "sales"]],
    academyPrice: ["Is the E1 Academy included in the price?", "pricing", ["courses", "certificate", "licenses", "cost"]],

    servers: ["Can E1 run on our own servers?", "deploy", ["providers", "database", "sso", "enterprise", "cloud"]],
    cloud: ["What is E1 Cloud?", "deploy", ["hosting", "platforms", "servers", "cost"]],
    hosting: ["Where is my data hosted?", "deploy", ["providers", "servers", "alexSafe", "cloud"]],
    providers: ["Which cloud providers can we use?", "deploy", ["hosting", "database", "servers", "sso"]],
    database: ["Can we use our own PostgreSQL database?", "deploy", ["servers", "sso", "providers", "enterprise"]],
    sso: ["Does E1 support single sign-on?", "deploy", ["enterprise", "database", "servers", "sales"]],

    alexApp: ["What can Alex do in E1?", "alex", ["alexChanges", "alexSafe", "predictive", "alexLicense", "credits"]],
    alexChanges: ["Can Alex make changes to my design?", "alex", ["branches", "review", "alexLicense", "alexSafe"]],
    alexSafe: ["Is my data safe when I use Alex?", "alex", ["hosting", "servers", "alexApp", "predictive"]],
    alexLicense: ["Which licenses include Alex?", "alex", ["credits", "licenses", "alexChanges", "trial"]],
    predictive: ["What is predictive engineering?", "alex", ["alexApp", "simulate", "alexSafe", "trial"]],
    simulate: ["Can Alex check and validate my design?", "alex", ["predictive", "alexChanges", "pid", "trial"]],

    branches: ["How do branches work in E1?", "collab", ["review", "companies", "alexChanges", "brownfield"]],
    review: ["How do review and approval work?", "collab", ["branches", "licenses", "companies", "deliverables"]],
    companies: ["Can several companies work on one project?", "collab", ["branches", "review", "sso", "enterprise"]],

    trial: ["How does the 30-day trial work?", "trial", ["trialTeam", "trialAfter", "trialRequest", "cost"]],
    trialTeam: ["Who can join my trial?", "trial", ["trialAfter", "trialRequest", "licenses", "alexApp"]],
    trialAfter: ["What happens after the 30 days?", "trial", ["cost", "trialRequest", "licenses", "sales"]],
    trialRequest: ["How do I request a trial?", "trial", ["trialTeam", "download", "courses", "sales"]],
    download: ["How do I download E1?", "trial", ["platforms", "cloud", "trial", "courses"]],

    academy: ["What is the E1 Academy?", "academy", ["courses", "academyPrice", "certificate", "students"]],
    courses: ["Which courses are there?", "academy", ["certificate", "academyPrice", "academy", "trial"]],
    certificate: ["Do I get a certificate?", "academy", ["courses", "academyPrice", "academy", "students"]],
    students: ["What does E1 cost for students and universities?", "academy", ["university", "academy", "cost", "courses"]],
    university: ["How can a university use E1 in a course?", "academy", ["students", "courses", "sales", "academy"]],

    start: ["How do I get started?", "next", ["download", "trial", "courses", "sales"]],
    sales: ["How can I talk to sales?", "next", ["enterprise", "trial", "support", "start"]],
    support: ["How do I get support?", "next", ["sales", "courses", "download", "start"]]
  };
  var START = ["what", "cost", "servers", "alexApp", "trial"];
  var NEXT_STEPS = ["start", "trial", "sales"];
  var RELATED = {
    product: ["alex", "collab", "pricing"],
    pricing: ["trial", "deploy", "next"],
    deploy: ["pricing", "alex", "next"],
    alex: ["product", "pricing", "deploy"],
    collab: ["product", "alex", "pricing"],
    trial: ["pricing", "academy", "next"],
    academy: ["pricing", "trial", "next"],
    next: ["pricing", "trial", "deploy"]
  };
  /* Words that place a typed question in a topic (English, German, French, Spanish, Norwegian). */
  var WORDS = {
    pricing: /pric|cost|licen|pay|euro|dollar|budget|cheap|expens|preis|kost|lizenz|prix|coût|tarif|precio|cuest|pris|lisens|betal/i,
    trial: /trial|try|test|demo|download|install|essai|prueba|prøv|herunterlad|télécharg|descarg|last ned/i,
    deploy: /server|premis|cloud|host|azure|aws|google|postgres|database|sso|sign-on|region|datenbank|serveur|servidor|nube|sky|data ?center|rechenzentrum|mac\b|windows|browser|navigateur|navegador|nettleser/i,
    alex: /alex|\bai\b|\bki\b|\bia\b|\bki-|artificial|intelligen|gpt|agent|predict|simul|validat|automatisk/i,
    collab: /branch|collab|review|approv|team|compan|partner|share|zweig|freigab|zusammen|branche|collabor|rama|colabor|gren|samarbeid|godkjenn/i,
    academy: /academy|course|training|learn|certif|lesson|student|universit|teach|school|kurs|schulung|lern|formation|cours|étudiant|curso|formación|estudiant|opplæring|studen/i,
    product: /p&?id|instrument|electr|elektr|automat|process|prozess|procédé|proceso|feed|datasheet|datenblatt|report|bericht|brownfield|maint|wartung|discipline|disziplin|industr|what is e1|was ist e1|qu'est-ce|qué es e1|hva er e1/i,
    next: /sales|contact|support|help|email|phone|kontakt|vertrieb|vente|ventas|contacto|salg|hjelp|rfi|tender|ausschreib|appel d'offres|licitación|anbud/i
  };

  var state = load();
  var panel, list, input, busy = false;

  function load() {
    try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s && Array.isArray(s.messages)) return s; } catch (e) {}
    return { messages: [], asked: [] };
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  /* A small, safe Markdown subset: paragraphs, - lists, **bold**, [links](url). */
  function render(md) {
    var blocks = esc(md).split(/\n{2,}/);
    return blocks.map(function (b) {
      var lines = b.split("\n");
      var inline = function (t) {
        return t
          .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
          .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
            var u = url.replace(/&amp;/g, "&");
            if (/^(https?:|mailto:)/i.test(u)) return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + label + "</a>";
            if (/^[a-z0-9-]+\.html(#[\w-]+)?$/i.test(u)) return '<a href="' + esc(H(u)) + '">' + label + "</a>";
            return label;
          });
      };
      if (lines.every(function (l) { return /^\s*[-*•] /.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*[-*•] /, "")) + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.map(inline).join("<br>") + "</p>";
    }).join("");
  }

  function build() {
    var launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "alex-launcher";
    launcher.innerHTML = '<span class="alex-launcher-face"><img src="assets/img/hero-avatar.png?v=2" alt=""></span><span>' + T("Ask Alex") + "</span>";
    launcher.addEventListener("click", function () { open(); });
    document.body.appendChild(launcher);

    panel = document.createElement("section");
    panel.className = "alex-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", T("Ask Alex"));
    panel.hidden = true;
    panel.innerHTML =
      '<header class="alex-head">' +
      '<span class="alex-face"><img src="assets/img/hero-avatar.png?v=2" alt=""></span>' +
      '<div><b>Alex</b><span>' + T("Ask anything about E1. Answers are written by AI.") + "</span></div>" +
      '<button type="button" class="alex-icon" data-reset aria-label="' + T("New conversation") + '" title="' + T("New conversation") + '">' + ICON.reset + "</button>" +
      '<button type="button" class="alex-icon" data-close aria-label="' + T("Close") + '">' + ICON.close + "</button>" +
      "</header>" +
      '<div class="alex-list" aria-live="polite"></div>' +
      '<form class="alex-form">' +
      '<textarea rows="1" maxlength="2000" enterkeyhint="send" placeholder="' + T("Ask Alex anything about E1…") + '" aria-label="' + T("Your question") + '"></textarea>' +
      '<button type="submit" class="alex-send" aria-label="' + T("Send") + '">' + ICON.send + "</button>" +
      "</form>";
    document.body.appendChild(panel);

    list = panel.querySelector(".alex-list");
    input = panel.querySelector("textarea");

    panel.querySelector("[data-close]").addEventListener("click", close);
    panel.querySelector("[data-reset]").addEventListener("click", reset);
    panel.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener("input", grow);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    watchViewport();
    draw();
  }

  /* ---------- suggested questions ---------- */
  function norm(s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, " ").trim(); }

  /* The id of a suggested question typed or clicked word for word, if any. */
  function questionId(text) {
    var n = norm(text);
    for (var id in QUESTIONS) {
      if (norm(T(QUESTIONS[id][0])) === n || norm(QUESTIONS[id][0]) === n) return id;
    }
    return null;
  }

  /* The topic a typed question is about: the one whose words it uses most. */
  function topicOf(text) {
    var best = null, score = 0;
    for (var t in WORDS) {
      var m = String(text).match(new RegExp(WORDS[t].source, "gi"));
      if (m && m.length > score) { best = t; score = m.length; }
    }
    return best;
  }

  /* 3 to 5 questions that follow the way the visitor is going. */
  function suggestions() {
    var asked = state.asked || [];
    var users = state.messages.filter(function (m) { return m.role === "user"; }).length;
    if (!users) return START.slice();
    var out = [];
    var add = function (id) {
      if (out.length < 4 && QUESTIONS[id] && asked.indexOf(id) < 0 && out.indexOf(id) < 0) out.push(id);
    };
    var inTopic = function (t) { for (var id in QUESTIONS) if (QUESTIONS[id][1] === t) add(id); };
    var last = state.last && QUESTIONS[state.last];
    var topic = last ? last[1] : (state.topic || "product");
    if (last) last[2].forEach(add);
    inTopic(topic);
    (RELATED[topic] || []).forEach(inTopic);
    for (var id in QUESTIONS) add(id);
    if (users >= 2) {
      var step = NEXT_STEPS.filter(function (s) { return asked.indexOf(s) < 0 && out.indexOf(s) < 0; })[0];
      if (step) out.push(step);
    }
    if (out.length < 3) START.forEach(function (s) { if (out.length < 3 && out.indexOf(s) < 0) out.push(s); });
    return out.slice(0, 5);
  }

  function chips(ids) {
    return '<div class="alex-suggest" role="group" aria-label="' + esc(T("Suggested questions")) + '">' + ids.map(function (id) {
      var q = T(QUESTIONS[id][0]);
      return '<button type="button" data-q="' + esc(q) + '" data-id="' + id + '">' + esc(q) + "</button>";
    }).join("") + "</div>";
  }

  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  function draw() {
    var html = "";
    if (!state.messages.length) {
      html += '<div class="alex-msg alex-bot">' + render(T("Hi, I'm Alex. Ask me anything about E1: features, licenses and prices, the cloud or your own servers, the Academy.")) + "</div>";
    }
    state.messages.forEach(function (m) {
      html += '<div class="alex-msg ' + (m.role === "user" ? "alex-me" : "alex-bot") + '">' + (m.role === "user" ? "<p>" + esc(m.content) + "</p>" : render(m.content)) + "</div>";
    });
    if (busy) html += '<div class="alex-msg alex-bot alex-typing" aria-label="' + T("Alex is writing") + '"><i></i><i></i><i></i></div>';
    else html += chips(suggestions());
    list.innerHTML = html;
    list.querySelectorAll("[data-q]").forEach(function (b) {
      b.addEventListener("click", function () { ask(b.getAttribute("data-q"), b.getAttribute("data-id")); });
    });
    list.scrollTop = list.scrollHeight;
    document.querySelectorAll("[data-ask-reset]").forEach(function (b) { b.hidden = !state.messages.length; });
  }

  /* ---------- start over ---------- */
  function reset() {
    if (busy) return;
    state.messages = [];
    state.asked = [];
    state.last = null;
    state.topic = null;
    save();
    if (!panel) build();
    draw();
    if (input) { input.value = ""; grow(); }
  }

  /* ---------- phones: keep the panel above the on-screen keyboard ---------- */
  var PHONE = window.matchMedia ? window.matchMedia("(max-width: 560px)") : { matches: false };
  var TOUCH = window.matchMedia ? window.matchMedia("(hover: none) and (pointer: coarse)") : { matches: false };

  /* On a phone the panel fills the visible part of the screen: when the
     keyboard opens, the browser shrinks the visual viewport but not the
     layout, so the panel follows window.visualViewport and the typing area
     stays right above the keyboard. */
  function fit() {
    if (!panel || panel.hidden) return;
    var vv = window.visualViewport;
    if (!PHONE.matches || !vv) {
      panel.style.top = "";
      panel.style.height = "";
      return;
    }
    panel.style.top = Math.max(0, vv.offsetTop) + "px";
    panel.style.height = vv.height + "px";
    if (document.activeElement === input) list.scrollTop = list.scrollHeight;
  }

  function watchViewport() {
    var vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", fit);
      vv.addEventListener("scroll", fit);
    }
    window.addEventListener("orientationchange", function () { setTimeout(fit, 250); });
    input.addEventListener("focus", function () { setTimeout(fit, 60); setTimeout(fit, 350); });
    input.addEventListener("blur", function () { setTimeout(fit, 60); });
  }

  function open(question) {
    if (!panel) build();
    panel.hidden = false;
    document.body.classList.add("alex-open");
    fit();
    if (question) ask(question);
    // On a touch screen the keyboard would cover the suggestions: the visitor
    // taps the typing area when they want to type.
    else if (!TOUCH.matches) setTimeout(function () { input.focus(); }, 50);
  }

  function close() {
    if (document.activeElement === input) input.blur();
    panel.hidden = true;
    panel.style.top = "";
    panel.style.height = "";
    document.body.classList.remove("alex-open");
  }

  /* id: the suggested question that was clicked, if one was. */
  function ask(text, id) {
    text = String(text || "").trim();
    if (!text || busy) return;
    if (!panel) build();
    input.value = "";
    grow();
    // On a phone, put the keyboard away so the answer and the suggestions have the screen.
    if (TOUCH.matches && document.activeElement === input) input.blur();
    id = (id && QUESTIONS[id]) ? id : questionId(text);
    if (!Array.isArray(state.asked)) state.asked = [];
    if (id) {
      if (state.asked.indexOf(id) < 0) state.asked.push(id);
      state.last = id;
      state.topic = QUESTIONS[id][1];
    } else {
      state.last = null;
      state.topic = topicOf(text) || state.topic || "product";
    }
    state.messages.push({ role: "user", content: text.slice(0, 2000) });
    busy = true;
    save();
    draw();
    fetch(API, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages.slice(-16).map(function (m) { return { role: m.role, content: m.content }; }),
        lang: LANG,
        page: location.pathname.split("/").pop() || "index.html"
      })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
      })
      .then(function (res) {
        var reply;
        if (res.ok && res.body.reply) reply = res.body.reply;
        else if (res.status === 503 || res.status === 404 || !CONFIG.apiBase) reply = T("I'm not connected yet. Until then, the team is happy to help: [contact sales](contact-sales.html) or write to sales@lanxtor.com.");
        else if (res.status === 429) reply = T("That was a lot of questions in a short time. Please wait a few minutes and ask again.");
        else reply = T("Sorry, I couldn't answer just now. Please try again in a moment.");
        state.messages.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        // The E1 server could not be reached (or does not offer the route yet).
        state.messages.push({ role: "assistant", content: T("I'm not connected yet. Until then, the team is happy to help: [contact sales](contact-sales.html) or write to sales@lanxtor.com.") });
      })
      .then(function () {
        busy = false;
        // Keep the stored conversation short.
        if (state.messages.length > 40) state.messages = state.messages.slice(-40);
        save();
        draw();
      });
  }

  /* ---------- the ask box on the home page ---------- */
  function initAskBox() {
    document.querySelectorAll("[data-ask]").forEach(function (form) {
      var field = form.querySelector("input");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = field.value.trim();
        field.value = "";
        open(q || null);
      });
      // On a phone, typing happens in the full-screen panel: there the typing
      // area stays above the keyboard, while the page scrolls under it.
      field.addEventListener("focus", function () {
        if (!PHONE.matches || !TOUCH.matches) return;
        var q = field.value;
        field.blur();
        open();
        if (q) input.value = q;
        field.value = "";
        input.focus();
        grow();
      });
      var again = form.querySelector("[data-ask-reset]");
      if (again) again.addEventListener("click", function () { reset(); field.focus(); });
    });
  }

  function init() {
    build();
    initAskBox();
    if (state.open) open();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

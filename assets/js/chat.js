/*
 * Alex, the website assistant: the chat panel, the "Ask Alex" button on every
 * page, the ask box on the home page ([data-ask]) and voice ("Talk to me").
 *
 * Answers come from the E1 server: POST <apiBase>/api/site/assistant
 * (Lanxtor/E1, server/site/assistant.mjs), which asks the installation's own
 * model (on Azure the GPT-4.1 deployment). The server reads what Alex knows
 * from assets/data/assistant-knowledge.txt (tools/chat/build_knowledge.py). Voice uses the
 * browser's own speech recognition and speech synthesis (Chrome, Edge, Safari);
 * where the browser has none, the microphone buttons are hidden.
 * The conversation is kept for this browser tab only (sessionStorage).
 */
(function () {
  "use strict";

  var T = function (s) { return window.E1_T ? window.E1_T(s) : s; };
  var H = function (h) { return window.E1_href ? window.E1_href(h) : h; };
  var LANG = window.E1_LANG || "en";
  var SPEECH_LANG = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", no: "nb-NO" }[LANG] || "en-US";
  var KEY = "e1.chat";
  var CONFIG = window.E1_CONFIG || {};
  var API = (CONFIG.apiBase ? String(CONFIG.apiBase).replace(/\/+$/, "") : "") + "/api/site/assistant";
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canSpeak = "speechSynthesis" in window;

  var ICON = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>'
  };

  var state = load();
  var panel, list, input, micBtn, soundBtn, busy = false, recognizer = null, listening = false;

  function load() {
    try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s && Array.isArray(s.messages)) return s; } catch (e) {}
    return { messages: [], sound: true };
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

  function plain(md) {
    return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#`>]/g, "").replace(/^\s*[-•] /gm, "");
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
      (canSpeak ? '<button type="button" class="alex-icon" data-sound aria-label="' + T("Read answers aloud") + '"></button>' : "") +
      '<button type="button" class="alex-icon" data-close aria-label="' + T("Close") + '">' + ICON.close + "</button>" +
      "</header>" +
      '<div class="alex-list" aria-live="polite"></div>' +
      '<form class="alex-form">' +
      '<textarea rows="1" maxlength="2000" placeholder="' + T("Ask Alex anything about E1…") + '" aria-label="' + T("Your question") + '"></textarea>' +
      (Recognition ? '<button type="button" class="alex-icon alex-mic" data-mic aria-label="' + T("Talk to me") + '">' + ICON.mic + "</button>" : "") +
      '<button type="submit" class="alex-send" aria-label="' + T("Send") + '">' + ICON.send + "</button>" +
      "</form>";
    document.body.appendChild(panel);

    list = panel.querySelector(".alex-list");
    input = panel.querySelector("textarea");
    micBtn = panel.querySelector("[data-mic]");
    soundBtn = panel.querySelector("[data-sound]");

    panel.querySelector("[data-close]").addEventListener("click", close);
    panel.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value, false); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value, false); }
    });
    input.addEventListener("input", grow);
    if (micBtn) micBtn.addEventListener("click", function () { listening ? stopListening() : listen(); });
    if (soundBtn) soundBtn.addEventListener("click", function () {
      state.sound = !state.sound; save(); drawSound();
      if (!state.sound && canSpeak) speechSynthesis.cancel();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    drawSound();
    draw();
  }

  function drawSound() {
    if (!soundBtn) return;
    soundBtn.innerHTML = state.sound ? ICON.sound : ICON.mute;
    soundBtn.setAttribute("aria-pressed", String(state.sound));
  }

  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  function draw() {
    var html = "";
    if (!state.messages.length) {
      html += '<div class="alex-msg alex-bot">' + render(T("Hi, I'm Alex. Ask me anything about E1: features, licenses and prices, the cloud or your own servers, the Academy. You can also talk to me.")) + "</div>";
      html += '<div class="alex-suggest">' + [
        "What does E1 cost?",
        "Can E1 run on our own servers?",
        "What can Alex do in E1?",
        "How does the 30-day trial work?"
      ].map(function (q) { return '<button type="button" data-q="' + esc(T(q)) + '">' + esc(T(q)) + "</button>"; }).join("") + "</div>";
    }
    state.messages.forEach(function (m) {
      html += '<div class="alex-msg ' + (m.role === "user" ? "alex-me" : "alex-bot") + '">' + (m.role === "user" ? "<p>" + esc(m.content) + "</p>" : render(m.content)) + "</div>";
    });
    if (busy) html += '<div class="alex-msg alex-bot alex-typing" aria-label="' + T("Alex is writing") + '"><i></i><i></i><i></i></div>';
    list.innerHTML = html;
    list.querySelectorAll("[data-q]").forEach(function (b) {
      b.addEventListener("click", function () { ask(b.getAttribute("data-q"), false); });
    });
    list.scrollTop = list.scrollHeight;
  }

  function open(question, voice) {
    if (!panel) build();
    panel.hidden = false;
    document.body.classList.add("alex-open");
    if (question) ask(question, voice);
    else setTimeout(function () { input.focus(); }, 50);
  }

  function close() {
    panel.hidden = true;
    document.body.classList.remove("alex-open");
    stopListening();
    if (canSpeak) speechSynthesis.cancel();
  }

  function say(text) {
    if (!canSpeak || !state.sound) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(plain(text));
    u.lang = SPEECH_LANG;
    var voice = speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.replace("_", "-").indexOf(SPEECH_LANG.slice(0, 2)) === 0; })[0];
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  function ask(text, voice) {
    text = String(text || "").trim();
    if (!text || busy) return;
    if (!panel) build();
    input.value = "";
    grow();
    state.messages.push({ role: "user", content: text.slice(0, 2000) });
    busy = true;
    save();
    draw();
    fetch(API, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages.slice(-16),
        lang: LANG,
        voice: !!voice,
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
        if (voice) say(reply);
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

  /* ---------- voice ---------- */
  function setListening(on, button) {
    listening = on;
    document.querySelectorAll("[data-mic], [data-ask-mic]").forEach(function (b) { b.classList.toggle("is-listening", on); });
    if (input) input.placeholder = on ? T("Listening… speak now") : T("Ask Alex anything about E1…");
  }

  function listen() {
    if (!Recognition) return;
    if (!panel) build();
    if (panel.hidden) open();
    if (canSpeak) speechSynthesis.cancel();
    recognizer = new Recognition();
    recognizer.lang = SPEECH_LANG;
    recognizer.interimResults = true;
    recognizer.continuous = false;
    var finalText = "";
    recognizer.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
      grow();
    };
    recognizer.onerror = function (e) {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        state.messages.push({ role: "assistant", content: T("I can't hear you: the microphone is blocked. Allow it in your browser's address bar, or type your question.") });
        save(); draw();
      }
    };
    recognizer.onend = function () {
      setListening(false);
      var text = (finalText || input.value).trim();
      if (text) ask(text, true);
    };
    try { recognizer.start(); setListening(true); } catch (e) { setListening(false); }
  }

  function stopListening() {
    if (recognizer && listening) { try { recognizer.stop(); } catch (e) {} }
    setListening(false);
  }

  /* ---------- the ask box on the home page ---------- */
  function initAskBox() {
    document.querySelectorAll("[data-ask]").forEach(function (form) {
      var field = form.querySelector("input");
      var mic = form.querySelector("[data-ask-mic]");
      if (mic && !Recognition) mic.hidden = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = field.value.trim();
        field.value = "";
        open(q || null, false);
      });
      if (mic) mic.addEventListener("click", function () { listen(); });
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

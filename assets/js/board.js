(function () {
  "use strict";

  /*
   * Feature board for shape-e1.html.
   *
   * Connected (E1_CONFIG.apiBase set): requests, votes and comments live in
   * the E1 cloud (GET/POST /api/community/*, docs/AZURE-INTEGRATION.md);
   * anyone reads, signing in is needed to post, vote or comment.
   *
   * Not connected: SEED holds example requests, and a visitor's votes,
   * comments and new requests are kept in their browser only.
   */
  var STORE_KEY = "e1-board-v1";

  var STATUS = {
    open: "Open",
    planned: "Planned",
    progress: "In progress",
    shipped: "Shipped",
    declined: "Declined"
  };

  var SEED = [
    {
      id: "pid-import",
      title: "Import existing P&IDs from PDF and DWG",
      body: "Most brownfield plants only have P&IDs as PDF or AutoCAD files. Recognise symbols, lines and tags so we do not redraw everything by hand.",
      category: "Instrumentation",
      status: "planned",
      votes: 48,
      created: "2026-09-14",
      comments: [
        { who: "I&C lead, chemicals", when: "2026-09-20", text: "Tag recognition alone would already save weeks per unit." },
        { who: "LANXTOR team", when: "2026-10-02", text: "Planned. DWG first, PDF symbol recognition after." }
      ]
    },
    {
      id: "cable-sizing",
      title: "Cable sizing and voltage drop calculations",
      body: "Size cables from consumer data and routing length, with voltage drop and short-circuit checks per IEC 60364.",
      category: "Electrical",
      status: "progress",
      votes: 36,
      created: "2026-09-02",
      comments: []
    },
    {
      id: "sap-pm",
      title: "Link to SAP PM for maintenance orders",
      body: "Open the equipment in E1 from a maintenance order, and see open orders on the equipment in E1.",
      category: "Platform",
      status: "open",
      votes: 31,
      created: "2026-10-05",
      comments: [
        { who: "Maintenance planner, energy", when: "2026-10-11", text: "Read-only would be enough to start." }
      ]
    },
    {
      id: "loop-diagrams",
      title: "Loop diagrams generated from the instrument index",
      body: "Generate loop diagrams automatically from instruments, junction boxes and I/O, with our own title block.",
      category: "Deliverables",
      status: "planned",
      votes: 27,
      created: "2026-08-28",
      comments: []
    },
    {
      id: "offline",
      title: "Offline mode on site",
      body: "Work without a connection during commissioning and sync changes when back online.",
      category: "Platform",
      status: "open",
      votes: 24,
      created: "2026-10-18",
      comments: []
    },
    {
      id: "hazop",
      title: "HAZOP worksheet linked to P&ID nodes",
      body: "Define nodes on the P&ID and keep the HAZOP worksheet in sync with the design as it changes.",
      category: "Process",
      status: "open",
      votes: 19,
      created: "2026-10-21",
      comments: []
    },
    {
      id: "io-export",
      title: "Export I/O list to TIA Portal and PCS 7",
      body: "Export the I/O list in a format the automation tools import directly, without manual spreadsheet work.",
      category: "Automation",
      status: "open",
      votes: 17,
      created: "2026-10-26",
      comments: []
    },
    {
      id: "tag-ai",
      title: "Ask the AI where a tag is used",
      body: "Type a tag and get every drawing, datasheet and list it appears in.",
      category: "AI",
      status: "progress",
      votes: 11,
      created: "2026-10-29",
      comments: []
    },
    {
      id: "ipad-markup",
      title: "Markups on the iPad viewer",
      body: "Review drawings on site and leave markups that show up for the engineer in E1.",
      category: "Collaboration",
      status: "shipped",
      votes: 14,
      created: "2026-08-10",
      comments: []
    }
  ];

  var UP_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }

  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function timeAgo(date) {
    var seconds = (Date.now() - new Date(date).getTime()) / 1000;
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(seconds / units[i][1]);
      if (n >= 1) return n + " " + units[i][0] + (n > 1 ? "s" : "") + " ago";
    }
    return "just now";
  }

  function init() {
    var root = document.querySelector("[data-board]");
    if (!root) return;

    var state = load();
    state.voted = state.voted || [];
    state.added = state.added || [];
    state.comments = state.comments || {};

    var search = root.querySelector("[data-board-search]");
    var list = root.querySelector("[data-board-list]");
    var suggest = root.querySelector("[data-board-suggest]");
    var suggestLead = root.querySelector("[data-board-suggest-lead]");
    var suggestText = root.querySelector("[data-board-suggest-text]");
    var composer = root.querySelector("[data-board-composer]");
    var notice = root.querySelector("[data-board-notice]");
    var statusBtns = root.querySelectorAll("[data-board-status]");
    var sortBtns = root.querySelectorAll("[data-board-sort]");

    var status = "all";
    var sort = "top";
    var openId = null;

    var api = window.E1;
    var remote = Boolean(api && api.configured());
    var remoteItems = [];
    var viewer = null;
    var loading = remote;

    if (remote) {
      // The account's email is used for updates; the optional field is not needed.
      var emailField = composer.elements.email && composer.elements.email.closest(".field");
      if (emailField) emailField.hidden = true;
    }

    function requests() { return remote ? remoteItems : state.added.concat(SEED); }
    function byId(id) { return requests().filter(function (r) { return r.id === id; })[0]; }
    function hasVoted(r) { return remote ? Boolean(r.voted) : state.voted.indexOf(r.id) !== -1; }
    function voteCount(r) { return remote ? r.votes : r.votes + (hasVoted(r) ? 1 : 0); }
    function commentsOf(r) {
      if (remote) {
        return (r.comments || []).map(function (c) { return { who: c.mine ? "You" : c.authorName, when: c.created, text: c.body }; });
      }
      return (r.comments || []).concat(state.comments[r.id] || []);
    }

    function say(html) {
      notice.innerHTML = html;
      notice.hidden = false;
    }

    function loginLink() {
      return '<a href="login.html?return=' + encodeURIComponent("shape-e1.html") + '">Log in</a>';
    }

    /** Connected only: signing in is needed to write. Returns true when signed in. */
    function needSignIn(what) {
      if (!remote || viewer) return true;
      say(loginLink() + " to " + what + ". It is free, and the same account works in E1.");
      return false;
    }

    function failed(err) {
      say(escapeHtml((err && err.message) || "Something went wrong. Try again."));
    }

    function reload() {
      return api.community.list().then(function (data) {
        remoteItems = data.requests || [];
        viewer = data.viewer || null;
        loading = false;
        render();
      }, function (err) {
        loading = false;
        render();
        failed(err);
      });
    }

    function matches(r, query) {
      if (!query) return true;
      var hay = normalize(r.title + " " + r.body + " " + r.category);
      return query.split(" ").every(function (word) { return hay.indexOf(word) !== -1; });
    }

    function itemHtml(r) {
      var open = r.id === openId;
      var comments = commentsOf(r);
      var count = comments.length;
      var thread = "";

      if (open) {
        thread =
          '<div class="board-thread">' +
          (count ? '<ul class="board-comments">' + comments.map(function (c) {
            return "<li><span class=\"who\">" + escapeHtml(c.who) + '</span><span class="when">' + timeAgo(c.when) + "</span>" +
              "<p>" + escapeHtml(c.text) + "</p></li>";
          }).join("") + "</ul>" : "") +
          '<form class="board-reply" data-board-reply>' +
          '<input type="text" name="text" placeholder="Add a comment…" aria-label="Add a comment" maxlength="500" required>' +
          '<button type="submit" class="btn btn-primary btn-sm">Reply</button>' +
          "</form></div>";
      }

      return '<li class="board-item' + (open ? " is-open" : "") + '" data-id="' + escapeHtml(r.id) + '">' +
        '<button type="button" class="board-vote' + (hasVoted(r) ? " is-voted" : "") + '" data-board-vote aria-pressed="' + hasVoted(r) + '" aria-label="Upvote">' +
        UP_SVG + "<span>" + voteCount(r) + "</span></button>" +
        '<div class="board-body">' +
        '<button type="button" class="board-title" data-board-toggle aria-expanded="' + open + '">' + escapeHtml(r.title) + "</button>" +
        (r.body ? '<p class="board-snippet">' + escapeHtml(r.body) + "</p>" : "") +
        '<div class="board-meta">' +
        '<span class="board-status status-' + r.status + '">' + STATUS[r.status] + "</span>" +
        "<span>" + escapeHtml(r.category) + "</span>" +
        "<span>" + count + (count === 1 ? " comment" : " comments") + "</span>" +
        "<span>" + timeAgo(r.created) + "</span>" +
        "</div>" + thread + "</div></li>";
    }

    function render() {
      var query = normalize(search.value);
      var items = requests().filter(function (r) {
        return (status === "all" || r.status === status) && matches(r, query);
      });

      items.sort(sort === "new"
        ? function (a, b) { return new Date(b.created) - new Date(a.created); }
        : function (a, b) { return voteCount(b) - voteCount(a); });

      var typed = search.value.trim();

      list.innerHTML = loading
        ? '<li class="board-empty">Loading requests…</li>'
        : items.length
          ? items.map(itemHtml).join("")
          : typed.length < 3 ? '<li class="board-empty">' + (remote && !requests().length ? "No requests yet. Be the first to ask." : "No requests match.") + "</li>" : "";

      suggest.hidden = typed.length < 3 || !composer.hidden;
      if (!suggest.hidden) {
        suggestLead.textContent = items.length ? "Not quite it? Suggest" : "Nobody has asked for this yet. Suggest";
        suggestText.textContent = "\u201C" + typed + "\u201D";
      }
    }

    function setGroup(buttons, attr, value) {
      buttons.forEach(function (b) {
        var on = b.getAttribute(attr) === value;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
    }

    function openComposer() {
      if (!needSignIn("post a request")) return;
      composer.hidden = false;
      composer.elements.title.value = search.value.trim();
      suggest.hidden = true;
      notice.hidden = true;
      (composer.elements.title.value ? composer.elements.body : composer.elements.title).focus();
    }

    function closeComposer() {
      composer.reset();
      composer.hidden = true;
      render();
    }

    search.addEventListener("input", render);

    root.querySelectorAll("[data-board-new]").forEach(function (btn) {
      btn.addEventListener("click", openComposer);
    });

    root.querySelector("[data-board-cancel]").addEventListener("click", closeComposer);

    composer.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = composer.elements.title.value.trim();
      if (!title) { composer.elements.title.focus(); return; }

      if (remote) {
        if (!needSignIn("post a request")) return;
        var submit = composer.querySelector('[type="submit"]');
        submit.disabled = true;
        api.community.post({ title: title, body: composer.elements.body.value.trim(), category: composer.elements.category.value }).then(function (answer) {
          submit.disabled = false;
          remoteItems.unshift(answer.request);
          search.value = "";
          status = "all";
          sort = "new";
          openId = answer.request.id;
          setGroup(statusBtns, "data-board-status", status);
          setGroup(sortBtns, "data-board-sort", sort);
          closeComposer();
          say("Posted. Others can now find and vote for your request.");
        }, function (err) {
          submit.disabled = false;
          failed(err);
        });
        return;
      }

      var request = {
        id: "u" + Date.now(),
        title: title,
        body: composer.elements.body.value.trim(),
        category: composer.elements.category.value,
        status: "open",
        votes: 0,
        created: new Date().toISOString(),
        comments: []
      };
      state.added.unshift(request);
      state.voted.push(request.id);
      save(state);

      search.value = "";
      status = "all";
      sort = "new";
      openId = request.id;
      setGroup(statusBtns, "data-board-status", status);
      setGroup(sortBtns, "data-board-sort", sort);
      closeComposer();

      notice.textContent = "Posted. Others can now find and vote for your request.";
      notice.hidden = false;
    });

    statusBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        status = b.getAttribute("data-board-status");
        setGroup(statusBtns, "data-board-status", status);
        render();
      });
    });

    sortBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        sort = b.getAttribute("data-board-sort");
        setGroup(sortBtns, "data-board-sort", sort);
        render();
      });
    });

    list.addEventListener("click", function (e) {
      var item = e.target.closest(".board-item");
      if (!item) return;
      var id = item.getAttribute("data-id");

      if (e.target.closest("[data-board-vote]") && remote) {
        if (!needSignIn("vote")) return;
        var r = byId(id);
        if (!r) return;
        api.community.vote(id, !r.voted).then(function (answer) {
          r.votes = answer.votes;
          r.voted = answer.voted;
          render();
        }, failed);
      } else if (e.target.closest("[data-board-vote]")) {
        var i = state.voted.indexOf(id);
        if (i === -1) state.voted.push(id); else state.voted.splice(i, 1);
        save(state);
        render();
      } else if (e.target.closest("[data-board-toggle]")) {
        openId = openId === id ? null : id;
        render();
        if (openId) {
          var input = list.querySelector('.board-item.is-open [name="text"]');
          if (input) input.focus({ preventScroll: true });
        }
      }
    });

    list.addEventListener("submit", function (e) {
      var form = e.target.closest("[data-board-reply]");
      if (!form) return;
      e.preventDefault();
      var text = form.elements.text.value.trim();
      if (!text) return;
      var id = form.closest(".board-item").getAttribute("data-id");
      if (remote) {
        if (!needSignIn("comment")) return;
        api.community.comment(id, text).then(function (answer) {
          var r = byId(id);
          if (r) (r.comments = r.comments || []).push(answer.comment);
          render();
        }, failed);
        return;
      }
      (state.comments[id] = state.comments[id] || []).push({ who: "You", when: new Date().toISOString(), text: text });
      save(state);
      render();
    });

    render();
    if (remote) reload();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

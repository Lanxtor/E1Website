/*
 * Prices in the visitor's currency.
 *
 * Every price on the site is written in US dollars, on an element with
 * data-usd="645". This script shows it in USD, EUR, GBP or NOK:
 *   - USD is the price as written.
 *   - EUR, GBP and NOK are converted with the day's European Central Bank
 *     rate (assets/data/rates.json, refreshed by the deploy workflow every
 *     working day) and rounded to a clean number (see nice() below).
 *
 * The currency is, in order: the one the visitor picked (remembered in this
 * browser), the one that fits the page language (de/fr/es: EUR, no: NOK), or
 * a guess from the time zone (Europe/London: GBP, Europe/Oslo: NOK, the rest
 * of Europe: EUR, elsewhere: USD).
 *
 * The prices themselves come from the E1 server's price list when it can be
 * reached (GET <apiBase>/api/site/prices, kept in the operator console): an
 * element with data-product="editor" takes that product's current price. The
 * price written in the page stays as the fallback.
 *
 * Mount points:
 *   [data-usd]               a price, its text is replaced
 *   [data-product]           with data-usd: the product id in E1's price list
 *   [data-usd-monthly]       with data-usd: the price billed monthly (data-usd is billed yearly)
 *   [data-billing-switch]    the Billed yearly / Billed monthly buttons are drawn here
 *   [data-billed]            "Per user / month, billed yearly" or "…, billed monthly"
 *   [data-year-total]        in a plan's heading: the yearly price a year, or "No yearly commitment"
 *   [data-currency-switch]   the USD / EUR / GBP / NOK buttons are drawn here
 *   [data-currency-note]     "Prices in …" text for the current currency
 *   tr[data-plan-feature]    a row of the plan table: which plan includes it comes from
 *                            GET <apiBase>/api/site/plan-features (the operator console's
 *                            Plans & features); its cells, in the order University,
 *                            Essentials, Standard, Enterprise, show a tick, a dash or the
 *                            row's words. The page as written stays as the fallback.
 */
(function () {
  "use strict";

  var CURRENCIES = ["USD", "EUR", "GBP", "NOK"];
  var KEY = "e1.currency";
  var RATES_URL = "assets/data/rates.json";
  var rates = null; // USD -> currency

  function t(s) { return window.E1_T ? window.E1_T(s) : s; }

  function lang() { return (document.documentElement.lang || "en").slice(0, 2); }

  function locale() {
    var l = lang();
    return { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", nb: "nb-NO", no: "nb-NO" }[l] || "en-US";
  }

  function stored() {
    try { var c = localStorage.getItem(KEY); return CURRENCIES.indexOf(c) >= 0 ? c : null; } catch (e) { return null; }
  }

  function guess() {
    var l = lang();
    if (l === "de" || l === "fr" || l === "es") return "EUR";
    if (l === "nb" || l === "no") return "NOK";
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (tz === "Europe/London") return "GBP";
    if (tz === "Europe/Oslo" || tz === "Arctic/Longyearbyen") return "NOK";
    if (tz.indexOf("Europe/") === 0) return "EUR";
    return "USD";
  }

  var current = stored() || guess();

  // Billed yearly (the list price) or billed monthly (about 20 % more), remembered in this browser.
  var BILLING_KEY = "e1.billing";
  var billing = "yearly";
  try { if (localStorage.getItem(BILLING_KEY) === "monthly") billing = "monthly"; } catch (e) {}

  function priceOf(el) {
    var monthly = parseFloat(el.getAttribute("data-usd-monthly"));
    if (billing === "monthly" && !isNaN(monthly)) return monthly;
    return parseFloat(el.getAttribute("data-usd"));
  }

  /*
   * A clean price: rounded to the nearest step that suits its size, so it
   * reads like a price list and not like a conversion.
   *   under 100      nearest 5      (17.6 -> 20, 14.6 -> 15)
   *   100 to 999     nearest 10     (226.9 -> 230, 597 -> 600)
   *   1,000 to 9,999 nearest 100    (2,590 -> 2,600, 6,966 -> 7,000)
   *   10,000 and up  nearest 500
   */
  function nice(x) {
    if (x <= 0) return 0;
    var step = x < 100 ? 5 : x < 1000 ? 10 : x < 10000 ? 100 : 500;
    return Math.max(step, Math.round(x / step) * step);
  }

  function amount(usd, cur) {
    if (cur === "USD" || !rates || !rates[cur]) return usd;
    return nice(usd * rates[cur]);
  }

  function format(value, cur) {
    try {
      return new Intl.NumberFormat(locale(), {
        style: "currency", currency: cur, currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return cur + " " + Math.round(value);
    }
  }

  var NAMES = {
    USD: "Prices in US dollars",
    EUR: "Prices in euros",
    GBP: "Prices in British pounds",
    NOK: "Prices in Norwegian kroner"
  };

  function render() {
    var cur = (current !== "USD" && !(rates && rates[current])) ? "USD" : current;
    document.querySelectorAll("[data-usd]").forEach(function (el) {
      var usd = priceOf(el);
      if (!isNaN(usd)) el.textContent = format(amount(usd, cur), cur);
    });
    document.querySelectorAll("[data-billed]").forEach(function (el) {
      el.textContent = t(billing === "monthly" ? "Per user / month, billed monthly" : "Per user / month, billed yearly");
    });
    document.querySelectorAll("[data-year-total]").forEach(function (el) {
      var head = el.closest("th, td, div");
      var price = head && head.querySelector("[data-usd]");
      var usd = price ? parseFloat(price.getAttribute("data-usd")) : NaN;
      if (billing === "monthly") el.textContent = t("No yearly commitment");
      else el.textContent = isNaN(usd) ? "" : format(amount(usd, cur) * 12, cur) + " " + t("per user a year");
    });
    document.querySelectorAll("[data-billing-switch] button").forEach(function (b) {
      var on = b.getAttribute("data-billing") === billing;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll("[data-currency-note]").forEach(function (el) {
      var text = t(NAMES[cur]);
      if (cur !== "USD" && rates && rates.date) {
        text += t(", converted from US dollars at the European Central Bank rate of ") +
          (window.E1 && E1.format ? E1.format.date(rates.date) : rates.date);
      }
      el.textContent = text;
    });
    document.querySelectorAll("[data-currency-switch] button").forEach(function (b) {
      var on = b.getAttribute("data-cur") === cur;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function drawSwitches() {
    document.querySelectorAll("[data-currency-switch]").forEach(function (mount) {
      mount.setAttribute("role", "group");
      mount.setAttribute("aria-label", t("Currency"));
      mount.innerHTML = CURRENCIES.map(function (c) {
        return '<button type="button" data-cur="' + c + '" aria-pressed="false">' + c + "</button>";
      }).join("");
      mount.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-cur]");
        if (!b) return;
        current = b.getAttribute("data-cur");
        try { localStorage.setItem(KEY, current); } catch (err) {}
        render();
      });
    });
  }

  function drawBillingSwitches() {
    document.querySelectorAll("[data-billing-switch]").forEach(function (mount) {
      mount.setAttribute("role", "group");
      mount.setAttribute("aria-label", t("Billing"));
      mount.innerHTML =
        '<button type="button" data-billing="yearly" aria-pressed="false">' + t("Billed yearly") + "</button>" +
        '<button type="button" data-billing="monthly" aria-pressed="false">' + t("Billed monthly") + "</button>";
      mount.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-billing]");
        if (!b) return;
        billing = b.getAttribute("data-billing");
        try { localStorage.setItem(BILLING_KEY, billing); } catch (err) {}
        render();
      });
    });
  }

  // The live price list from E1; the page's own prices stay if it cannot be read.
  function livePrices() {
    var config = window.E1_CONFIG || {};
    if (!config.apiBase || !document.querySelector("[data-product]") || !window.fetch) return;
    var base = String(config.apiBase).replace(/\/+$/, "");
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 5000) : null;
    fetch(base + "/api/site/prices", { credentials: "omit", signal: controller ? controller.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("prices"); return r.json(); })
      .then(function (data) {
        var byId = {};
        var monthlyById = {};
        (data && data.products || []).forEach(function (p) {
          if (p && p.id && typeof p.usd === "number" && p.usd >= 0) byId[p.id] = p.usd;
          if (p && p.id && typeof p.usdMonthly === "number" && p.usdMonthly >= 0) monthlyById[p.id] = p.usdMonthly;
        });
        var changed = false;
        document.querySelectorAll("[data-product][data-usd]").forEach(function (el) {
          var id = el.getAttribute("data-product");
          var usd = byId[id];
          if (usd !== undefined && String(usd) !== el.getAttribute("data-usd")) {
            el.setAttribute("data-usd", String(usd));
            changed = true;
          }
          var monthly = monthlyById[id];
          if (monthly !== undefined && el.hasAttribute("data-usd-monthly") && String(monthly) !== el.getAttribute("data-usd-monthly")) {
            el.setAttribute("data-usd-monthly", String(monthly));
            changed = true;
          }
        });
        if (changed) render();
      })
      .catch(function () {})
      .then(function () { if (timer) clearTimeout(timer); });
  }

  // Which plan includes which feature, as set in the operator console (Plans & features).
  function livePlanFeatures() {
    var config = window.E1_CONFIG || {};
    if (!config.apiBase || !document.querySelector("tr[data-plan-feature]")) return;
    var base = String(config.apiBase).replace(/\/+$/, "");
    fetch(base + "/api/site/plan-features", { credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error("plan-features"); return r.json(); })
      .then(function (data) {
        var columns = data && data.columns || [];
        (data && data.rows || []).forEach(function (row) {
          var tr = document.querySelector('tr[data-plan-feature="' + row.id + '"]');
          if (!tr || !row.plans) return;
          var cells = tr.querySelectorAll("td");
          columns.forEach(function (plan, i) {
            var td = cells[i];
            if (!td || typeof row.plans[plan] !== "boolean") return;
            var on = row.plans[plan];
            var words = on ? row.yes : row.no;
            td.removeAttribute("data-yes");
            td.removeAttribute("data-no");
            td.textContent = "";
            if (words) { td.textContent = t(words); return; }
            td.setAttribute(on ? "data-yes" : "data-no", "");
            var hidden = document.createElement("span");
            hidden.className = "visually-hidden";
            hidden.textContent = t(on ? "Included" : "Not included");
            td.appendChild(hidden);
          });
        });
      })
      .catch(function () {});
  }

  function load() {
    livePlanFeatures();
    if (!document.querySelector("[data-usd]")) return;
    drawSwitches();
    drawBillingSwitches();
    livePrices();
    fetch(RATES_URL, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("rates"); return r.json(); })
      .then(function (data) {
        // rates.json holds euro rates (as the ECB publishes them); turn them into USD -> X.
        var eur = data && data.rates;
        if (eur && eur.USD) {
          rates = { EUR: 1 / eur.USD, date: data.date };
          ["GBP", "NOK"].forEach(function (c) { if (eur[c]) rates[c] = eur[c] / eur.USD; });
        }
      })
      .catch(function () { rates = null; })
      .then(render);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();

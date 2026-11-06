/*
 * Prices in the visitor's currency.
 *
 * Every price on the site is written in US dollars, on an element with
 * data-usd="645". This script shows it in USD, EUR, GBP or NOK:
 *   - USD is the price as written.
 *   - EUR, GBP and NOK are converted with the day's European Central Bank
 *     rate (assets/data/rates.json, refreshed by the deploy workflow every
 *     working day) and rounded UP to the next whole number ending in 5.
 *
 * The currency is, in order: the one the visitor picked (remembered in this
 * browser), the one that fits the page language (de/fr/es: EUR, no: NOK), or
 * a guess from the time zone (Europe/London: GBP, Europe/Oslo: NOK, the rest
 * of Europe: EUR, elsewhere: USD).
 *
 * Mount points:
 *   [data-usd]               a price, its text is replaced
 *   [data-currency-switch]   the USD / EUR / GBP / NOK buttons are drawn here
 *   [data-currency-note]     "Prices in …" text for the current currency
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

  /* Round up to the next whole number ending in 5: 17.4 -> 25, 593 -> 595. */
  function niceUp(x) {
    if (x <= 5) return x <= 0 ? 0 : 5;
    return Math.ceil((x - 5) / 10) * 10 + 5;
  }

  function amount(usd, cur) {
    if (cur === "USD" || !rates || !rates[cur]) return usd;
    return niceUp(usd * rates[cur]);
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
      var usd = parseFloat(el.getAttribute("data-usd"));
      if (!isNaN(usd)) el.textContent = format(amount(usd, cur), cur);
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

  function load() {
    if (!document.querySelector("[data-usd]")) return;
    drawSwitches();
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

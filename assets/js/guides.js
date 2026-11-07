/* E1 user guides: the filter of the feature catalog (guide-features.html). */
(function () {
  "use strict";
  var table = document.querySelector("[data-guide-catalog]");
  if (!table) return;
  var search = document.querySelector("[data-guide-search]");
  var cat = document.querySelector("[data-guide-cat]");
  var status = document.querySelector("[data-guide-status]");
  var count = document.querySelector("[data-guide-count]");
  var rows = Array.prototype.slice.call(table.tBodies[0].rows);
  try {
    var q = new URLSearchParams(location.search);
    if (q.get("status")) status.value = q.get("status");
    if (q.get("category")) cat.value = q.get("category");
  } catch (e) { /* old browser: no preset */ }
  function apply() {
    var text = (search.value || "").toLowerCase();
    var shown = 0;
    rows.forEach(function (row) {
      var ok = (!cat.value || row.getAttribute("data-cat") === cat.value) &&
        (!status.value || row.getAttribute("data-status") === status.value) &&
        (!text || row.textContent.toLowerCase().indexOf(text) !== -1);
      row.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = shown + (shown === 1 ? " feature" : " features");
  }
  [search, cat, status].forEach(function (el) { el.addEventListener("input", apply); });
  apply();
})();

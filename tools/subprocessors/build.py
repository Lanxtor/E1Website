#!/usr/bin/env python3
"""Builds sub-processors.html from assets/data/sub-processors.json.

The JSON is generated in Lanxtor/E1 from E1's cloud configuration
(work order M4, M4.18):

    node scripts/sub-processors.mjs --reference --json > ../E1Website/assets/data/sub-processors.json

    python3 tools/subprocessors/build.py          write the page
    python3 tools/subprocessors/build.py --check  fail when the page is not what the JSON gives
"""
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data" / "sub-processors.json"
PAGE = ROOT / "sub-processors.html"
TEMPLATE_HEAD = (ROOT / "security.html").read_text(encoding="utf-8").split("<body", 1)[0]


def page(data):
    head = TEMPLATE_HEAD
    head = head.replace("Security and vulnerability reports — LANXTOR", "Sub-processors of E1 Cloud — LANXTOR")
    head = head.replace("How to report a security vulnerability in E1, the E1 desktop and iPad apps, the E1 Cloud or this website, and how Lanxtor Inc. handles and discloses it.",
                        "The companies that process personal data for E1 Cloud, what for, which data and where.")
    head = head.replace("security.html", "sub-processors.html")
    # English only for now: no language alternates.
    start, end = head.find("<!-- i18n:alternates -->"), head.find("<!-- /i18n:alternates -->")
    if start >= 0 and end >= 0:
        head = head[:start] + head[end + len("<!-- /i18n:alternates -->"):]
    rows = "\n".join(
        "            <tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(*(html.escape(item[key]) for key in ("company", "service", "purpose", "data", "location")))
        for item in data["subProcessors"]
    )
    return f"""{head}<body class="has-plant-bg">
  <div id="site-header"></div>

  <main>
    <section class="page-hero">
      <div class="container">
        <h1 class="reveal">Sub-processors.</h1>
        <p class="lead reveal">The companies that process personal data for E1 Cloud on behalf of your organization: what for, which data, and where.</p>
      </div>
    </section>

    <section class="section section-tight">
      <div class="container legal">
        <p class="cs-small">This list is Annex III of the <a href="dpa.html">E1 Data Processing Agreement</a> and is generated from E1 Cloud's configuration (generated {html.escape(data["generated"])}). We tell your organization's Owners and Administrators by email and in E1 at least 30 days before a new sub-processor processes your data; you may object to privacy@lanxtor.com within that time (DPA, section 8).</p>
        <div class="cs-table-wrap">
        <table class="cs-table">
          <thead><tr><th>Company</th><th>Service</th><th>Purpose</th><th>Personal data</th><th>Where</th></tr></thead>
          <tbody>
{rows}
          </tbody>
        </table>
        </div>
        <p>An enterprise installation in your own cloud or on your own servers has its own list: your administrator can see it at <code>/api/sub-processors</code> of the installation. See also the <a href="dpa.html">data processing agreement</a>, the <a href="cloud-specifications.html">E1 Cloud specifications</a>, our <a href="privacy.html">privacy notice</a> and <a href="security.html">security</a>.</p>
      </div>
    </section>
  </main>

  <div id="site-footer"></div>
  <script src="assets/js/i18n-dict.js?v=2"></script>
  <script src="assets/js/i18n.js?v=1"></script>
  <script src="assets/js/config.js?v=4"></script>
  <script src="assets/js/e1-api.js?v=7"></script>
  <script src="assets/js/main.js?v=39"></script>
  <script src="assets/js/chat.js?v=7"></script>
</body>
</html>
"""


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    text = page(data)
    if "--check" in sys.argv:
        if not PAGE.exists() or PAGE.read_text(encoding="utf-8") != text:
            print("sub-processors.html is not what assets/data/sub-processors.json gives: run python3 tools/subprocessors/build.py")
            sys.exit(1)
        print(f"sub-processors.html: {len(data['subProcessors'])} sub-processors")
        return
    PAGE.write_text(text, encoding="utf-8")
    print(f"Wrote sub-processors.html: {len(data['subProcessors'])} sub-processors")


if __name__ == "__main__":
    main()

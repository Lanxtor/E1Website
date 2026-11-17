#!/usr/bin/env python3
"""
Builds the solution pages: one page per item of the Solutions catalog (solutions.html), with
the long description a search engine or an AI assistant can read, its questions, links to the
user guide and to related solutions.

  python3 tools/solutions/build.py

Sources (edit these, never the generated pages):
  tools/solutions/pages/<id>.json   one page: {id, file, title, description, kicker, h1, lead,
                                    glance: [{value, label}], sections: [{id, kicker, h2, intro,
                                    paragraphs: [html], bullets: [html]}], faq: [{q, a}],
                                    guides: [feature ids], related: [catalog ids]}
                                    Texts are HTML: write & as &amp;.
  tools/solutions/order.json        the order of the pages (the catalog's order)

Writes solution-*.html in the site root (English), and llms-full.txt: llms.txt followed by the
full text of every solution page, for AI assistants that read one file. Run tools/i18n/build.py afterwards: it
translates them (they are in its PAGES), adds the search engine tags and the sitemap entries.
"""
import glob
import html
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HERE = os.path.join(ROOT, "tools", "solutions")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def styles_version():
    found = re.search(r"styles\.css\?v=(\d+)", read(os.path.join(ROOT, "index.html")))
    return found.group(1) if found else "1"


def main_js_version():
    found = re.search(r"main\.js\?v=(\d+)", read(os.path.join(ROOT, "index.html")))
    return found.group(1) if found else "1"


def load_pages():
    order = json.loads(read(os.path.join(HERE, "order.json")))
    pages = {}
    for path in glob.glob(os.path.join(HERE, "pages", "*.json")):
        p = json.loads(read(path))
        pages[p["id"]] = p
    missing = [i for i in order if i not in pages]
    if missing:
        raise SystemExit("tools/solutions: no page for %s" % ", ".join(missing))
    return [pages[i] for i in order]


def load_guides():
    feats = {}
    for path in glob.glob(os.path.join(ROOT, "tools", "guides", "features", "*.json")):
        cat = os.path.splitext(os.path.basename(path))[0]
        for f in json.loads(read(path)):
            feats[f["id"]] = (f["title"], "guide-%s.html#%s" % (cat, f.get("anchor", "")), f.get("status"))
    return feats


def esc(s):
    return html.escape(s, quote=True)


def plain(s):
    """An HTML text as an attribute value (the meta description)."""
    return esc(html.unescape(re.sub(r"<[^>]+>", "", s)))


BACK_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>')


def section(s):
    out = ['    <section class="section section-tight cs-section sol-section" id="%s">' % s["id"],
           '      <div class="container">',
           '        <div class="section-head reveal">']
    if s.get("kicker"):
        out.append('          <span class="saas-kicker">%s</span>' % s["kicker"])
    out.append('          <h2>%s</h2>' % s["h2"])
    if s.get("intro"):
        out.append('          <p>%s</p>' % s["intro"])
    out.append('        </div>')
    out.append('        <div class="sol-prose reveal">')
    for p in s.get("paragraphs", []):
        out.append('          <p>%s</p>' % p)
    if s.get("bullets"):
        out.append('          <ul>')
        for b in s["bullets"]:
            out.append('            <li>%s</li>' % b)
        out.append('          </ul>')
    for p in s.get("after", []):
        out.append('          <p>%s</p>' % p)
    out.append('        </div>')
    out.append('      </div>')
    out.append('    </section>')
    return "\n".join(out)


def build_page(p, by_id, guides, sv, mv):
    glance = ""
    if p.get("glance"):
        stats = "\n".join('          <div class="cs-stat"><b>%s</b><span>%s</span></div>' % (g["value"], g["label"])
                          for g in p["glance"])
        glance = ('        <div class="cs-glance reveal" aria-label="At a glance">\n%s\n        </div>\n' % stats)
    nav = "\n".join('          <a href="#%s">%s</a>' % (s["id"], s.get("nav", s.get("kicker", s["h2"])))
                    for s in p["sections"])
    nav += '\n          <a href="#faq">Questions</a>'
    sections = "\n\n".join(section(s) for s in p["sections"])
    faq = "\n".join("          <details>\n            <summary>%s</summary>\n            <p>%s</p>\n          </details>"
                    % (q["q"], q["a"]) for q in p["faq"])
    links = []
    for fid in p.get("guides", []):
        if fid not in guides:
            raise SystemExit("tools/solutions/pages/%s.json: no guide feature %s" % (p["id"], fid))
        title, href, status = guides[fid]
        if status != "available":
            raise SystemExit("tools/solutions/pages/%s.json: guide feature %s is %s, link only available ones"
                             % (p["id"], fid, status))
        links.append('            <li><a href="%s">%s</a></li>' % (href, esc(title)))
    related = "\n".join('            <li><a href="%s">%s</a></li>' % (by_id[r]["file"], by_id[r]["h1"].rstrip("."))
                        for r in p.get("related", []))
    return """﻿<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | LANXTOR E1</title>
  <meta name="description" content="{desc}">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/styles.css?v={sv}">
</head>
<body class="has-plant-bg">
  <!-- Generated by tools/solutions/build.py from tools/solutions/pages/{id}.json. Do not edit this file. -->
  <div id="site-header"></div>

  <main class="cs-page sol-page">
    <section class="page-hero cs-hero">
      <div class="container">
        <a class="cs-back reveal" href="solutions.html#{id}">{back}<span>Solutions</span></a>
        <span class="saas-kicker reveal">{kicker}</span>
        <h1 class="reveal">{h1}</h1>
        <p class="lead reveal">{lead}</p>
{glance}      </div>
    </section>

    <nav class="cs-nav" aria-label="On this page">
      <div class="container">
        <div class="cs-nav-track">
{nav}
        </div>
      </div>
    </nav>

{sections}

    <section class="section section-tight cs-section" id="faq">
      <div class="container">
        <div class="section-head reveal">
          <span class="saas-kicker">Questions</span>
          <h2>Questions engineers ask.</h2>
        </div>
        <div class="cs-faq reveal">
{faq}
        </div>
      </div>
    </section>

    <section class="section section-tight cs-section" id="more">
      <div class="container sol-more">
        <div class="reveal">
          <h2>In the user guide</h2>
          <ul class="sol-links">
{links}
          </ul>
        </div>
        <div class="reveal">
          <h2>Related solutions</h2>
          <ul class="sol-links">
{related}
            <li><a href="solutions.html">All solutions</a></li>
          </ul>
        </div>
      </div>
      <div class="container sol-cta reveal">
        <a class="btn btn-primary" href="download.html">Get E1</a>
        <a class="btn btn-ghost" href="contact-sales.html">Contact sales</a>
      </div>
    </section>
  </main>

  <div id="site-footer"></div>
  <script src="assets/js/i18n-dict.js?v=2"></script>
  <script src="assets/js/i18n.js?v=1"></script>
  <script src="assets/js/config.js?v=4"></script>
  <script src="assets/js/e1-api.js?v=7"></script>
  <script src="assets/js/main.js?v={mv}"></script>
  <script src="assets/js/chat.js?v=7"></script>
</body>
</html>
""".format(title=p["title"], desc=plain(p["description"]), sv=sv, mv=mv, id=p["id"], back=BACK_SVG,
           kicker=p["kicker"], h1=p["h1"], lead=p["lead"], glance=glance, nav=nav, sections=sections, faq=faq,
           links="\n".join(links), related=related)


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s)).split())


def write_llms_full(pages):
    out = [read(os.path.join(ROOT, "llms.txt")).rstrip(), "", "# Solutions in full", ""]
    for p in pages:
        out += ["## %s" % txt(p["h1"]).rstrip("."), "", "https://www.lanxtor.com/%s" % p["file"], "", txt(p["lead"]), ""]
        for s in p["sections"]:
            out += ["### %s" % txt(s["h2"]).rstrip("."), ""]
            if s.get("intro"):
                out += [txt(s["intro"]), ""]
            out += [txt(x) + "\n" for x in s.get("paragraphs", [])]
            out += ["- " + txt(b) for b in s.get("bullets", [])]
            if s.get("bullets"):
                out.append("")
            out += [txt(x) + "\n" for x in s.get("after", [])]
        out += ["### Questions", ""]
        for q in p["faq"]:
            out += ["**%s** %s" % (txt(q["q"]), txt(q["a"])), ""]
    with open(os.path.join(ROOT, "llms-full.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out).rstrip() + "\n")


def build():
    pages = load_pages()
    by_id = {p["id"]: p for p in pages}
    guides = load_guides()
    sv, mv = styles_version(), main_js_version()
    for old in glob.glob(os.path.join(ROOT, "solution-*.html")):
        os.remove(old)
    for p in pages:
        with open(os.path.join(ROOT, p["file"]), "w", encoding="utf-8", newline="\n") as f:
            f.write(build_page(p, by_id, guides, sv, mv))
    write_llms_full(pages)
    print("tools/solutions: %d pages" % len(pages))
    return pages


if __name__ == "__main__":
    build()

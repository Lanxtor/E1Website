#!/usr/bin/env python3
"""
Builds the translated copies of the public pages.

  python3 tools/i18n/build.py            extract + build every language
  python3 tools/i18n/build.py --check    exit 1 if a translation is missing

The English pages in the site root are the source. For every page in PAGES
this script finds the visible text (each block of text with its inline
markup, plus the title, the meta description and alt / aria-label /
placeholder / title attributes) and looks it up in tools/i18n/<lang>.json.
It then writes <lang>/<page> with only that text replaced, so the HTML,
classes and scripts stay identical to the English page.

  tools/i18n/strings.json   every English text found, generated; give it to
                            translators. Keys are the English text itself.
  tools/i18n/<lang>.json    {"pages": {english: translation},
                             "js": {english: translation}}
  assets/js/i18n-dict.js    the "js" strings, generated, used by main.js,
                            downloads.js and pricing.js through E1_T().

Text with no translation stays in English and is listed by --check.
Run this after every change to an English page, then commit the result
(the site is deployed as it is in the repository, without a build step).

Translated pages carry <base href="../">, so their asset and script paths
resolve from the site root; links between translated pages are rewritten to
stay in the same language.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(ROOT, "tools", "i18n")

PAGES = ["index.html", "solutions.html", "academy.html", "download.html",
         "about.html", "contact-sales.html", "shape-e1.html",
         "legal.html", "privacy.html", "terms.html"]
LANGS = {"de": "de", "fr": "fr", "es": "es", "no": "nb"}  # folder: html lang
SITE = "https://www.lanxtor.com"

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "source", "track", "wbr"}
INLINE = {"a", "b", "strong", "em", "i", "br", "span", "sup", "sub", "code",
          "small", "abbr", "bdi", "u", "mark", "s", "label", "time"}
SKIP = {"script", "style", "svg", "template", "noscript", "head"}
ATTRS = ("alt", "aria-label", "placeholder", "title", "data-label")
LETTER = re.compile(r"[A-Za-z]")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


class Tree(HTMLParser):
    """A tree of the page with the character offsets of every tag and text."""

    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer("\n", src):
            self.lines.append(m.end())
        self.root = {"tag": "#root", "children": [], "attrs": {}}
        self.stack = [self.root]
        self.feed(src)
        self.close()

    def off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def _start(self, tag, attrs, closed):
        s = self.off()
        raw = self.get_starttag_text()
        node = {"tag": tag, "attrs": dict(attrs), "s": s, "oe": s + len(raw),
                "children": [], "parent": self.stack[-1]}
        self.stack[-1]["children"].append(node)
        if not closed and tag not in VOID:
            self.stack.append(node)

    def handle_starttag(self, tag, attrs):
        self._start(tag, attrs, False)

    def handle_startendtag(self, tag, attrs):
        self._start(tag, attrs, True)

    def handle_endtag(self, tag):
        s = self.off()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]["tag"] == tag:
                node = self.stack[i]
                node["cs"] = s
                node["ce"] = self.src.index(">", s) + 1
                del self.stack[i:]
                return

    def _text(self, raw):
        s = self.off()
        self.stack[-1]["children"].append({"tag": "#text", "s": s, "e": s + len(raw)})

    def handle_data(self, data):
        self._text(data)

    def handle_entityref(self, name):
        self._text("&" + name + ";")

    def handle_charref(self, name):
        self._text("&#" + name + ";")


def text_of(src, n):
    return src[n["s"]:n["e"]]


def has_text(src, n):
    if n["tag"] == "#text":
        return bool(LETTER.search(text_of(src, n)))
    if n["tag"] in SKIP:
        return False
    return any(has_text(src, c) for c in n["children"])


def inline_only(n):
    for c in n["children"]:
        if c["tag"] == "#text":
            continue
        if c["tag"] not in INLINE or "cs" not in c and c["tag"] not in VOID:
            return False
        if not inline_only(c):
            return False
    return True


def collect(src, node, out):
    """Segments: (start, end) ranges of translatable inner HTML."""
    run = []  # adjacent text pieces (text, &amp; ...) form one segment

    def flush():
        if run and any(LETTER.search(text_of(src, t)) for t in run):
            out.append((run[0]["s"], run[-1]["e"]))
        del run[:]

    for c in node["children"]:
        if c["tag"] == "#text":
            if run and run[-1]["e"] != c["s"]:
                flush()
            run.append(c)
            continue
        flush()
        if c["tag"] in SKIP:
            continue
        if c["tag"] in VOID or "cs" not in c:
            continue
        if has_text(src, c) and inline_only(c):
            out.append((c["oe"], c["cs"]))
        else:
            collect(src, c, out)
    flush()


def all_nodes(n):
    yield n
    for c in n.get("children", []):
        yield from all_nodes(c)


def segments(src):
    tree = Tree(src)
    body = next(n for n in all_nodes(tree.root) if n["tag"] == "body")
    segs = []
    collect(src, body, segs)
    title = next((n for n in all_nodes(tree.root) if n["tag"] == "title"), None)
    if title:
        segs.append((title["oe"], title["cs"]))
    attrs = []  # (start, end) of attribute values
    for n in all_nodes(tree.root):
        if n["tag"] in ("#text", "#root") or n["tag"] == "svg":
            continue
        raw = src[n["s"]:n["oe"]]
        names = list(ATTRS)
        if n["tag"] == "meta" and n["attrs"].get("name") == "description":
            names.append("content")
        for name in names:
            m = re.search(r'\s%s="([^"]*)"' % re.escape(name), raw)
            if m and LETTER.search(m.group(1)):
                attrs.append((n["s"] + m.start(1), n["s"] + m.end(1)))
    return segs, attrs


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def rewrite_links(html, folder):
    """Translated pages use <base href="../">: keep their links in the language."""
    def fix(m):
        attr, val = m.group(1), m.group(2)
        if re.match(r"^(https?:|mailto:|tel:|data:|/|javascript:)", val):
            return m.group(0)
        page = val.split("#")[0].split("?")[0]
        if val.startswith("#"):
            return '%s="%s"' % (attr, val)  # fixed below, needs the page name
        if page in PAGES:
            return '%s="%s/%s"' % (attr, folder, val)
        return m.group(0)
    return re.sub(r'\b(href)="([^"]*)"', fix, html)


def build_page(name, src, folder, lang, table, missing):
    segs, attrs = segments(src)
    edits = []
    for s, e in segs + attrs:
        inner = src[s:e]
        key = norm(inner)
        if not key:
            continue
        tr = table.get(key)
        if tr is None:
            missing.add(key)
            continue
        lead = inner[:len(inner) - len(inner.lstrip())]
        trail = inner[len(inner.rstrip()):]
        edits.append((s, e, lead + tr + trail))
    out = src
    for s, e, rep in sorted(edits, reverse=True):
        out = out[:s] + rep + out[e:]
    out = re.sub(r'<html lang="en"', '<html lang="%s" data-lang="%s"' % (lang, folder), out, count=1)
    out = out.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="../">', 1)
    out = rewrite_links(out, folder)
    out = re.sub(r'href="#([^"]*)"', r'href="%s/%s#\1"' % (folder, name), out)
    return out


def alternates(name):
    links = ['<link rel="alternate" hreflang="en" href="%s/%s">' % (SITE, name)]
    for folder, lang in LANGS.items():
        links.append('<link rel="alternate" hreflang="%s" href="%s/%s/%s">' % (lang, SITE, folder, name))
    links.append('<link rel="alternate" hreflang="x-default" href="%s/%s">' % (SITE, name))
    return "  <!-- i18n:alternates -->\n  " + "\n  ".join(links) + "\n  <!-- /i18n:alternates -->\n"


# Search engines and link previews (run after the pages are written): each
# public page gets its <!-- seo --> block (tools/seo/seo.py) in its language,
# sitemap.xml lists every public page with its languages and the date it last
# changed, and personal or hidden pages get "noindex" instead.
sys.path.insert(0, os.path.join(ROOT, "tools", "seo"))
import seo as SEO  # noqa: E402

NOINDEX = ["account.html", "login.html", "training.html", "user-guides.html", "certificate.html",
           "pricing.html", "industries.html", "404.html"]


def last_changed(path):
    """The date of the file's last commit (today if it is not committed yet)."""
    import subprocess, datetime
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", path], cwd=ROOT,
                             capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        out = ""
    return out or datetime.date.today().isoformat()


def seo():
    urls = []
    for name in PAGES:
        variants = [("", "en")] + [(f + "/", l) for f, l in LANGS.items()]
        alts = [(l, "%s/%s%s" % (SITE, f, name)) for f, l in variants] + [("x-default", "%s/%s" % (SITE, name))]
        when = last_changed(name)
        for folder, lang in variants:
            path = os.path.join(ROOT, folder, name)
            src = open(path, encoding="utf-8").read()
            url = "%s/%s%s" % (SITE, folder, name)
            block = SEO.head_block(src, url, lang, home=(name == "index.html"))
            open(path, "w", encoding="utf-8").write(SEO.put_block(src, block))
            urls.append((url, alts, when))
    # The user guide pages (guide*.html) are noindex by design (tools/guides/build.py), so they are
    # not in the sitemap: a sitemap lists only pages search engines may show.
    # The coming-soon page is what www.lanxtor.com shows before launch (SITE_MODE is not "live"):
    # indexable, with the home page's address and the company data, so a search for LANXTOR finds it.
    path = os.path.join(ROOT, "coming-soon.html")
    src = open(path, encoding="utf-8").read()
    open(path, "w", encoding="utf-8").write(SEO.put_block(src, SEO.head_block(src, SITE + "/", "en", home=True)))
    for name in NOINDEX:
        path = os.path.join(ROOT, name)
        if not os.path.exists(path):
            continue
        src = open(path, encoding="utf-8").read()
        if 'name="robots"' not in src:
            src = src.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="robots" content="noindex">', 1)
            open(path, "w", encoding="utf-8").write(src)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for url, alts, when in urls:
        lines.append("  <url><loc>%s</loc><lastmod>%s</lastmod>" % (url, when))
        for l, href in alts:
            lines.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, href))
        lines.append("  </url>")
    lines.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

def main():
    check = "--check" in sys.argv
    strings = {}
    sources = {}
    for name in PAGES:
        path = os.path.join(ROOT, name)
        src = open(path, encoding="utf-8").read()
        # hreflang block in the English page (kept up to date, idempotent)
        src = re.sub(r"  <!-- i18n:alternates -->.*?<!-- /i18n:alternates -->\n", "", src, flags=re.S)
        src = src.replace("</head>", alternates(name) + "</head>", 1)
        open(path, "w", encoding="utf-8").write(src)
        sources[name] = src
        segs, attrs = segments(src)
        for s, e in segs + attrs:
            key = norm(src[s:e])
            if key:
                strings.setdefault(key, []).append(name)
    js_strings = load(os.path.join(HERE, "js-strings.json"), [])
    with open(os.path.join(HERE, "strings.json"), "w", encoding="utf-8") as f:
        json.dump({"pages": {k: "" for k in strings}, "js": {k: "" for k in js_strings}},
                  f, ensure_ascii=False, indent=1)

    report = {}
    dict_js = {}
    for folder, lang in LANGS.items():
        data = load(os.path.join(HERE, folder + ".json"), {"pages": {}, "js": {}})
        table = {norm(k): v for k, v in data.get("pages", {}).items() if v}
        missing = set()
        os.makedirs(os.path.join(ROOT, folder), exist_ok=True)
        for name, src in sources.items():
            out = build_page(name, src, folder, lang, table, missing)
            open(os.path.join(ROOT, folder, name), "w", encoding="utf-8").write(out)
        js = {k: v for k, v in data.get("js", {}).items() if v}
        dict_js[folder] = js
        missing |= {k for k in js_strings if k not in js}
        report[folder] = missing

    with open(os.path.join(ROOT, "assets", "js", "i18n-dict.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by tools/i18n/build.py from tools/i18n/<lang>.json. Do not edit. */\n")
        f.write("window.E1_I18N_PAGES = %s;\n" % json.dumps(PAGES))
        f.write("window.E1_I18N_DICT = %s;\n" % json.dumps(dict_js, ensure_ascii=False, indent=1))

    seo()

    total = len(strings) + len(js_strings)
    for folder, missing in report.items():
        print("%s: %d of %d texts translated" % (folder, total - len(missing), total))
        if check:
            for k in sorted(missing)[:20]:
                print("   missing:", k[:90])
    if check and any(report.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()

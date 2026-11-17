#!/usr/bin/env python3
"""
Checks what search engines and AI assistants read on the website.

  python3 tools/seo/check.py

For every address in sitemap.xml: the file exists, is not noindex, has one <h1>, a title and a
description, a canonical address equal to its own, valid structured data (JSON-LD), and its
links to other pages of the site lead to files that exist. Every solution page and every public
guide page is in the sitemap. Titles longer than 70 characters and descriptions outside 70–170
are reported as warnings (search results cut them).

Exits 1 on an error; warnings alone do not fail.
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = "https://www.lanxtor.com"


def read(path):
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def text(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def main():
    errors, warnings = [], []
    sitemap = read(os.path.join(ROOT, "sitemap.xml"))
    urls = re.findall(r"<loc>(.*?)</loc>", sitemap)
    listed = set()
    for url in urls:
        rel = url[len(SITE) + 1:] or "index.html"
        listed.add(rel)
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            errors.append("%s: in the sitemap but there is no file" % rel)
            continue
        src = read(path)
        head = src.split("</head>")[0]
        if re.search(r'name="robots" content="[^"]*noindex', head):
            errors.append("%s: in the sitemap but noindex" % rel)
        t = re.search(r"<title>(.*?)</title>", head, re.S)
        d = re.search(r'<meta name="description" content="([^"]*)"', head)
        c = re.search(r'<link rel="canonical" href="([^"]*)"', head)
        if not t or not text(t.group(1)):
            errors.append("%s: no title" % rel)
        elif len(text(t.group(1))) > 70:
            warnings.append("%s: title has %d characters" % (rel, len(text(t.group(1)))))
        if not d:
            errors.append("%s: no description" % rel)
        elif not 70 <= len(html.unescape(d.group(1))) <= 170:
            warnings.append("%s: description has %d characters" % (rel, len(html.unescape(d.group(1)))))
        if not c:
            errors.append("%s: no canonical address" % rel)
        elif c.group(1) != url and not (rel == "index.html" and c.group(1) == SITE + "/index.html"):
            errors.append("%s: canonical is %s" % (rel, c.group(1)))
        h1 = len(re.findall(r"<h1\b", src))
        if h1 != 1:
            errors.append("%s: %d <h1>" % (rel, h1))
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', src, re.S):
            try:
                json.loads(block.replace("<\\/", "</"))
            except ValueError as e:
                errors.append("%s: structured data is not valid JSON (%s)" % (rel, e))
        base = os.path.dirname(rel)
        if '<base href="../">' in head:
            base = ""
        for href in re.findall(r'\bhref="([^"#?]+)', src.split("<body", 1)[-1]):
            if re.match(r"^(https?:|mailto:|tel:|data:|javascript:)", href):
                continue
            target = os.path.normpath(os.path.join(ROOT, href.lstrip("/") if href.startswith("/") else os.path.join(base, href)))
            if href.endswith(".html") and not os.path.exists(target):
                errors.append("%s: link to %s, which does not exist" % (rel, href))
    expected = [os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "solution-*.html"))]
    expected += [os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "guide*.html"))
                 if os.path.basename(p) not in ("guide-features.html", "guide-roadmap.html")]
    for name in sorted(expected):
        if name not in listed:
            errors.append("%s: public page missing from the sitemap" % name)
    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("error:", e)
    print("%d addresses checked, %d errors, %d warnings" % (len(urls), len(errors), len(warnings)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

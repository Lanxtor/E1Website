#!/usr/bin/env python3
"""
Writes assets/data/assistant-knowledge.txt: the visible text of the English
public pages, which Alex, the website assistant, answers from. The E1 server
(Lanxtor/E1, server/site/assistant.mjs, POST /api/site/assistant) reads this
file from the live website once an hour.

  python3 tools/chat/build_knowledge.py

The deploy workflow runs this before every deployment, so the assistant always
knows what the live pages say. It reuses the text finder of the translation
build (tools/i18n/build.py).
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools", "i18n"))
import build as i18n  # noqa: E402

PAGES = [
    ("index.html", "Home"),
    ("solutions.html", "Solutions (feature catalog)"),
    ("download.html", "Get E1: E1 Cloud, enterprise installation, universities, licenses and prices, trial, download"),
    ("cloud-specifications.html", "E1 Cloud specifications: data location, performance, security, who can see what, backups and recovery, standards, apps and limits"),
    ("academy.html", "E1 Academy"),
    ("contact-sales.html", "Contact sales"),
    ("shape-e1.html", "Contact us: sales and support emails, feature requests and open roles"),
    ("about.html", "About us"),
    ("legal.html", "Legal notice"),
    ("privacy.html", "Privacy policy"),
    ("terms.html", "Terms of use"),
]


def text(fragment):
    s = re.sub(r"<br\s*/?>", "\n", fragment)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("‑", "-")
    return re.sub(r"[ \t]+", " ", s).strip()


def license_table():
    """The licenses table on download.html, one line per row, so columns stay paired."""
    src = open(os.path.join(ROOT, "download.html"), encoding="utf-8").read()
    table = re.search(r'<table class="pricing pricing-licenses">(.*?)</table>', src, re.S).group(1)
    head = re.search(r"<thead>(.*?)</thead>", table, re.S).group(1)
    cols = []
    for th in re.findall(r"<th scope=\"col\">(.*?)</th>", head, re.S)[1:]:
        tier = text(re.search(r'class="tier">(.*?)<', th).group(1))
        price = re.search(r'data-usd="([^"]+)"', th)
        per = re.search(r'class="per">(.*?)</span>\s*$', th.strip(), re.S)
        cols.append("%s (%s)" % (tier, text(per.group(1)) if price and per else "contact sales"))
    lines = ["## Licenses table (download.html#pricing)", "Columns: " + "; ".join(cols)]
    for row in re.findall(r"<tr><th scope=\"row\">(.*?)</th>(.*?)</tr>", table, re.S):
        cells = [text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row[1], re.S)]
        lines.append("%s: %s" % (text(row[0]), "; ".join("%s = %s" % (cols[i].split(" (")[0], c) for i, c in enumerate(cells))))
    return without_prices("\n".join(lines))


PRICE_SPAN = re.compile(r"<span[^>]*\bdata-usd=\"[^\"]*\"[^>]*>[^<]*</span>")


def without_prices(s):
    """Prices live only in the licenses table, filled from the E1 server's price list;
    the numbers written in the page are a fallback and may be out of date, so the
    assistant gets none of them and links the table instead."""
    s = PRICE_SPAN.sub("[price in the table]", s)
    return re.sub(r"(?:US)?\$\s?\d[\d,.]*", "[price in the table]", s)


def main():
    out = []
    for name, title in PAGES:
        src = open(os.path.join(ROOT, name), encoding="utf-8").read()
        segs, _ = i18n.segments(src)
        lines, seen = [], set()
        for s, e in sorted(segs):
            t = without_prices(text(PRICE_SPAN.sub("[price in the table]", src[s:e])))
            if t and t not in seen and "LANXTOR —" not in t:
                seen.add(t)
                lines.append(t)
        out.append("## %s (%s)\n%s" % (title, name, "\n".join(lines)))
    out.append(license_table())
    # Prices shown on the pages come from data-usd attributes; say so plainly.
    out.append("## Price notes\nPrices are not in this text. The only place with the current prices is the licenses table at "
               "download.html#pricing, which reads them from LANXTOR's price list; it shows them in USD, EUR, GBP or NOK, "
               "excluding VAT. Never quote a price: link [licenses and prices](download.html#pricing).")
    path = os.path.join(ROOT, "assets", "data", "assistant-knowledge.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(out) + "\n")
    print("Wrote %s (%d characters)" % (os.path.relpath(path, ROOT), sum(len(x) for x in out)))


if __name__ == "__main__":
    main()

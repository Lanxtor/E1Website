"""
Search engines and link previews for the LANXTOR website, shared by
tools/i18n/build.py (the site pages in every language) and
tools/guides/build.py (the user guide pages).

head_block(src, url, lang) returns the <!-- seo --> block for a page: its
canonical address, icons, theme colour, Open Graph and Twitter tags (from
the page's own <title> and description), and, for the home page, the
structured data Google reads for the company and the product (JSON-LD).
"""
import html
import json
import re

SITE = "https://www.lanxtor.com"
OG_IMAGE = SITE + "/assets/img/og-image.png"
LOCALE = {"en": "en_US", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "nb": "nb_NO"}
LINKEDIN = "https://www.linkedin.com/company/lanxtor/"

ORGANIZATION = {
    "@type": "Organization",
    "@id": SITE + "/#organization",
    "name": "Lanxtor LLC",
    "alternateName": "LANXTOR",
    "url": SITE + "/",
    "logo": SITE + "/assets/img/logo-512.png",
    "email": "info@lanxtor.com",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "7545 Irvine Center Drive, Suite 200",
        "addressLocality": "Irvine",
        "addressRegion": "CA",
        "postalCode": "92618",
        "addressCountry": "US",
    },
    "sameAs": [LINKEDIN],
    "contactPoint": [
        {"@type": "ContactPoint", "contactType": "sales", "email": "sales@lanxtor.com", "availableLanguage": ["en", "de", "fr", "es", "no"]},
        {"@type": "ContactPoint", "contactType": "technical support", "email": "support@lanxtor.com",
         "availableLanguage": ["en", "de", "fr", "es", "no"]},
    ],
}


PRODUCT = {
    "@type": "SoftwareApplication", "@id": SITE + "/#product", "name": "LANXTOR E1",
    "applicationCategory": "BusinessApplication", "applicationSubCategory": "Plant engineering software",
    "operatingSystem": "Windows, macOS, web browser",
    "description": "Plant engineering software: FEED, process, P&IDs, instrumentation, electrical, "
                   "automation and maintenance on one data model, with Alex, the AI co-engineer.",
    "url": SITE + "/solutions.html",
    "publisher": {"@id": SITE + "/#organization"},
    "offers": {"@type": "AggregateOffer", "priceCurrency": "USD", "lowPrice": "0", "highPrice": "795",
               "offerCount": "5", "url": SITE + "/download.html#pricing"}}


def _text(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def faq_of(src):
    """The questions of a page (<div class="cs-faq"> with <details><summary>…</summary><p>…</p>)."""
    m = re.search(r'<div class="cs-faq[^"]*">(.*?)\n        </div>', src, re.S)
    if not m:
        return []
    return [(_text(q), _text(a)) for q, a in
            re.findall(r"<summary>(.*?)</summary>\s*<p>(.*?)</p>\s*</details>", m.group(1), re.S)]


def _ld(graph):
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return '<script type="application/ld+json">\n' + data.replace("</", "<\\/") + "\n  </script>"


def _page_graph(src, url, lang, crumbs, product):
    """Structured data of an ordinary page: its place in the site (breadcrumbs), its questions
    (FAQPage) and, where E1 is offered, the product."""
    graph = []
    if crumbs:
        items = [{"@type": "ListItem", "position": 1, "name": "LANXTOR", "item": SITE + "/"}]
        for i, (name, href) in enumerate(crumbs):
            items.append({"@type": "ListItem", "position": i + 2, "name": _text(name), "item": href})
        graph.append({"@type": "BreadcrumbList", "itemListElement": items})
    faq = faq_of(src)
    if faq:
        graph.append({"@type": "FAQPage", "inLanguage": lang, "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    if product:
        graph.append(dict(PRODUCT, publisher={"@type": "Organization", "@id": SITE + "/#organization",
                                              "name": "Lanxtor LLC", "url": SITE + "/"}))
    return _ld(graph) if graph else ""


def _structured(lang):
    graph = [
        ORGANIZATION,
        {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": "LANXTOR",
         "publisher": {"@id": SITE + "/#organization"},
         "inLanguage": ["en", "de", "fr", "es", "nb"]},
        PRODUCT,
    ]
    return _ld(graph)


def _attr(v):
    return html.escape(html.unescape(v), quote=True)


def head_block(src, url, lang="en", home=False, crumbs=None, product=False):
    t = re.search(r"<title>(.*?)</title>", src, re.S)
    d = re.search(r'<meta name="description" content="([^"]*)"', src)
    title = _attr(t.group(1).strip()) if t else "LANXTOR"
    desc = _attr(d.group(1)) if d else ""
    tags = [
        '<link rel="canonical" href="%s">' % url,
        '<link rel="icon" href="/assets/img/favicon.ico" sizes="48x48">',
        '<link rel="icon" href="/assets/img/icon-192.png" type="image/png" sizes="192x192">',
        '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
        '<link rel="manifest" href="/assets/site.webmanifest">',
        '<meta name="theme-color" content="#0b2a4a">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="LANXTOR">',
        '<meta property="og:title" content="%s">' % title,
        '<meta property="og:description" content="%s">' % desc,
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:image" content="%s">' % OG_IMAGE,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="LANXTOR E1: plant engineering, at the speed of thought.">',
        '<meta property="og:locale" content="%s">' % LOCALE.get(lang, "en_US"),
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if home:
        tags.append(_structured(lang))
    else:
        ld = _page_graph(src, url, lang, crumbs, product)
        if ld:
            tags.append(ld)
    return "  <!-- seo -->\n  " + "\n  ".join(tags) + "\n  <!-- /seo -->\n"


def put_block(src, block):
    src = re.sub(r"  <!-- seo -->.*?<!-- /seo -->\n", "", src, flags=re.S)
    return src.replace("</head>", block + "</head>", 1)


# Links for crawlers that do not run scripts (most AI crawlers): the header and footer are drawn
# by assets/js/main.js, so every page also carries the site's main links as plain HTML inside
# <div id="site-footer">, which main.js replaces with the footer.
SITE_LINKS = [
    ("index.html", "Home"), ("solutions.html", "Solutions"), ("download.html", "Get E1"),
    ("download.html#pricing", "Pricing"), ("cloud-specifications.html", "E1 Cloud specifications"),
    ("academy.html", "Academy"), ("guide.html", "User guide"), ("security.html", "Security"),
    ("about.html", "About us"), ("shape-e1.html", "Contact us"), ("contact-sales.html", "Contact sales"),
]


def site_links_html(solutions=()):
    """solutions: [(file, name)] of the solution pages."""
    def ul(links):
        return "<ul>" + "".join('<li><a href="%s">%s</a></li>' % (h, t) for h, t in links) + "</ul>"
    out = '<nav class="site-links" aria-label="Site">' + ul(SITE_LINKS)
    if solutions:
        out += ul(solutions)
    return out + "</nav>"


def solution_links():
    """[(file, name)] of the solution pages, in the catalog's order (tools/solutions)."""
    import os
    here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "solutions")
    try:
        order = json.load(open(os.path.join(here, "order.json"), encoding="utf-8"))
    except OSError:
        return []
    out = []
    for pid in order:
        try:
            p = json.load(open(os.path.join(here, "pages", pid + ".json"), encoding="utf-8"))
        except OSError:
            continue
        out.append((p["file"], p["h1"].rstrip(".")))
    return out


def put_site_links(src, solutions=None):
    if solutions is None:
        solutions = solution_links()
    return re.sub(r'<div id="site-footer">.*?</div>', '<div id="site-footer">%s</div>' % site_links_html(solutions),
                  src, count=1, flags=re.S)

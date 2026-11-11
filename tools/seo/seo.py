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
    "name": "Lanxtor Inc.",
    "alternateName": "LANXTOR",
    "url": SITE + "/",
    "logo": SITE + "/assets/img/logo-512.png",
    "email": "info@lanxtor.com",
    "telephone": "+1-949-400-1129",
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
        {"@type": "ContactPoint", "contactType": "sales", "email": "sales@lanxtor.com",
         "telephone": "+1-949-400-1129", "availableLanguage": ["en", "de", "fr", "es", "no"]},
        {"@type": "ContactPoint", "contactType": "technical support", "email": "support@lanxtor.com",
         "availableLanguage": ["en", "de", "fr", "es", "no"]},
    ],
}


def _structured(lang):
    graph = [
        ORGANIZATION,
        {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": "LANXTOR",
         "publisher": {"@id": SITE + "/#organization"},
         "inLanguage": ["en", "de", "fr", "es", "nb"]},
        {"@type": "SoftwareApplication", "name": "LANXTOR E1",
         "applicationCategory": "BusinessApplication", "applicationSubCategory": "Plant engineering software",
         "operatingSystem": "Windows, macOS, web browser",
         "description": "Plant engineering software: FEED, process, P&IDs, instrumentation, electrical, "
                        "automation and maintenance on one data model, with Alex, the AI co-engineer.",
         "url": SITE + "/solutions.html",
         "publisher": {"@id": SITE + "/#organization"},
         "offers": {"@type": "AggregateOffer", "priceCurrency": "USD", "lowPrice": "0", "highPrice": "795",
                    "offerCount": "4", "url": SITE + "/download.html#pricing"}},
    ]
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return '<script type="application/ld+json">\n' + data.replace("</", "<\\/") + "\n  </script>"


def _attr(v):
    return html.escape(html.unescape(v), quote=True)


def head_block(src, url, lang="en", home=False):
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
    return "  <!-- seo -->\n  " + "\n  ".join(tags) + "\n  <!-- /seo -->\n"


def put_block(src, block):
    src = re.sub(r"  <!-- seo -->.*?<!-- /seo -->\n", "", src, flags=re.S)
    return src.replace("</head>", block + "</head>", 1)

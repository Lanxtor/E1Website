# Search engines, link previews and AI search

What the website has, and what is done outside it.

## On the website (generated, do not edit by hand)

`python3 tools/i18n/build.py` writes, after the translations:

- **Every public page, in every language** (`index`, `solutions`, `academy`, `download`, `about`,
  `contact-sales`, `shape-e1`, `legal`, `privacy`, `terms`, each in en, de, fr, es, no): a
  `<!-- seo -->` block from `tools/seo/seo.py` with its canonical address (`https://www.lanxtor.com/…`),
  icons, theme colour, Open Graph and Twitter tags (title and description in the page's language,
  preview image `assets/img/og-image.png`, 1200×630). The `hreflang` links between the languages
  (with `x-default`) come from the same build.
- **The home page and the coming-soon page**: structured data (JSON-LD) for the company
  (Lanxtor LLC, logo, address, phone, emails, LinkedIn), the website and the product (LANXTOR E1,
  with its price range).
- **Every other public page**: structured data from the same block: breadcrumbs (`BreadcrumbList`),
  the page's questions (`FAQPage`, read from its `<div class="cs-faq">`) and, on Get E1 and
  Solutions, the product with its price range.
- **The solution pages** (`solution-*.html`, one per item of the Solutions catalog, which links to
  each with "Read more"): written as JSON in `tools/solutions/pages/`, built by
  `python3 tools/solutions/build.py`, then translated by the i18n build like every other page.
  The same build writes `llms-full.txt` (llms.txt plus the full text of the solution pages).
- **The user guide** (`guide.html`, `guide-<category>.html`, English only): indexed, with canonical,
  Open Graph and breadcrumbs (`tools/guides/build.py`). Only the feature table and the roadmap
  (`guide-features.html`, `guide-roadmap.html`) stay `noindex`.
- **The site's links as plain HTML** inside `<div id="site-footer">` on every page (`seo.put_site_links`):
  the header and footer are drawn by `main.js`, which most AI crawlers do not run.
- **`sitemap.xml`**: every public page with its languages, and the user guide pages, with the date each
  last changed.
- **`noindex`** on pages that are personal or not public: account, login, training, certificate,
  pricing (a redirect), industries, 404.

Order of the builds after a change: `tools/solutions/build.py`, `tools/guides/build.py`,
`tools/i18n/build.py` (translations, SEO blocks, sitemap), then `python3 tools/seo/check.py`, which
the deployment also runs: it fails on a page in the sitemap without title, description, canonical
or one `<h1>`, on invalid structured data, on links to missing pages and on a public page missing
from the sitemap.

By hand:

- `robots.txt` (everything allowed, AI search crawlers named, points to the sitemap), `llms.txt` (a short summary of LANXTOR
  and E1 for AI assistants and AI search, with the solution pages and the user guide), `404.html` (served with status 404 by
  `staticwebapp.config.json`), `assets/site.webmanifest`, the icons in `assets/img/`
  (`favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `logo-512.png`).

Before launch (`SITE_MODE` is not `live`), www.lanxtor.com shows `coming-soon.html` for every
address: it is indexable, has the home page's canonical address and the company data, so a search
for LANXTOR finds it. Icons and the manifest live under `/assets/`, which stays reachable then.

## Outside the website (owner)

1. **Domain**: make `www.lanxtor.com` the one address; `lanxtor.com` redirects to it (Azure Static
   Web Apps → Custom domains). Every canonical, sitemap and hreflang address uses `www`.
2. **Google Search Console** (search.google.com/search-console): add a *Domain* property for
   `lanxtor.com`, verify it with the TXT record Google gives you at your DNS provider, then
   *Sitemaps* → submit `https://www.lanxtor.com/sitemap.xml` (after launch). Use *URL inspection* →
   *Request indexing* for the home page on launch day.
3. **Bing Webmaster Tools** (bing.com/webmasters): *Import from Google Search Console* (also covers
   DuckDuckGo, Yahoo and the search behind ChatGPT and Copilot).
4. **Google Business Profile** (business.google.com) for Lanxtor LLC in Irvine, so the company
   shows with address, phone and website.
5. **LinkedIn company page**: website `https://www.lanxtor.com`, the same logo and description.
6. **Links from elsewhere**: partners, universities, directories (for example G2, Capterra) linking
   to www.lanxtor.com help the most once the site is live.

# SEO and AI-search plan for www.lanxtor.com

Audit date: 17 November 2026. Based on the repository code. This container couldn't reach the live site, so check rankings and indexing in Search Console after launch.

## 1. Where we stand

**Already good (keep):**
- Every public page has a title, meta description, canonical, Open Graph/Twitter tags, `hreflang` links for 5 languages, and one `h1`. Every image has alt text.
- `sitemap.xml` (50 pages with hreflang), `robots.txt` (allows all crawlers, including AI crawlers), `llms.txt`, and a real 404 page.
- Organization, WebSite and Product JSON-LD on the home page. HTTPS and security headers are set.

**Main gaps (biggest first):**
| # | Gap | Impact |
|---|-----|--------|
| 1 | Before launch, every address shows `coming-soon.html` (18 words). Google and AI engines have almost nothing to read until `SITE_MODE=live`. | Critical |
| 2 | The **user guides (~1.3 million characters, 19 pages) are `noindex`**. They are the site's richest content and match exactly what engineers search for ("how to make a P&ID", "instrument index", "cable schedule"). | Very high |
| 3 | Public pages are thin: Solutions 461 words, About 144, Contact sales 70, Academy 341. There are no pages per discipline or use case, so we can't rank for "P&ID software", "electrical design software", "instrument index software" or "FEED software". | Very high |
| 4 | There's no blog, comparison or resource content. AI answers ("best plant engineering software", "alternative to AVEVA / Hexagon SmartPlant / AutoCAD Plant 3D") cite comparison and explainer pages, and we have none. | High |
| 5 | Structured data is only on the home page. There's no `SoftwareApplication`/`Offer` on Get E1, no `FAQPage`, no `BreadcrumbList`, no `Course` on Academy and no `Person` for the founder on About. | Medium |
| 6 | All `lastmod` dates are today, because the build stamps them every time. Google learns to ignore dates like that. | Medium |
| 7 | `Cache-Control: no-cache` applies to every file, including images, CSS and JS. `og-image.png` is 267 KB and `hero-of-alexandria.png` is 230 KB, which hurts Core Web Vitals and page speed. | Medium |
| 8 | Addresses end in `.html` (`/solutions.html`). It works, but clean URLs (`/solutions`) look better in results. It's cheap to change before launch, and costly after. | Low–medium |
| 9 | `industries.html` is `noindex` and has no canonical. Short page titles ("Get E1", "Academy") don't contain keywords. | Low–medium |
| 10 | `llms.txt` is short and doesn't list the guides, prices, comparisons or FAQ. | Low–medium |

## 2. Code work (I can do all of this)

### Phase A: before launch (now → March 2027)
1. **Index the user guides.** Remove `noindex` from `guide-*.html` and give each guide page a title and description, a canonical, `BreadcrumbList`, and its place in the sitemap. If some parts must stay private, split public how-to content from account-only content.
2. **Keyword-led titles and descriptions** on every page in all 5 languages. For example, "Get E1" becomes "Get E1: plant engineering software for macOS, Windows and cloud | LANXTOR", and "Solutions" becomes "P&ID, instrumentation, electrical and automation software | LANXTOR E1".
3. **One landing page per discipline and use case.** Start with about 8: P&ID software, instrumentation (instrument index, loop diagrams), electrical design (cable schedules, single lines), automation/PLC I/O, FEED engineering, process engineering, maintenance/asset data, and AI for plant engineering (Alex). Each needs 800–1,500 words, screenshots, an FAQ, and links to the guides. All 5 languages go through the i18n build.
4. **Structured data everywhere:**
   - `SoftwareApplication` with an `Offer` (prices) on Get E1
   - `FAQPage` on landing pages and Get E1
   - `Course` on Academy
   - `Person` (founder) and `Organization` on About
   - `BreadcrumbList` on all pages
   - `HowTo`/`TechArticle` on guides
5. **Real `lastmod`:** take it from each page's last git commit, not the build date.
6. **Performance:** long cache (`max-age=31536000, immutable`) for versioned CSS, JS and images; compress the PNGs to WebP (og-image under 100 KB); set `width`/`height` on images; `defer` the 8 scripts on the home page; lazy-load images below the fold. Target: Lighthouse 95+ and good Core Web Vitals.
7. **Clean URLs** (`/solutions`, `/de/solutions`) with 301s from the `.html` addresses, applied consistently to canonical, sitemap and hreflang.
8. **AI-search readiness (GEO):**
   - Expand `llms.txt` and add `llms-full.txt` (full plain-text product facts, prices, FAQ, guide index).
   - Write short, quotable "fact" paragraphs at the top of key pages ("E1 is… It costs… It runs on…").
   - Keep `robots.txt` open to GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended, and list them explicitly.
   - Make sure the key text is in the static HTML, not only rendered by JS. It is today, so keep it that way.
9. **Internal linking:** link home → landing pages → guides and back, use descriptive anchor text, add a footer site map, and link related guides.
10. **A content hub** (`/resources/` or `/blog/`) with a simple build. Publish 2 articles a month: comparisons ("E1 vs AutoCAD Plant 3D", "vs AVEVA", "vs SmartPlant/Hexagon", "vs EPLAN"), explainers ("What is a P&ID", "Instrument index template", "FEED deliverables checklist") and glossary entries.
11. **An automated SEO check in CI:** every page has a title of 30–60 characters, a description of 70–160, one h1, a canonical, hreflang, valid JSON-LD and is in the sitemap; no broken links. This keeps it from breaking unseen.

### Phase B: launch day (19 May 2027)
- Set `SITE_MODE=live`, submit the sitemap in Google and Bing, request indexing of the home page, landing pages and guides, and enable **IndexNow** (instant Bing/Copilot/ChatGPT-search updates; free, a small file plus a ping in the deploy workflow).

### Phase C: after launch (ongoing)
- Monthly: check Search Console queries, then expand the pages that rank on page 2. Add customer case studies as they come. Keep guides current (already a rule).

## 3. Your work: free, but only you can do it
1. **Google Search Console** and **Bing Webmaster Tools.** Verify the domain now (this is in `docs/SEO.md`). Bing also feeds ChatGPT search, Copilot and DuckDuckGo.
2. **Google Business Profile** for Lanxtor LLC (Irvine).
3. **Consistent profiles** (same name, logo and one-line description) linked from `sameAs`: LinkedIn, YouTube, X, GitHub, Crunchbase, Wikidata entry. Wikidata and Crunchbase are strong signals that AI engines trust.
4. **Free listings:** G2, Capterra, GetApp, Software Advice, SourceForge, Product Hunt (launch day), AlternativeTo (list E1 as an alternative to AVEVA, Plant 3D, SmartPlant and EPLAN).
5. **Community presence:** answer real questions on Reddit (r/PLC, r/ChemicalEngineering, r/ElectricalEngineering), Eng-Tips and LinkedIn groups. AI engines heavily cite Reddit and forums.
6. **YouTube:** short demos per discipline ("Draw a P&ID in E1 in 5 minutes") with links to the site. Google and AI answers show videos.
7. **Partnerships and backlinks:** universities (via the Academy), engineering associations (ISA, IChemE, AIChE), integrators and partners linking to the site.

## 4. Paid options (by value for a B2B niche product)
Prices are rough 2026 market ranges; check current pricing.

| Priority | What | Typical cost | Why |
|---|---|---|---|
| 1 | **Google Ads, search only**: high-intent keywords ("P&ID software", "instrument index software", "AVEVA alternative") plus a brand campaign | $1.5k–5k / month to start (B2B engineering CPCs are about $3–15) | Fastest traffic on day zero while organic SEO builds (SEO takes 3–9 months). |
| 2 | **LinkedIn Ads**: targeted by job title (process, I&C, electrical engineers; EPC companies; owner-operators) | $2k–5k / month (CPC about $6–12) | Best B2B targeting for decision makers. |
| 3 | **SEO tool**: Ahrefs or Semrush | about $130–250 / month | Keyword research, backlink tracking, rank tracking, competitor gaps. |
| 4 | **Content writer with engineering knowledge** (freelance) | $300–800 per article | Comparison and explainer articles at a pace of 2–4 a month. |
| 5 | **PR / launch press release** (PR Newswire / Business Wire), plus pitches to trade media (Chemical Engineering, Control Global, Automation World, Power Engineering, ENR) | $500–1.5k per release; sponsored articles in trade media $2k–10k | Authority backlinks and mentions that AI engines learn from. |
| 6 | **Review-site boosts**: G2/Capterra sponsored placement or pay-per-click | $1k–3k / month (later, once there are reviews) | Buyers and AI engines both use these sites. |
| 7 | **Trade shows and sponsorships** (ISA Automation Week, ADIPEC, Hannover Messe), webinars with partners | $5k–50k each | Links, mentions and leads in the exact niche. |
| 8 | **AI-search visibility tracking** (e.g. Profound, Otterly, Peec AI) | about $100–500 / month | Measures whether ChatGPT, Claude, Perplexity and Gemini mention E1. Optional after launch. |
| 9 | **Retargeting** (Google Display / LinkedIn) of site visitors | $500–1k / month | Brings back trial visitors. |

Suggested starting budget at launch: about **$4–8k / month**: Google search ads, LinkedIn, an SEO tool and 2 articles. Review after 3 months, based on Search Console and ad conversions such as trial sign-ups and sales contacts.

## 5. Order of work
1. Now: Phase A items 1, 2, 4–8 and 11 (code; about 1–2 weeks of work). You: Search Console, Bing, profiles, Wikidata, Crunchbase.
2. Dec–Mar: landing pages (A3), resource hub and the first 6–8 articles (A10), YouTube demos.
3. Launch day: go live, sitemaps, IndexNow, Product Hunt, press release, start ads.
4. Monthly: Search Console review, new articles, reviews on G2 and Capterra, AI-mention check.

## 6. How to measure
- Google and Bing: indexed pages, impressions, clicks, and top 10 positions for 20 target keywords.
- AI: a monthly check of 20 prompts ("best P&ID software", "alternatives to AVEVA E3D for instrumentation", …) in ChatGPT, Claude, Perplexity, Gemini and Copilot, recording whether E1 is mentioned or cited.
- Business: trial sign-ups and sales contacts by source (UTM tags on ads and profiles).

# The website on Microsoft Azure, connected to E1

How the LANXTOR E1 website (this repository) moves from Netlify to Azure and connects to the E1 cloud (repository `Lanxtor/E1`, `deploy/azure/`). Written 2026-11-04.

## 1. The picture

```text
                GoDaddy (domain registrar only; DNS records point to Azure)
                         │
     ┌───────────────────┴─────────────────────┐
     ▼                                         ▼
 www.<domain>                              app.<domain>
 Azure Static Web Apps                     Azure Container Apps: e1-server
 this repository (HTML, CSS, JS)           (Lanxtor/E1, deploy/azure/main.bicep)
   index, solutions, …                       /auth/*   sign-in (Entra External ID)
   login.html  ── redirect ──────────────▶   /api/*    the app, and the account API
   account.html ── fetch, with cookie ───▶   PostgreSQL 16, Blob Storage, Key Vault
   download.html ── installers ──▶ Blob Storage + CDN (release files)
```

- **One account, one database.** The website keeps no user data of its own. Sign-in, licenses, seats, AI usage, storage, organizations, projects, roles and billing all live in the E1 server's PostgreSQL on Azure, exactly as the app uses them. The account page only reads them through the E1 server.
- **No password on the website.** "Log in" sends the browser to `app.<domain>/auth/login`; the E1 server signs the person in through Microsoft Entra External ID (already set up in `Lanxtor/E1`, `deploy/azure/README.md` step 3) and sends them back to `account.html`.
- **Same registrable domain.** The E1 session cookie is `SameSite=Lax` and host-only on `app.<domain>`. A browser sends it on the website's `fetch` to `app.<domain>` only because both are subdomains of the same domain. The website therefore must be on `www.<domain>` (or `<domain>`), not on a `*.azurestaticapps.net` or `*.netlify.app` address, for the account page to work.

## 2. Moving hosting from Netlify to Azure

1. **Create the Static Web App.** In the Azure portal: *Create a resource → Static Web App*, resource group `e1-prod` (the same as the E1 server) or a separate `e1-web`, plan *Free* (or *Standard* for a custom-domain SLA and more bandwidth), region West Europe, deployment source *Other*. Or with the CLI:
   ```bash
   az staticwebapp create --name e1-website --resource-group e1-prod --location westeurope --sku Free
   ```
2. **Connect this repository.** Copy the deployment token (*Manage deployment token*) into the GitHub repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. `.github/workflows/azure-static-web-apps.yml` then publishes every push to `main`, and a preview address for each pull request. `staticwebapp.config.json` sets the security headers and short URLs (`/account`, `/login`, `/download`).
3. **Check it on the Azure address** (`https://<name>.azurestaticapps.net`): every page, the clips, the download page. (The account page needs step 5 and the custom domain.)
4. **Move lanxtor.com's DNS from Netlify DNS to Azure DNS, then the website.** The domain stays registered at GoDaddy. Today GoDaddy delegates the domain to Netlify's nameservers, and Netlify DNS holds its 7 records, among them Google Workspace mail. Two phases, so that neither mail nor the site goes down:

   **Phase A: move the DNS, nothing visible changes.**
   1. In Netlify, *DNS → lanxtor.com → Download records*, and keep the file: it has the full DKIM value, which the screen cuts off.
   2. Azure portal → *Create a resource → DNS zone*, resource group `e1-prod`, name `lanxtor.com`. Note its four nameservers (`ns1-0x.azure-dns.com`, `ns2-0x.azure-dns.net`, `ns3-0x.azure-dns.org`, `ns4-0x.azure-dns.info`).
   3. In the zone, *+ Record set*, copy the mail records exactly:

      | Name | Type | TTL | Value |
      | --- | --- | --- | --- |
      | `@` | MX | 3600 | preference `1`, exchange `smtp.google.com` |
      | `@` | TXT | 3600 | `v=spf1 include:_spf.google.com ~all` |
      | `google._domainkey` | TXT | 3600 | the whole `v=DKIM1; k=rsa; p=…` value from the downloaded file |

   4. Keep the site on Netlify for now: `www` CNAME (TTL 300) → `beautiful-caramel-313fcc.netlify.app`, and `@` A (TTL 300) → `75.2.60.5` (Netlify's load balancer; these replace Netlify's own `NETLIFY` records).
   5. Check the new zone before switching (Cloud Shell): `dig +short MX lanxtor.com @ns1-0x.azure-dns.com` and the same for `TXT`, `TXT google._domainkey.lanxtor.com`, `CNAME www.lanxtor.com`.
   6. GoDaddy → *My Products → lanxtor.com → DNS → Nameservers → Change → I'll use my own nameservers*: enter the four Azure nameservers (no trailing dot). Takes minutes to a few hours.
   7. Check: `dig +short NS lanxtor.com` shows Azure's; send yourself a mail from outside and reply; the site still opens.

   **Phase B: move the website, and give E1 its address.**
   1. Static Web App → *Custom domains → + Add → Custom domain on Azure DNS* → `www.lanxtor.com`: Azure changes the `www` record to the Static Web App and issues the certificate. Then the same for `lanxtor.com` (the apex); Azure makes it an alias record to the Static Web App.
   2. `app.lanxtor.com` for the E1 server: `az containerapp hostname add --name e1-server --resource-group e1-prod --hostname app.lanxtor.com` prints a verification id; in the zone add `app` CNAME → the Container App's address (its *Overview*) and `asuid.app` TXT → that id; then `az containerapp hostname bind --name e1-server --resource-group e1-prod --hostname app.lanxtor.com --environment e1-apps --validation-method CNAME`. Add `https://app.lanxtor.com/auth/callback` as a redirect URI in the Entra app registration, and deploy with `E1_PUBLIC_URL=https://app.lanxtor.com E1_SITE_ORIGINS=https://www.lanxtor.com,https://lanxtor.com,https://preview.lanxtor.com`.
   3. After a few days of everything working: in Netlify delete the DNS zone and the site, and raise the `www` and `@` TTLs to 3600.
5. **Point the website at the server** once `https://app.lanxtor.com` answers: in `assets/js/config.js` set `apiBase` and `appUrl` to `https://app.lanxtor.com` (`staticwebapp.config.json` already allows only that address for `connect-src`).

### Coming soon, and the full site on a preview address

Until launch, lanxtor.com answers every address with `coming-soon.html`; the full site is published at the same time to a second Static Web App, **e1-website-preview** at `preview.lanxtor.com` (secret `AZURE_STATIC_WEB_APPS_PREVIEW_TOKEN`). It has its own lanxtor.com address so that sign-in works there too (the session cookie is sent only within one site). Protect it in the portal: *e1-website-preview → Configuration → Password protection → Protect both staging and production environments*. `https://preview.lanxtor.com` must be in the server's `E1_SITE_ORIGINS`; without it the server does not accept the preview's return address, so signing in from the preview ends in the E1 app instead of `account.html`, and the account page cannot load its data.

**Which version is live.** Every deployment publishes `/version.json`, `{"commit":"<short sha>","builtAt":"…"}`, on both addresses (https://preview.lanxtor.com/version.json and https://www.lanxtor.com/version.json, also while lanxtor.com shows the coming-soon page). The owner's review boards (`Lanxtor/E1`, `docs/3-implementation/manual-review.md`) count a website check only on the deployed site, against that commit; a run with `python3 -m http.server` is a preview and never counts.

To launch the full site: GitHub → *Settings → Secrets and variables → Actions → Variables → New repository variable* `SITE_MODE` = `live`, then *Actions → Website on Azure → Run workflow*. Deleting the variable (or any other value) brings the coming-soon page back.

## 3. What the E1 server provides (`Lanxtor/E1`, branch `claude/website-account-api`)

Built and tested (`server/tests/website.test.mjs`); the full reference is `docs/website/account-api.md` in that repository. Until the branch is merged and deployed, the website shows preview data (account page) and its examples (Shape E1 board). None of it changes how the app itself signs in.

Server settings: `E1_SITE_ORIGINS` (the website's origins), `E1_COMMUNITY_MODERATORS` (emails of board moderators), `E1_BILLING_PORTAL_URL` (until a billing provider exists). `deploy/azure/deploy.sh` passes the first two to the template.

### 3.1 Sign-in return to the website

Sign-in returns to an absolute address only when its origin is in `E1_SITE_ORIGINS` (for example `https://www.<domain>,https://<domain>`); anything else falls back to `/`. The website calls:

```text
GET https://app.<domain>/auth/login?return=https://www.<domain>/account.html[&signup=1]
```

`signup=1` makes the server pass `prompt=create`, so Entra External ID opens on its sign-up step.

### 3.2 CORS for the website's origins

For `/auth/me`, `/auth/switch`, `/auth/logout`, `/api/account/*` and `/api/community/*`, when `Origin` is in `E1_SITE_ORIGINS`: the `OPTIONS` preflight is answered and `Access-Control-Allow-Origin: <that origin>`, `Access-Control-Allow-Credentials: true`, `Vary: Origin` are added. No other origin and no other route.

### 3.3 The account overview

`GET /api/account/overview` for the signed-in person in the session's organization. `csrf` is the session's CSRF value: the website cannot read the `e1_csrf` cookie of another host, so it sends this value back as `X-E1-CSRF` on `POST`s. The shape (preview data with exactly this shape is at the bottom of `assets/js/e1-api.js`):

| Field | From |
| --- | --- |
| `user { id, email, name, locale, timeZone }` | `app_user` (as `/auth/me`) |
| `org { id, name }`, `orgs [{ id, name, role, license }]` | `organizationsOf()`, `role_assignment` (scope org), `license_assignment` |
| `license { type, name, assignedAt }` or `null` | `license_assignment`, `LICENSE_TYPES` |
| `roles { org [{ key, name }], permissions [key] }` | `role_assignment` + `ORG_ROLES` keys, capped by the license (`effectiveOn([])`) |
| `groups [{ id, name }]` | `user_group_member` |
| `subscription { plan, planName, status, source, periodStart, periodEnd, trialEndsAt, addOns, seats }` | `subscription`; `seats` as `seats()` returns them |
| `aiUsage { periodStart, periodEnd, unit, you { credits, tokens, requests }, organization { credits, included, personalCap, tokens, requests }, byModel [{ model, credits, tokens, requests }] }` | `ai_log` token counts now (`unit: "tokens"`, credits null); credits of design 09 *AI usage and credits* later (`unit: "credits"`) |
| `storage { you { bytes }, organization { bytes, quota }, byProject [{ project, bytes }] }` | `sum(file.size)` where `deleted_at IS NULL`, by `owner_id` and by `project_id`; `quota` from the plan (null: no limit shown) |
| `projects [{ id, name, role, roleName, lastOpenedAt, objects }]` | `visibleProjects()` and the person's project `role_assignment`; `lastOpenedAt` from `user_state` |
| `packages [{ key, name, version }]` | `package_entitlement` + `content_package` |
| `academy { discussions, courses [{ id, title, category, summary, lessons, lessonsDone, minutes, minutesWatched, status, certificate, url }], certificates [{ id, title, issuedAt, credentialId, url }] }` (optional) | the Academy: hosted video courses and the person's progress (`status`: `not_started`, `in_progress`, `completed`), course discussion posts, and earned certificates. Without it the page shows "Video courses are on their way". Not built on the server yet |
| `billing { canManage, nextInvoice, paymentMethod, invoices [{ id, date, amount, currency, status, url }] }` | the billing provider (below); `canManage` = `org.manage-billing` |
| `csrf` | the session's CSRF value |

### 3.4 Billing

`POST /api/account/billing/portal { return }` → `{ url }`: a short-lived link to the billing provider's own portal (change plan or seats, payment method, company and VAT details, invoices, cancel), only with `org.manage-billing`. The provider is not chosen yet (`Lanxtor/E1`, `docs/research/commercial-readiness.md` §5.3 suggests Stripe Billing with Stripe Tax). Its signed webhooks update the `subscription` row; that is the only way payment changes licenses. The website never handles card data.

## 4. Downloads

`assets/data/releases.json` lists the installers per platform (Windows, macOS, Linux), each with `url`, `size` and `sha256`. A file without a `url` shows *Coming soon*. The download page and the account page's Downloads section both read it and put the visitor's own system first.

When the release pipeline exists (`commercial-readiness.md` §5.4), it uploads the signed installers to a public Blob Storage container behind Azure Front Door or the CDN (for example `https://downloads.<domain>/e1/<version>/…`) and writes this file in the same step. The website needs no change for a new release.

## 5. The Shape E1 board (the user forum)

`shape-e1.html` lets people post feature requests, vote and comment. It is built into E1, not a separate forum product:

- **Same sign-in, same PostgreSQL.** Tables `community_request`, `community_vote`, `community_comment` (migration `0014_community.sql`) in the E1 server's database, served under `/api/community/*`. Reading is public; posting, voting and commenting need an E1 account. No second user list, no second password, and the board never shows anyone's email.
- **Not tenant data.** The rows are public, outside any organization's projects. Row-level security is still forced: people write only their own rows, and only moderators (`E1_COMMUNITY_MODERATORS`) change a request's status (open, planned, in progress, shipped, declined) or hide a post. Writes are rate-limited per person.
- **The page** (`assets/js/board.js`) uses the server once `apiBase` is set; before that it keeps its examples and stores a visitor's votes in their own browser, as before.

## 5a. Training and certificates

Courses, progress, assessments and public certificates are served by the E1 server under `/api/training/*` (not built yet) and shown in the Academy on `account.html#academy`, on `training.html` (the course player) and on `certificate.html` (public, verifiable). When `/api/training` answers, the Academy shows its courses and certificates; until then it shows the overview's `academy` above. The full reference is in `docs/TRAINING.md`.

## 6. Open decisions

1. The domain name (the documents say `<domain>`), and whether `www.<domain>` and `app.<domain>` are the names.
2. Billing provider (Stripe Billing + Tax, or a merchant of record).
3. Moderation of the board: who the moderators are, and whether the example requests in `board.js` should be posted on the live board at launch.
4. Storage quota per plan, and whether AI is shown as credits or tokens until credits exist.
5. Training: which courses are included in which plans, prices, and video hosting (`docs/TRAINING.md` §7).

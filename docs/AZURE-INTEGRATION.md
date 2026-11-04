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
4. **Move the domain's DNS** in GoDaddy (the domain can stay registered at GoDaddy; only the records change):
   - In the Static Web App: *Custom domains → Add*, `www.<domain>`; Azure shows a CNAME target. In GoDaddy *DNS → Manage*: replace the Netlify `CNAME www → <site>.netlify.app` with `CNAME www → <name>.azurestaticapps.net`. Azure validates it and issues the certificate itself.
   - The bare domain `<domain>`: GoDaddy cannot CNAME the apex. Add it in Azure with *TXT validation*, put the TXT record in GoDaddy, then either an `A` record to the Static Web App's IP (Standard plan) or GoDaddy's *Forwarding* of `<domain>` to `https://www.<domain>`.
   - `app.<domain>` for the E1 server: `CNAME app → <container app>.<region>.azurecontainerapps.io` plus the `asuid.app` TXT record that `az containerapp hostname add` prints (`Lanxtor/E1`, `deploy/azure/README.md` step 4). Then set `E1_PUBLIC_URL=https://app.<domain>` and add the new redirect address in the Entra app registration.
   - Lower the TTL of the records a day before, keep Netlify running until the new records have spread, then delete the Netlify site. Email (MX) records are not touched.
5. **Point the website at the server:** in `assets/js/config.js` set `apiBase` and `appUrl` to `https://app.<domain>`. When the domain is known, narrow `connect-src` in `staticwebapp.config.json` from `https:` to that address.

## 3. What the E1 server needs (changes in `Lanxtor/E1`)

The website side is done and works on preview data until these exist. None of them changes how the app itself signs in.

### 3.1 Sign-in return to the website

`server/identity/auth.mjs` `safeReturn()` accepts only paths on the server. Allow absolute addresses whose origin is in a new setting `E1_SITE_ORIGINS` (comma-separated, for example `https://www.<domain>,https://<domain>`); anything else falls back to `/` as now. The website calls:

```text
GET https://app.<domain>/auth/login?return=https://www.<domain>/account.html[&signup=1]
```

`signup=1` is optional: the server may pass `prompt=create` to Entra External ID so the user flow opens on its sign-up step.

### 3.2 CORS for the website's origins

For `/auth/me`, `/auth/switch`, `/auth/logout` and `/api/account/*`, when `Origin` is in `E1_SITE_ORIGINS`: answer the `OPTIONS` preflight and add `Access-Control-Allow-Origin: <that origin>`, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers: Content-Type, X-E1-CSRF`, `Access-Control-Allow-Methods: GET, POST`, `Vary: Origin`. No other origin and no other route.

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
| `aiUsage { periodStart, periodEnd, you { credits, requests }, organization { credits, included, personalCap }, byModel [{ model, credits, requests }] }` | `ai_log` token counts now; the usage table and credits of design 09 *AI usage and credits* later. Until credits exist, `credits` may be token counts and `included` null |
| `storage { you { bytes }, organization { bytes, quota }, byProject [{ project, bytes }] }` | `sum(file.size)` where `deleted_at IS NULL`, by `owner_id` and by `project_id`; `quota` from the plan (null: no limit shown) |
| `projects [{ id, name, role, roleName, lastOpenedAt, objects }]` | `visibleProjects()` and the person's project `role_assignment`; `lastOpenedAt` from `user_state` |
| `packages [{ key, name, version }]` | `package_entitlement` + `content_package` |
| `billing { canManage, nextInvoice, paymentMethod, invoices [{ id, date, amount, currency, status, url }] }` | the billing provider (below); `canManage` = `org.manage-billing` |
| `csrf` | the session's CSRF value |

### 3.4 Billing

`POST /api/account/billing/portal { return }` → `{ url }`: a short-lived link to the billing provider's own portal (change plan or seats, payment method, company and VAT details, invoices, cancel), only with `org.manage-billing`. The provider is not chosen yet (`Lanxtor/E1`, `docs/research/commercial-readiness.md` §5.3 suggests Stripe Billing with Stripe Tax). Its signed webhooks update the `subscription` row; that is the only way payment changes licenses. The website never handles card data.

## 4. Downloads

`assets/data/releases.json` lists the installers per platform (Windows, macOS, Linux), each with `url`, `size` and `sha256`. A file without a `url` shows *Coming soon*. The download page and the account page's Downloads section both read it and put the visitor's own system first.

When the release pipeline exists (`commercial-readiness.md` §5.4), it uploads the signed installers to a public Blob Storage container behind Azure Front Door or the CDN (for example `https://downloads.<domain>/e1/<version>/…`) and writes this file in the same step. The website needs no change for a new release.

## 5. The user forum

A forum (posts, likes, comments) needs a database and must use the same accounts. Proposal:

- **Same sign-in, same PostgreSQL.** Forum tables (`forum_topic`, `forum_post`, `forum_reaction`, `forum_report`) in the E1 server's database, served by the E1 server under `/api/community/*` with the same session, CSRF and CORS rules as §3. Reading is public (no session), writing needs sign-in. No second user list, no second password.
- **Not tenant data.** Forum rows are public, not part of any organization's projects, so they sit outside the organization row-level security, and the E1 back office moderates them. Every post is checked for size, rate-limited per person, and can be reported and hidden.
- **Pages** on the website: `community.html` (topics), `topic.html?id=…` (posts and comments), both static pages that fetch from the server, like the account page.

Alternative: a hosted forum product (for example Discourse) on its own subdomain, signing in through the same Entra tenant. Less to build and moderate, but a second system and another data processor.

## 6. Open decisions

1. The domain name (the documents say `<domain>`), and whether `www.<domain>` and `app.<domain>` are the names.
2. Billing provider (Stripe Billing + Tax, or a merchant of record).
3. Forum: built into E1 (§5) or a hosted forum product; and where the current forum lives today, so its posts and users can be moved.
4. Storage quota per plan, and whether AI is shown as credits or tokens until credits exist.

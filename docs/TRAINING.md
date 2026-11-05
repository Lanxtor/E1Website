# Training, progress and certificates

LANXTOR E1 training is hosted on our own website and E1 cloud, not on YouTube or Udemy. Written 2026-11-04.

- **Website (this repository):** the *Academy* in the account page (`account.html#academy`, with *Courses*, *User guides* and *Certificates*), the course player (`training.html?course={key}`) and the public certificate page (`certificate.html?id={id}`).
- **E1 server (`Lanxtor/E1`):** the courses, who may take them, progress, grading and certificates. It uses the same sign-in, PostgreSQL and billing as the rest of the account (`docs/AZURE-INTEGRATION.md`).
- **In the preview** (`apiBase` empty in `assets/js/config.js`, or `?demo=1`), the pages answer from the preview data in `assets/js/e1-api.js` (`DEMO_TRAINING`), with the visitor's progress kept in their own browser. Try it at `account.html?demo=1#academy-courses`. The Academy uses these routes when the server answers them; until then it shows the overview's `academy` data (`AZURE-INTEGRATION.md`), or "Video courses are on their way".

## 1. What the person sees

| Where | What |
| --- | --- |
| Account → Academy | Four tiles (courses completed, in progress, more courses, certificates); under *Courses*, *Continue where you left off* (latest course in progress, next lesson); one card per course with level, length, progress bar, status and *Start / Continue / View certificate / See the course*; under *Certificates*, the table of their certificates with *View and share* and *Add to LinkedIn*. *User guides* stay as they are. |
| `training.html` | Course outline with ✓ per lesson, the video (position saved while watching; completed at 90 % watched, at the end, or with *Mark as completed*), notes and exercise files, and the final assessment. Courses not in the plan show free preview lessons and a *Buy the course* box. When the last requirement is met, a dialog offers the certificate and *Add to LinkedIn profile*. |
| `certificate.html` | Public and needs no sign-in. A *Verified certificate* banner, the certificate itself (SVG), *Add to LinkedIn profile*, posting on LinkedIn, X and Facebook, email, copy link, the phone's own share sheet (with the image, for Instagram or WhatsApp), *Download image (PNG)* and *Print or save as PDF* (A4 landscape). |

## 2. Rules

1. **Access per organization, progress per person.** Whether a course can be taken depends on the organization the person works in: `included` (in the plan or an add-on), `owned` (bought) or `available` (can be bought). Progress and certificates belong to the person and stay with them across organizations.
2. **A certificate is issued once**, when every lesson of the course is completed *and* its assessment is passed (`passMark` %, unlimited attempts, the best score counts). The response of the action that completes the course carries the new certificate.
3. **The server grades.** Correct answers never reach the browser. `POST …/quiz` returns only per-question `correct: true|false` and the score.
4. **Video completion is reported by the browser** (≥ 90 % watched, or the button). It is a learning aid, not proof; the assessment is what certifies. The server may reject completion of a lesson that was never opened.
5. **Certificate IDs** are random and unguessable, for example `E1C-7KQ3-M9XP-2DWA` (Crockford-style alphabet, ≥ 60 bits). The ID is the only key to the public page.
6. **The public certificate shows** the holder's name, the course, its level and hours, the date, the score and the status, and nothing else: no email, organization or account ID. The name is the account's display name *at the time of issue*. A later "name on certificate" setting can change it; see open decisions.
7. **Revocation:** a certificate can be revoked (`status: "revoked"`). The page then says so, marks the image *REVOKED* and hides the share tools.

## 3. Routes on the E1 server

All routes are under `/api/training`. They use the same CORS (`E1_SITE_ORIGINS`), cookie session and `X-E1-CSRF` header on `POST`s as `/api/account/*` (`AZURE-INTEGRATION.md` §3.2). The client is `E1.training` in `assets/js/e1-api.js`. Its preview implementation returns exactly these shapes.

### `GET /api/training`: the Academy

```json
{
  "csrf": "…",
  "learner": { "name": "Alex Morgan" },
  "courses": [{
    "key": "e1-fundamentals", "title": "E1 Fundamentals", "summary": "…", "level": "Beginner",
    "access": "included | owned | available", "price": { "amount": 149, "currency": "EUR" } | null,
    "durationMinutes": 63, "lessons": 9, "certificateId": "E1C-…" | null,
    "progress": { "completedLessons": 5, "totalLessons": 9, "percent": 56,
                  "status": "not_started | in_progress | completed",
                  "nextLessonId": "f6", "nextLessonTitle": "…", "lastActivityAt": "ISO" | null }
  }],
  "certificates": [ /* the public certificate shape, below, newest first */ ]
}
```

### `GET /api/training/courses/{key}`: the course page

`{ csrf, course, certificate }`. `course` has the summary fields above plus `passMark` and `modules: [{ title, lessons: [{ id, type: "video|quiz", title, durationSeconds, preview, locked, completed, position }] }]`. `locked` is true when the person may not open the lesson (course `available` and lesson not `preview`). `certificate` is the person's certificate for this course, or `null`.

### `GET /api/training/lessons/{id}`: one lesson

- **Video:** `{ id, type: "video", title, courseKey, completed, position, durationSeconds, media: { url, type, expiresAt, captions: [{ url, lang, label }] }, notes: ["paragraph", …], resources: [{ name, url }] }`. `notes` are plain text paragraphs, never HTML. `media.url` and resource URLs are **short-lived signed URLs** (§4).
- **Assessment:** `{ id, type: "quiz", title, courseKey, completed, passMark, score, questions: [{ id, text, options: [{ id, text }] }] }`.
- `403 not_entitled` for a locked lesson, `401` when signed out (the page then offers sign-in and returns to the same lesson).

### `POST /api/training/lessons/{id}/progress` `{ position, completed }`

Saves the playback position (every ~15 s of playback, on pause and when the tab is hidden) and, once, completion. Returns `{ lesson: { id, completed, position }, course: { key, progress }, certificate: {…} | null }`.

### `POST /api/training/lessons/{id}/quiz` `{ answers: { questionId: optionId } }`

Returns `{ passed, score, passMark, results: [{ id, correct }], course: { key, progress }, certificate: {…} | null }`.

### `POST /api/training/courses/{key}/checkout` `{ return }`

Returns `{ url }`: a checkout session of the billing provider for this course (Stripe Checkout or the chosen merchant of record, `AZURE-INTEGRATION.md` §6.2), returning to `return`. Its signed webhook writes the purchase. That is the only way a course becomes `owned`. An organization can instead add training to its plan as an add-on (`included`). Empty `url`: the page says online payment is coming soon.

### `GET /api/training/certificates/{id}`: public, no session, no CSRF

```json
{ "id": "E1C-7KQ3-M9XP-2DWA", "status": "valid | revoked", "holderName": "Alex Morgan",
  "courseKey": "process-design", "courseTitle": "Process design in E1", "level": "Intermediate",
  "hours": 1, "issuedAt": "ISO", "score": 100, "issuer": "LANXTOR" }
```

`404` when unknown. It must answer CORS for any origin with no credentials (`Access-Control-Allow-Origin: *`), be rate-limited per IP, and be cacheable for a few minutes.

## 4. Tables (a new migration, e.g. `0015_training.sql`)

| Table | Columns (main) |
| --- | --- |
| `training_course` | `key` PK, `title`, `summary`, `level`, `pass_mark`, `price_amount`, `price_currency`, `published_at`, `sort` |
| `training_module` | `id`, `course_key`, `title`, `sort` |
| `training_lesson` | `id`, `module_id`, `type` (`video`/`quiz`), `title`, `duration_seconds`, `preview`, `media_key` (path in Blob Storage or the video service's asset ID), `notes` (text[]), `sort` |
| `training_question` | `id`, `lesson_id`, `text`, `options` (jsonb `[{id,text}]`), `answer` (option id; **never** selected into a client response), `sort` |
| `training_entitlement` | `course_key`, `org_id` **or** `user_id`, `source` (`plan`/`add_on`/`purchase`), `granted_at`, `expires_at` |
| `training_progress` | `user_id`, `lesson_id`, `position`, `completed_at`, `best_score`, `attempts`, `updated_at`; PK (`user_id`, `lesson_id`) |
| `training_certificate` | `id` (the public ID) PK, `user_id`, `course_key`, `holder_name`, `score`, `issued_at`, `revoked_at`, `revoked_reason`; unique (`user_id`, `course_key`) |

Row-level security as elsewhere: a person reads and writes only their own `training_progress`. Certificates are inserted only by the server. The public route reads one certificate by ID through a narrow view without `user_id`.

## 5. Videos

Azure Media Services was retired on 30 June 2024, so Azure no longer has a managed video streaming service. Two options:

- **Azure only (simplest, cheapest):** encode each lesson to MP4 (H.264/AAC, 1080p and 720p) or HLS. Store the files in a **private** Blob container and serve them through Front Door / the CDN with **short-lived SAS URLs** (for example 2 hours) issued by `GET /api/training/lessons/{id}` only to entitled people. There is no DRM, and screen recording is always possible anyway.
- **A video service for the video only (Mux, Cloudflare Stream or Bunny Stream):** adaptive streaming, thumbnails and analytics, with signed playback tokens. Everything else stays on Azure.

Either way the website needs only the URL. **The CSP must allow the video's host:** in `staticwebapp.config.json` add it to `media-src` (for example `media-src 'self' https://media.<domain>`). An HLS player script would also need `script-src`. Captions are WebVTT files (`media.captions`), also signed.

## 6. Sharing, LinkedIn and link previews

- **Add to LinkedIn profile** opens `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=…&organizationName=LANXTOR&issueYear=…&issueMonth=…&certUrl=…&certId=…` (`E1.training.shareLinks`). With `linkedinOrgId` set in `assets/js/config.js`, it sends `organizationId` instead, and LinkedIn shows the LANXTOR company page and logo next to the certificate.
- **Certificate links** are built on `siteUrl` from `config.js` (`https://www.<domain>/certificate.html?id=…`). Set `siteUrl` when the domain is known, so the links do not depend on which address the page was opened from.
- **Link previews:** LinkedIn, X and Facebook do not run JavaScript, so they show the page's static tags: the generic image `assets/img/certificate-share.png` (1200 × 630). Two follow-ups:
  1. When the domain is known, make `og:image` in `certificate.html` an absolute URL. Some networks ignore relative ones.
  2. Optional, for a preview with the holder's name and course: the E1 server serves `GET /c/{id}`, a tiny HTML page with per-certificate `og:title`, `og:description` and `og:image` (a PNG it renders, or `/api/training/certificates/{id}.png`) that redirects people to `certificate.html?id={id}`. The share links would then point at `/c/{id}`.
- The PNG download and the printed PDF are made in the browser from the same SVG, so they always match the page.

## 7. Open decisions

1. **Included or sold:** which courses come with which plans, which are paid add-ons, and their prices. The preview has three included courses and one at €149.
2. **The real course catalog,** recordings and assessment questions. The preview questions are examples.
3. **Name on certificate:** allow people to set a different name (legal name) before issue, or only use the account name.
4. **Video hosting:** Azure Blob + CDN, or a video service (§5).
5. **Expiry:** whether certificates expire with major E1 versions (for example "valid for E1 2026"), and whether a refresher course renews them.
6. **Team view:** a later page for organization administrators showing their people's progress, which customers often ask for.

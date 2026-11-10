# Security and compliance plan

Agreed by the owner on 2026-11-10. The status box on `cloud-specifications.html` ("LANXTOR and E1")
shows the public status; update it (and its translations) when a step is reached.

| When | What | Who | Website status today |
|---|---|---|---|
| Now to Dec 2026 | Data processing agreement (DPA) from a lawyer's GDPR template; list of sub-processors (Microsoft: Azure, Entra, Azure OpenAI; Stripe; the email provider; confirm the list) | Owner + lawyer | In preparation |
| Now to Dec 2026 | Ask the lawyer whether an EU representative is needed (GDPR Art. 27) | Owner + lawyer | — |
| Now | EU Cyber Resilience Act: process to report actively exploited vulnerabilities and serious incidents to ENISA within 24 hours (applies from 2026-09-11); public vulnerability disclosure (done: `security.html`, `/.well-known/security.txt`) | Owner; website done | In preparation |
| Jan–Mar 2027 | Choose a compliance platform (e.g. Vanta, Drata, Secureframe); start SOC 2 and ISO/IEC 27001 together | Owner | Planned |
| ~Feb 2027 | Independent penetration test (app, server, website); fix the findings before launch; then yearly | Security firm | Planned |
| Launch (Apr–May 2027) | SOC 2 Type I report; DPA ready to send to customers | Auditor, owner | Planned |
| H2 2027 | SOC 2 Type II (after 3–12 months of evidence); ISO/IEC 27001 certificate | Auditor, certification body | Planned |
| By 2027-12-11 | Cyber Resilience Act in full for the desktop and iPad apps: self-assessment (default category), technical documentation, SBOM, stated support period for security updates, CE marking | Owner + engineering | In preparation |
| 2028 | IEC 62443-4-1 (secure development of industrial software), once OT customers ask; a gap assessment first | Certification body | Planned |

## On the website

- `security.html` (in all languages, footer link "Security"): how to report a vulnerability, what is
  covered, what we do (acknowledge within 2 working days, coordinated disclosure, at the latest 90
  days), and testing in good faith.
- `/.well-known/security.txt` (RFC 9116); `/security.txt` redirects to it. It stays reachable while
  the public site shows the coming-soon page (`.github/workflows/azure-static-web-apps.yml`).
- **Renew `security.txt` before its `Expires` date (2027-11-10)**: set a new date at most a year ahead.
- Reports go to support@lanxtor.com with the subject "Security vulnerability".

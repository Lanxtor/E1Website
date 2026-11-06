# Translating the website

1. Change the English pages in the site root as usual.
2. Run `python3 tools/i18n/build.py`. It writes `tools/i18n/strings.json` with every English text.
3. Add the translations of new or changed texts to `tools/i18n/<lang>.json` (de, fr, es, no):
   `{"pages": {"<English text exactly as in strings.json>": "<translation>"}, "js": {...}}`.
4. Run `python3 tools/i18n/build.py --check` until nothing is missing, and commit the generated
   `de/`, `fr/`, `es/`, `no/` folders and `assets/js/i18n-dict.js`.

Rules for translations
- Keep every HTML tag and attribute exactly as in the English text (`<a href="…" class="…">`, `<br>`,
  `<span data-usd="345">$345</span>`, `<b>`, entities such as `&amp;` and `&#8209;`). Translate only the words.
- Keep `{placeholders}` as they are.
- Do not translate: LANXTOR, E1, E1 Cloud, E1 Academy, Microsoft Azure, Amazon Web Services, AWS, Google Cloud,
  PostgreSQL, Windows, macOS, Linux, iPad, CFIHOS, FEED, P&ID (P&amp;ID), PFD, DWG, PDF, Excel, SHA-256.
- Tone: short, clear, professional B2B software for engineers. German uses "Sie", French "vous",
  Spanish "tú", Norwegian bokmål "du".
- Use the established engineering terms of each language (for example German "Rohrleitungs- und
  Instrumentenfließschema" is shortened to "R&I-Fließschema", keep "P&ID" where it is used as a name).

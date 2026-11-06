# Website API: Alex, the website assistant

`POST /api/chat` answers visitors' questions about LANXTOR and E1 (see `src/functions/chat.js`).
It runs as an Azure Static Web Apps managed function, deployed with the site by
`.github/workflows/azure-static-web-apps.yml` (`api_location: api`).

## Setup (once per Static Web App)

In the Azure Portal, open the Static Web App (production, and `e1-website-preview`),
go to **Settings > Environment variables** and add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | An API key from https://console.anthropic.com (Settings > API keys) |
| `CHAT_MODEL` | Optional. Default `claude-opus-5-5`. |

Without the key, the chat answers "not connected yet" and points to the sales contact.

## What Alex knows

`knowledge.txt` is the text of the English public pages, written by
`tools/chat/build_knowledge.py`. The deploy workflow regenerates it on every
deployment, so Alex always answers from what the live pages say.

## Limits

30 questions per visitor per 10 minutes (per server instance), 2,000 characters
per message, the last 16 messages of a conversation. The site text is sent with
prompt caching, so repeated questions are billed mostly at the cached rate.

# Website API: Alex, the website assistant

`POST /api/chat` answers visitors' questions about LANXTOR and E1 (see `src/functions/chat.js`).
It runs as an Azure Static Web Apps managed function, deployed with the site by
`.github/workflows/azure-static-web-apps.yml` (`api_location: api`).

## Setup (once per Static Web App)

In the Azure Portal, open the Static Web App (production, and `e1-website-preview`),
go to **Settings > Environment variables** and add:

| Name | Value |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | The Azure OpenAI resource the E1 app uses, e.g. `https://<resource>.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | That resource's key (Azure OpenAI resource > Resource Management > Keys and Endpoint) |
| `AZURE_OPENAI_DEPLOYMENT` | Optional. The GPT-4.1 deployment name, default `gpt-4.1` |
| `AZURE_OPENAI_API_VERSION` | Optional. Default `2024-10-21` |

The model is the same Azure OpenAI GPT-4.1 deployment the E1 app uses. Without
endpoint and key, the chat answers "not connected yet" and points to the sales contact.

## What Alex knows

`knowledge.txt` is the text of the English public pages, written by
`tools/chat/build_knowledge.py`. The deploy workflow regenerates it on every
deployment, so Alex always answers from what the live pages say.

## Limits

30 questions per visitor per 10 minutes (per server instance), 2,000 characters
per message, the last 16 messages of a conversation. The site text comes first in
every request, so Azure OpenAI's automatic prompt caching can reuse it.

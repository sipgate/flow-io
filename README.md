# Flow-IO

**Build production-ready AI phone assistants in minutes — not months.**

Flow-IO connects your sipgate phone numbers to AI agents with custom prompts, knowledge bases, multi-step call flows, and full analytics. Open-source, self-hostable, European infrastructure.

![Flow-IO Scenario Builder](docs/images/screenshot.png)

**Self-hosted (everything included):**
```bash
git clone https://github.com/sipgate/flow-io.git
cp .env.docker.example .env.docker  # fill in API keys
docker compose --env-file .env.docker up -d
```

**App only (requires external Supabase):**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/LcIT76)

---

## Why Flow-IO

Most voice AI platforms are black boxes: fixed prompts, opaque pricing, US-only infrastructure, no self-hosting. Flow-IO gives you full control:

- **Your prompts** — no guardrails, no vendor-imposed behavior
- **Your LLM** — OpenAI, Google Gemini, or Mistral; swap at any time
- **Your data** — Postgres + pgvector, self-hosted or Supabase Cloud
- **European infrastructure** — sipgate backbone, GDPR-compliant by default
- **MIT license** — fork it, white-label it, build on it

---

## Features

### AI Assistants
- Custom system prompts with full LLM control
- **LLM providers**: OpenAI (GPT-5, GPT-4.1, GPT-4o), Google Gemini (2.5 Flash, 2.5 Pro), Mistral (Small, Medium, Large)
- **Text-to-speech**: ElevenLabs and Azure voices, phoneme dictionaries for pronunciation tuning
- Barge-in control: let callers interrupt the assistant mid-sentence
- Hold message pattern: assistant announces actions before executing them

### Knowledge Base & RAG
- Upload documents (PDF, text) — chunked, embedded, stored in pgvector
- Semantic search injected into context automatically
- Knowledge base as an LLM-callable tool (assistant searches on demand)
- Multiple assistants can share one knowledge base

### LLM-Callable Tools
- **MCP servers** — connect any Model Context Protocol server (SSE or HTTP)
- **HTTP Webhook Tools** — define custom HTTP endpoints the assistant calls as tools during a conversation; configure per-org, assign to assistants

### Multi-Agent Scenarios
Visual drag-and-drop call flow builder with node types:
- Entry agent, agent handoff (seamless or with announcement)
- DTMF collect (gather digits, map to variable)
- DTMF menu (digit-based routing with retries)
- Phone transfer

### Variables & Data Extraction
- Define typed variables (string, number, boolean, date, phone, email)
- Collected via DTMF, real-time LLM extraction, or post-call fallback
- Validation via regex or external webhook
- Mandatory collection and caller confirmation per variable

### Post-Call Webhooks
- **Post-call webhook** fires after every completed call — regardless of whether variables were configured
- Payload: session data, extracted variables (empty array if none), optional full transcript
- HTTP Webhook Tools for real-time data fetching during calls

### Context Webhooks
- Inject external data at call start via a configurable endpoint
- Returned JSON available in prompts as `{{context.key}}`

### Analytics & Quality
- Call volume, duration, success rate by day/hour/assistant
- CSAT scoring (1–5) evaluated post-call by LLM
- Configurable call criteria (pass/fail checkpoints per assistant)
- Period-over-period comparison, drill-down per call
- PDF report export

### Infrastructure
- **Multi-tenancy** with organizations, roles (owner/admin/member), Row Level Security
- **sipgate OAuth** — sign in with sipgate, phone numbers imported automatically
- **WebSocket + HTTP** dual-mode webhook handling
- **Chat Simulator** — test assistants in-browser without a real phone call
- **i18n** — English, German, Spanish UI

---

## Quick Start — Self-Hosting (Docker)

```bash
# 1. Clone
git clone https://github.com/sipgate/flow-io.git
cd flow-io

# 2. Configure
cp .env.docker.example .env.docker
# Edit .env.docker — fill in your API keys (see Prerequisites below)

# 3. Start
docker compose --env-file .env.docker up -d
```

| Service | URL |
|---------|-----|
| Flow-IO app | http://localhost:3000 |
| Supabase Studio | http://localhost:8000 (login: DASHBOARD_USERNAME/PASSWORD) |
| Email test inbox | http://localhost:54324 |

Everything runs in one command: Postgres, Auth, Storage, Realtime, the app, and automatic database migrations.

---

## Prerequisites

> **Note:** STT and TTS during live calls are handled entirely by sipgate's infrastructure — you don't need your own speech API keys for calls to work. The keys below are only needed for dashboard features like voice previews, LLM-powered prompt optimization, CSAT scoring, and knowledge base embeddings.

| Service | Purpose | Required for |
|---------|---------|------|
| **sipgate** | Login + phone numbers | Everything — create an [OAuth app](https://console.sipgate.com/third-party-clients) |
| **OpenAI** | LLM during calls + embeddings | Calls (if using GPT models), KB search, CSAT scoring |
| **ElevenLabs** | Voice preview in dashboard | Optional — only needed for previewing voices before assigning them |

**sipgate OAuth app setup:**
1. Go to [console.sipgate.com/third-party-clients](https://console.sipgate.com/third-party-clients)
2. Create a new app, set redirect URI to `https://your-domain.com/api/auth/sipgate/callback`
3. Copy Client ID and Client Secret into `.env.docker` (or `.env.local` for dev)

Google Gemini and Mistral are alternatives to OpenAI for the LLM during calls. Azure TTS is an alternative to ElevenLabs for voice previews. All are optional — configure per assistant.

---

## Deployment

Flow-IO needs a **Next.js host** and a **Supabase instance**. The Docker setup bundles everything. For PaaS platforms, use [Supabase Cloud](https://supabase.com) (free tier available).

| Platform | Supabase needed? | Notes |
|----------|-----------------|-------|
| **Docker** (self-hosted) | bundled | Full control, runs anywhere |
| **Coolify** | bundled | Git-connected, deploys full `docker-compose.yml` |
| **Railway** (UI import) | bundled | Drag `docker-compose.yml` onto Railway canvas |
| **Railway** (button) | Supabase Cloud | App only, add env vars |
| **Render / Fly.io** | Supabase Cloud | Deploy as Docker container |

### Docker (everything included)

Follow [Quick Start](#quick-start--self-hosting-docker) above.

### Coolify

1. Create a new **Resource → Docker Compose**
2. Connect your GitHub repo
3. Set Docker Compose file to `docker-compose.yml`
4. Add env vars from `.env.docker.example`
5. Deploy — Coolify handles HTTPS, restarts, and redeploys on push

### Railway UI import

1. Create a new Railway project
2. Drag `docker-compose.yml` onto the canvas
3. Add env vars from `.env.docker.example`
4. Deploy

### PaaS + Supabase Cloud

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run migrations:**
   ```bash
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```
3. **Deploy the app** and set env vars from `.env.example`

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SIPGATE_OAUTH_CLIENT_ID` | sipgate OAuth client ID |
| `SIPGATE_OAUTH_CLIENT_SECRET` | sipgate OAuth client secret |
| `SIPGATE_WEBHOOK_SECRET` | Shared secret for webhook HMAC-SHA256 verification |
| `SIPGATE_WEBHOOK_TOKEN` | Token for WebSocket authentication |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL for OAuth redirects |
| `OPENAI_API_KEY` | OpenAI API key — LLM during calls, KB embeddings, CSAT scoring |
| `ELEVENLABS_API_KEY` | ElevenLabs API key — voice preview in dashboard only (optional) |

See [`.env.example`](.env.example) for the full list including optional variables.

---

## Local Development

```bash
npm install
cp .env.example .env.local  # fill in API keys

npx supabase start           # start local Supabase
npx supabase db push         # apply migrations

npm run dev                  # start dev server → http://localhost:3000
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│             Next.js App                 │
│  (Frontend + API routes + Server Actions│
└──────────┬──────────────┬──────────────-┘
           │              │
   ┌───────▼──────┐  ┌────▼────────────┐
   │   Supabase   │  │    sipgate      │
   │              │  │                 │
   │ - Auth       │  │ - OAuth login   │
   │ - PostgreSQL │  │ - AI Flow SDK   │
   │ - pgvector   │  │ - WebSocket     │
   │ - Storage    │  │ - Phone numbers │
   │ - Realtime   │  └─────────────────┘
   └───────┬──────┘
           │
   ┌───────▼──────────────────┐
   │      LLM Providers       │
   │  OpenAI · Gemini         │
   │  Mistral · ElevenLabs    │
   └──────────────────────────┘
```

**Call flow:**
1. Incoming call hits sipgate → WebSocket event to Flow-IO
2. `session_start` → context webhook fetches external data, variables injected into prompt
3. `user_speak` → LLM generates response, optionally calls tools (KB, MCP, HTTP webhooks)
4. `session_end` → variables extracted, post-call webhook fired, CSAT + criteria evaluated

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, standalone output) |
| Language | TypeScript (strict) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Database | [Supabase](https://supabase.com/) PostgreSQL + pgvector |
| Auth | Supabase Auth + sipgate OAuth2 |
| Telephony | [sipgate AI Flow SDK](https://sipgate.github.io/sipgate-ai-flow-api/) |
| LLM | OpenAI · Google Gemini · Mistral |
| TTS | ElevenLabs · Azure |
| Testing | [Vitest](https://vitest.dev/) |

---

## Contributing

1. Fork the repo and create a branch
2. Follow the code style (TypeScript strict, no `any`)
3. Write tests for new features (`npm test` must pass)
4. Run `npm run type-check` and `npm run build` before opening a PR
5. Use [conventional commit messages](https://www.conventionalcommits.org/)

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Links

- [sipgate AI Flow API docs](https://sipgate.github.io/sipgate-ai-flow-api/)
- [Supabase docs](https://supabase.com/docs)
- [Issues](https://github.com/sipgate/flow-io/issues)

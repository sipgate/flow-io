# Flow-IO - Project Guidelines for Claude

## Overview
Flow-IO is an AI voice assistant platform built with Next.js 15, Supabase, and sipgate AI Flow SDK. It provides full multi-tenancy, knowledge base integration, and real-time analytics.

## Core Development Principles

### 1. Always Use Context7 for Documentation
**CRITICAL**: When working with ANY library or framework, ALWAYS use context7 to fetch the most recent documentation before implementing features or fixing issues.

Examples:
- `@context7 fetch Next.js server components documentation`
- `@context7 fetch Supabase authentication docs`
- `@context7 fetch sipgate AI Flow SDK`

This ensures you're using the latest APIs and best practices.

### 2. Testing Requirements

#### Unit Tests
- Write unit tests for ALL utility functions, hooks, and business logic
- Test file location: `tests/unit/` matching the source file structure
- Use Vitest for unit testing
- Run tests before committing: `npm test`

#### Integration Tests
- Write integration tests for API endpoints
- **CRITICAL**: When a bug, error, or inconsistency is discovered, IMMEDIATELY write an integration test (or unit test) to reproduce it BEFORE fixing
- This ensures the bug never happens again
- Test file location: `tests/integration/`

#### Pre-Commit Checklist
Before EVERY commit:
1. Run `npm test` - All tests must pass
2. Run `npm run build` - Build must succeed with no TypeScript errors
3. Run `npm run type-check` - Type checking must pass
4. Only then commit with a descriptive message

### 3. Technology Stack

#### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**:
  - TanStack Query for server state
  - Zustand for global client state (if needed)
- **Forms**: React Hook Form + Zod validation

#### Backend
- **Database**: Supabase PostgreSQL with pgvector extension
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime subscriptions
- **API**: PostgREST (auto-generated) + Next.js API routes

#### Telephony & AI
- **Voice**: sipgate AI Flow SDK
- **LLM**: OpenAI GPT-4 and Google Gemini (abstracted)
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector Search**: pgvector with similarity search

### 4. Architecture Patterns

#### Multi-Tenancy
- All data is scoped to organizations
- Row Level Security (RLS) policies enforce data isolation
- Every query must include organization context
- Middleware enforces organization membership

#### LLM Provider Abstraction
```typescript
// Always use the abstracted provider interface
import { createLLMProvider } from '@/lib/llm/provider'

const llm = createLLMProvider({
  provider: 'openai', // or 'gemini'
  apiKey: process.env.OPENAI_API_KEY
})

const response = await llm.generateCompletion({
  messages: [...],
  temperature: 0.7
})
```

#### sipgate Integration Patterns
- Event-driven architecture
- Handle events: SessionStart, UserSpeak, AssistantSpeak, SessionEnd, UserBargeIn
- Return actions: Speak, Audio, Transfer, Hangup
- Always store transcripts and session state
- Use WebSocket for real-time, HTTP webhooks as fallback

#### sipgate v3 API
- Swagger: https://api.sipgate.com/v3/swagger.json
- `/v3/phone-numbers` returns a **direct array**, not `{ numbers: [] }`
- Blocks (`GERMAN_LANDLINE_BLOCK`) sind 10er **und** 100er — Größe per `numbers[].length > 10` bestimmen, nicht per `type`
- Nested `numbers[]` enthält individuelle Block-Mitglieder mit eigenem Routing
- `targetType === 'AIFLOW'` = sipgate Flow-geroutet
- OAuth-Scope `all` ist Pflicht für v3-Zugriff (nicht nur `numbers:read`)

#### Knowledge Base & RAG
- Document → Chunking (1000 chars, 200 overlap) → Embeddings → pgvector
- Semantic search using pgvector similarity functions
- Context injection into LLM prompts
- Background processing with BullMQ (optional for MVP)

### 5. File Organization

```
lib/
  supabase/       - Supabase client setup (client.ts, server.ts)
  sipgate/        - sipgate AI Flow integration
  llm/            - LLM provider abstraction
  embeddings/     - Vector generation and search
  flow-engine/    - Flow execution engine
  webhooks/       - Webhook dispatch and retry
  utils/          - Utility functions

components/
  ui/             - shadcn/ui base components
  flows/          - Flow builder components
  assistants/     - Assistant management UI
  knowledge/      - Knowledge base UI
  calls/          - Call management UI
  analytics/      - Analytics dashboards
  layouts/        - Layout components

app/
  (auth)/         - Authentication pages
  (dashboard)/    - Main application (org-scoped)
  api/            - API routes

hooks/            - Custom React hooks
types/            - TypeScript type definitions
tests/            - Test files mirroring src structure
```

### 6. Supabase Patterns

#### Client Setup
- Use `@/lib/supabase/client.ts` for browser-side operations
- Use `@/lib/supabase/server.ts` for server-side operations
- Always create new client instances in Server Components

#### RLS Policies
- Every table must have RLS enabled
- Policies must check organization membership
- Use `auth.uid()` to get current user ID
- Service role key bypasses RLS (use carefully)

#### Migrations
- All schema changes via migrations in `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Test migrations locally before deploying
- Include RLS policies in migrations

### 7. Code Quality Standards

#### TypeScript
- Use strict mode
- No `any` types (use `unknown` if truly dynamic)
- Define interfaces for all data structures
- Use Zod for runtime validation

#### Error Handling
- Always handle errors gracefully
- Log errors with context
- Return user-friendly error messages
- Use try-catch in async functions

#### Performance
- Use React Server Components by default
- Client Components only when needed (interactivity, hooks)
- Implement proper loading states
- Use Suspense boundaries
- Optimize images with next/image

### 8. Naming Conventions

- **Files**: kebab-case (`flow-builder.tsx`)
- **Components**: PascalCase (`FlowBuilder`)
- **Functions**: camelCase (`createAssistant`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Types/Interfaces**: PascalCase (`Assistant`, `CallSession`)

### 9. Git Workflow

#### Commit Messages
```
<type>: <description>

Examples:
feat: add knowledge base document upload
fix: resolve RLS policy issue for assistants table
test: add integration tests for call session creation
docs: update README with deployment instructions
```

#### Before Committing
1. Run all tests
2. Run build
3. Review changes
4. Write descriptive commit message
5. Update CLAUDE.md if patterns change
6. Update README.md if setup changes

### 10. Documentation Updates

#### When to Update CLAUDE.md
- New architectural patterns introduced
- New libraries added
- Testing strategies change
- Development workflow changes
- Common pitfalls discovered

#### When to Update README.md
- Setup instructions change
- New environment variables added
- Deployment process changes
- New features completed
- API endpoints added

### 11. UI & UX Patterns

Siehe **[docs/ui-patterns.md](docs/ui-patterns.md)** für alle Details.

Kurzübersicht:
- Sidebar: verwandte Bereiche zusammenfassen, Unterteilung via Tabs
- Seitenstruktur: `h1 mb-6` → `Tabs space-y-6` → Komponente mit eigenem `h2`-Header
- Item-Cards: Status-Badges oben rechts, Action-Buttons unten in CardContent
- Tabellenbasierte Listen: Empty State außerhalb der Tabelle, Tabelle in `<Card>`
- Buttons: `default` für primäre Aktionen, `outline sm` für sekundäre, `ghost icon` für Tabellenzeilen
- Dialoge: immer `sm:max-w-*` Präfix; einfache Formulare → Dialog, komplexe → eigene Seite
- Labels: „New [Entity]" – nie „Add" oder „Create"
- Datenfetch: Server Component fetcht alles, Client Component nutzt `router.refresh()` nach Mutation
- i18n: keine hardcodierten Strings, Status-Badges großgeschrieben, ICU-Pluralformen

## Common Patterns

### Database Queries with Organization Scope
```typescript
// Server Component
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data } = await supabase
  .from('assistants')
  .select('*')
  .eq('organization_id', organizationId)
```

### API Route with Auth
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... rest of logic
}
```

### Flow Execution
```typescript
import { FlowExecutor } from '@/lib/flow-engine/executor'

const executor = new FlowExecutor(flow, session)
const actions = await executor.processEvent(sipgateEvent)
```

### React 19 – Async Action Guards
React 19 kann async Transition-Handler bei Re-Renders erneut aufrufen. Ohne `useRef`-Guard entstehen Endlosschleifen, wenn Server Actions aus `useEffect`-ähnlichen Kontexten oder Popover-`onOpenChange`-Callbacks aufgerufen werden:

```typescript
const fetchingRef = useRef(false)

async function fetchData() {
  if (fetchingRef.current) return
  fetchingRef.current = true
  try {
    await someServerAction()
  } finally {
    fetchingRef.current = false
  }
}
```

## References
- sipgate AI Flow: https://sipgate.github.io/sipgate-ai-flow-api/
- sipgate v3 API Swagger: https://api.sipgate.com/v3/swagger.json
- Supabase Docs: Use context7
- Next.js Docs: Use context7

## Quick Commands
```bash
# Development
npm run dev              # Start dev server with turbopack
npm run build            # Build for production
npm run type-check       # Check TypeScript types
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode

# Supabase
use the supabase tool for all supabase interactions
```

## Project Status
- **Current Phase**: Phase 1 - Foundation
- **Next Steps**: Create database schema and Supabase client setup

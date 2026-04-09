# Contributing to Flow-IO

Thank you for your interest in contributing to Flow-IO! This document explains how to get started.

## Development Setup

1. **Fork** the repository and clone it locally
2. Copy `.env.example` to `.env.local` and fill in the required values
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

For a full local environment including Supabase, use Docker:

```bash
cp .env.docker.example .env.docker
docker compose up
```

## Before Submitting a PR

Run the full check suite — all must pass:

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run build        # Production build
```

## Code Style

- **TypeScript strict mode** — no `any` types
- **Naming**: files in `kebab-case`, components in `PascalCase`, functions in `camelCase`
- **No hardcoded strings** in JSX — use the i18n system (`next-intl`)
- Follow the UI patterns documented in [docs/ui-patterns.md](docs/ui-patterns.md)

## Testing

- Write unit tests for all utility functions and business logic in `tests/unit/`
- When you discover a bug, write a test that reproduces it **before** fixing it
- Integration tests go in `tests/integration/`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add knowledge base document upload
fix: resolve RLS policy issue for assistants table
test: add integration tests for call session creation
docs: update README with deployment instructions
```

## Pull Request Process

1. Open a PR against `main`
2. Fill in the PR description with what changed and why
3. All CI checks must pass
4. At least one maintainer review is required before merging

## Reporting Issues

Use [GitHub Issues](https://github.com/BlackMac/flow-io/issues). Please include:
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node version, browser if relevant)

For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead.

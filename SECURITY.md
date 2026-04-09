# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

Instead, open a [GitHub Security Advisory](https://github.com/BlackMac/flow-io/security/advisories/new) so the report remains private until a fix is ready.

Include as much of the following as possible:

- Type of issue (e.g. SQL injection, XSS, authentication bypass)
- File paths and line numbers relevant to the issue
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment

We will acknowledge receipt within 48 hours and aim to release a fix within 14 days for critical issues.

## Deployment Security Notes

When self-hosting Flow-IO:

- **Rotate all secrets** before going to production — never reuse example values
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — keep it server-side only, never expose it to the browser
- `SIPGATE_WEBHOOK_SECRET` should be a randomly generated string (e.g. `openssl rand -hex 32`)
- Enable RLS on all Supabase tables — Flow-IO's migrations do this, but verify after any manual schema changes
- Keep your Supabase instance and Next.js dependencies updated

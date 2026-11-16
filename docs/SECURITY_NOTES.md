# BusinessVault — Security Notes (POC)

This POC is designed **secure by default** where it handles documents, but it
is **not** a production-certified system. This page lists what is implemented
and what remains open.

## 1. Implemented Controls

### Authentication & session
- Supabase Auth (email + password) with HTTP-only cookie sessions via
  `@supabase/ssr`; tokens never stored in `localStorage`.
- Protected routes enforced **server-side** (API routes reject unauthenticated
  requests with 401; the dashboard fetches data only through these routes).
- Dev-fallback auth is explicitly labelled insecure (UI banner + docs) and can
  be disabled by setting `AUTH_MODE=supabase`.

### Authorization (server-side, every request)
- Every document read, preview, download, ZIP export and delete verifies the
  document belongs to a business **owned by the caller** before acting.
- Supabase RLS policies provide a second enforcement layer at the database.
- Supabase Storage policies restrict object access by business-id path prefix.
- Frontend hiding is never the security boundary.

### File handling
- Private storage bucket only; **no permanent public URLs**. Preview/download
  use short-lived signed URLs (Supabase mode) or authorized streaming.
- Server-side validation on every upload: extension allow-list
  (pdf/jpg/jpeg/png/txt), MIME allow-list, **magic-byte sniffing** (content must
  match the claimed type), max 10 MB per file, max 20 files per request,
  non-empty files, validated metadata (Zod).
- Filenames are sanitized for storage/ZIP: path traversal (`../`), control
  characters, reserved names and unsafe characters are stripped; duplicates
  get unique suffixes.
- Storage object names are random UUIDs — the original filename never becomes
  a storage path, and user input never influences directory structure beyond
  server-generated `businessId/YYYY/MM/`.

### Export
- ZIP export authorizes the caller, includes only the selected month, and
  **aborts with a clear error** if any storage object is missing — incomplete
  archives are never produced silently.
- Archives contain only the caller's own documents.

### Secrets & configuration
- Secrets come from environment variables; `.env*` is git-ignored and
  `.env.example` contains placeholders only.
- The service-role key (only needed by the optional sample-upload script) is
  **never** shipped to the client; `NEXT_PUBLIC_` is used only for the Supabase
  URL and anon key.
- No sensitive file contents or tokens are logged; errors returned to clients
  are safe messages without stack traces or storage paths.

## 2. Explicit Non-Claims

- No security certification (SOC2, ISO, etc.) is claimed.
- No penetration test has been performed.
- Password strength rules are minimal (length ≥ 8) — production would add
  breach-database checks, MFA, rate limiting and lockout.
- Email verification depends on the Supabase project configuration.

## 3. Known Risks & Limitations (documented, accepted for POC)

| Risk | Status |
| --- | --- |
| Dev-fallback auth (HMAC cookie, any password) is insecure | Accepted — dev only, clearly labelled, disable with `AUTH_MODE=supabase` |
| Dev-fallback file store is a plain local directory | Accepted — dev only |
| No rate limiting / brute-force protection | Not implemented (production: WAF / edge middleware) |
| No antivirus / content scanning of uploads | Not implemented (production: scan pipeline) |
| Signed URL TTL (15 min) is not revocable mid-flight | Accepted |
| No audit log of document access | Not implemented (future) |
| Single-business-per-user assumption in provisioning | Accepted for POC |
| ZIP built in memory (≤ month of documents, ≤ 10 MB each) | Accepted for POC; stream for scale |
| Playwright E2E suite not executed here (no browser download in sandbox) | Blocked by environment |

## 4. Reporting

Security issues found in this POC should be reported to the repository owner
before any public disclosure.

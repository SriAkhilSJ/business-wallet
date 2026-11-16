# BusinessVault — Technical Design (POC)

## 1. Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js route handlers (single application) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (production mode) |
| Storage | Supabase Storage, private bucket `business-documents` |
| Validation | Zod (server-side authoritative) |
| ZIP | JSZip (server-side generation) |
| Unit tests | Vitest |
| E2E | Playwright — **not executed in this environment** (browser binaries cannot be downloaded; see README) |

No FastAPI or other backend framework. One Next.js application.

## 2. Runtime Modes

The application has one code path with two interchangeable infrastructure
backends, selected by environment variables:

| Mode | When | Auth | Persistence |
| --- | --- | --- | --- |
| `supabase` | `NEXT_PUBLIC_SUPABASE_URL` + anon key configured | Supabase Auth (cookie session via `@supabase/ssr`) | Supabase Postgres + Supabase Storage |
| `dev-fallback` | No Supabase credentials (or `AUTH_MODE=dev-fallback`) | Signed HMAC dev cookie (**NOT secure, dev only**) | Local JSON store + files under `.data/` (**dev only**) |

Selection lives in `src/lib/env.ts`. All route handlers, validation, ZIP
generation, filtering and authorization logic are shared between modes; only
the `AuthAdapter` and `DocumentStore` implementations differ
(`src/lib/store/`). This is the seam future integrations plug into.

The dev-fallback exists so the UI and the complete workflow can be exercised
without cloud credentials. It is labelled as insecure in the UI banner and in
this documentation. It is **never** production authentication.

## 3. Architecture Overview

```
Browser (React client components)
   │  fetch (same-origin JSON / multipart / zip stream)
   ▼
Next.js route handlers  (src/app/api/**)
   │  1. resolve session (dev cookie | Supabase SSR cookie)
   │  2. authorize (document must belong to caller's business)
   │  3. validate (Zod + magic-byte sniffing)
   ▼
Domain layer (pure, unit-tested: src/lib/dates.ts, filenames.ts,
              file-validation.ts, zip.ts, filters.ts)
   ▼
DocumentStore interface (src/lib/store/types.ts)
   ├── SupabaseDocumentStore  → Supabase Postgres (RLS) + Storage (private)
   └── LocalDevDocumentStore  → .data/dev-store.json + .data/files/** (dev only)
```

### Request → response map

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness + active mode |
| `/api/auth/sign-up` | POST | Create account (profile + business provisioned) |
| `/api/auth/sign-in` | POST | Start session |
| `/api/auth/sign-out` | POST | End session |
| `/api/auth/me` | GET | Current user + mode + business |
| `/api/documents` | GET | List/filter documents (`month`, `year`, `category`, `search`) |
| `/api/documents` | POST | Upload (multipart, multiple files + per-file metadata) |
| `/api/documents/[id]` | DELETE | Delete document (row + storage object) |
| `/api/documents/[id]/preview` | GET | Short-lived authorized preview URL (JSON) |
| `/api/documents/[id]/download` | GET | Authorized byte stream (attachment) |
| `/api/export` | POST | Monthly ZIP (`{ month, year }`) |
| `/api/dev/load-samples` | POST | Load sample PDFs — **dev-fallback only** |

Every document endpoint resolves the session first and verifies that the
document belongs to a business owned by the caller, server-side. Frontend
visibility controls are never the security boundary.

## 4. Document Lifecycle

1. **Upload** — multipart request, ≤ 20 files, ≤ 10 MB per file, extensions
   `pdf|jpg|jpeg|png|txt`, matching MIME types, magic bytes sniffed
   (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`). Metadata validated with Zod.
   Storage path: `<businessId>/<YYYY>/<MM>/<uuid>.<ext>` inside the private
   bucket (or mirrored directory layout in dev-fallback).
2. **Record** — `documents` row with original filename, storage path, MIME,
   size, category, optional `document_date`, `created_at`.
3. **List/filter** — the effective date of a document is
   `document_date ?? UTC date of created_at`. Month/year/category/search
   filtering is implemented in pure functions (`src/lib/filters.ts`) shared
   by the API and unit tests, so both runtime modes behave identically.
4. **Preview / download** — authorized access only. Supabase mode issues
   short-lived signed URLs (15 minutes); dev mode streams through the
   authorized download route. No permanent public URLs exist.
5. **Delete** — DB row is removed first (authorization-checked), then the
   storage object is removed best-effort. A failed object cleanup can only
   leave an unreferenced orphan object; it can never leave a listed document
   pointing at a missing file.
6. **Monthly export** — selected month's documents are read server-side; if
   any storage object is missing the export **aborts** with an error listing
   the missing documents (never a silently incomplete archive). Filenames are
   sanitized and de-duplicated (`name.pdf`, `name (2).pdf`, …). The archive is
   named `BusinessVault_<Month>_<Year>.zip` and includes `manifest.txt`.

## 5. Date Handling

- `document_date` is stored as a PostgreSQL `date` (a calendar date, no time,
  no timezone) and serialized as `YYYY-MM-DD`.
- The effective date of a document is its `document_date` when present. Documents without
  a read date are **not** attributed to the upload month; they stay visible in the
  dashboard, are excluded from month-scoped ZIP exports, and are listed separately in
  the coverage report. Month grouping uses the `YYYY-MM` string prefix of the effective
  date — no `Date` object arithmetic, so no timezone drift.
- The UTC upload date is **not** used as a fallback for month grouping (a bill is not
  dated to the day someone happened to upload it). `todayUtcDate()` is still used for
  "current month" counts and defaults.

## 6. Frontend Structure

- `/` — landing page (branding, workflow explanation, CTAs).
- `/sign-in`, `/sign-up` — auth forms (accessible labels, error states).
- `/dashboard` — protected. Client-side dashboard calling the JSON API:
  stat cards, month/year + category filters, search, upload panel (per-file
  category and date with "uses upload date" fallback notice), document list
  with preview/download/delete, monthly export panel.
- Loading, empty and error states everywhere; responsive from 360px up.
- Brand accent `#7C3AED`, light SaaS styling, minimal decoration.

## 7. Error Handling

- Domain errors (`AppError`) carry safe public messages and an HTTP status.
- API routes return `{ error: { code, message, details? } }` and never leak
  stack traces, SQL, storage paths or secrets.
- Client shows actionable messages and preserves user input on failure.

## 8. Testing Strategy

- **Unit (Vitest, executed):** filename sanitization/de-duplication, date and
  month helpers, Zod validation, magic-byte sniffing, ZIP assembly and
  duplicate/missing-file behavior, local store CRUD + authorization,
  filtering logic.
- **Smoke (executed manually against the dev server):** boot, auth flow,
  upload of real generated sample PDFs, filtering, ZIP download and content
  check, delete.
- **Playwright E2E (not executed):** environment cannot download browser
  binaries. Documented as blocked.

## 9. Future-Proofing

Out-of-scope integrations (WhatsApp/email ingest, OCR, GST, analytics) attach
to two seams only: `DocumentStore` (persistence) and the ingest API (new
sources create documents through the same validated upload path). The core
document model is source-agnostic (`uploaded_by`, category, dates, storage
path), so no rewrite is needed later.

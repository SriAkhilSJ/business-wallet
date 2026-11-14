# BusinessVault

> Repository: `business-wallet` · Stage: **Proof of Concept (POC)**

**BusinessVault** is a business financial document management web application.
It helps business owners collect bills, invoices and receipts in one place,
organize them by month and category, and export a month's documents as a single
ZIP file to share with their Chartered Accountant (CA).

Core workflow this POC demonstrates:

```
UPLOAD → ORGANIZE → FILTER BY MONTH → DOWNLOAD ZIP → SHARE WITH CA (manual)
```

## Problem Statement (hypothesis)

Business owners' financial documents are scattered across mobile galleries,
WhatsApp chats, email attachments, SMS messages, PDF folders and physical
receipts. At month-end, CAs request bills, receipts, invoices and payment
proofs — and owners spend considerable time searching, collecting and sharing
them, risking delays and missing records.

> **Note:** this is an initial problem hypothesis. The market has **not** been
> validated. The POC exists to test whether centralized monthly collection and
> sharing is useful.

## POC Objectives

1. Demonstrate upload of PDF and image documents with metadata.
2. Demonstrate dashboard organization: search, category, month/year filters.
3. Demonstrate a real monthly ZIP export with safe unique filenames.
4. Demonstrate server-side authorization around every document operation.
5. Provide sample documents and a repeatable local demo workflow.

This is **not** the complete commercial product. Out of scope: WhatsApp/SMS/
email integrations, OCR/AI extraction, GST filing, bank/accounting integrations,
payment gateways, subscriptions, advanced analytics.

## Features

| Area | Details |
| --- | --- |
| Landing page | Branding, workflow explanation, Sign in / Get started |
| Authentication | Sign up / sign in / sign out; protected dashboard (Supabase Auth, or a clearly labelled dev fallback) |
| Dashboard | Total documents, current-month count, recent uploads, category summary, responsive layout |
| Upload | Multi-file PDF/JPG/JPEG/PNG; per-file category + document date; upload-date fallback with clear notice |
| Validation | Extension, MIME, **magic bytes**, size (≤ 10 MB/file), count (≤ 20/batch), empty/invalid input — all server-side |
| Management | List, filename search, category/month/year filters, image & PDF preview, delete with confirmation |
| Monthly export | `BusinessVault_<Month>_<Year>.zip` with original filenames, ` (2)` de-duplication and a `manifest.txt` |
| Safety | Private storage, short-lived signed URLs (Supabase mode), no public URLs, ZIP aborts loudly on missing files |
| Sample data | 10 fictional watermarked PDFs across Oct–Nov 2026 + one-click loading |

## Technology Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js route handlers (single application) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (`@supabase/ssr` cookie sessions) |
| Storage | Supabase Storage — private bucket `business-documents` |
| Validation | Zod |
| ZIP | JSZip |
| Unit tests | Vitest |
| E2E | Playwright *(not executed in this sandbox — see Test Results)* |

## Architecture Overview

```
Browser (React)
   │  same-origin fetch (JSON / multipart / zip stream)
   ▼
Next.js route handlers (src/app/api/**)
   │  1. resolve session  2. authorize (business ownership)  3. validate (Zod + magic bytes)
   ▼
Pure domain layer (src/lib/{dates,filenames,filters,file-validation,zip}.ts)
   ▼
DocumentStore interface (src/lib/store/types.ts)
   ├── SupabaseDocumentStore → Supabase Postgres (RLS) + Storage (private)
   └── LocalDevDocumentStore → .data/dev-store.json + .data/files/**  (dev only)
```

Two runtime modes share one code path (`src/lib/env.ts`):

| Mode | When | Auth | Storage |
| --- | --- | --- | --- |
| `supabase` | `NEXT_PUBLIC_SUPABASE_URL` + anon key set | Supabase Auth | Supabase Postgres + Storage |
| `dev-fallback` | No credentials (or `AUTH_MODE=dev-fallback`) | HMAC dev cookie — **NOT secure, dev only** | Local `.data/` directory — **dev only** |

Every document endpoint verifies business ownership **server-side**; Supabase
RLS provides a second layer. See `docs/SECURITY_NOTES.md` for controls and
known risks.

### API surface

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness + active mode |
| `/api/auth/sign-up` · `/sign-in` · `/sign-out` | POST | Auth |
| `/api/auth/me` | GET | Current user, business, mode |
| `/api/documents` | GET | List/filter (`month`, `year`, `category`, `search`) |
| `/api/documents` | POST | Multi-file upload (multipart) |
| `/api/documents/[id]` | DELETE | Delete (record + storage object) |
| `/api/documents/[id]/preview` | GET | Short-lived authorized preview URL |
| `/api/documents/[id]/download` | GET | Authorized byte stream |
| `/api/export` | POST | Monthly ZIP (`{month, year}`) |
| `/api/dev/load-samples` | POST | Load sample PDFs — dev-fallback only |

## Project Structure

```
├── docs/                    # Product spec, technical design, schema, security, plan
├── sample-data/             # 10 fictional sample PDFs + manifest.json
├── scripts/
│   ├── generate-samples.mjs # Builds the sample PDFs (npm run samples:generate)
│   └── upload-samples.mjs   # Uploads samples to Supabase (service key, explicit user)
├── supabase/migrations/     # SQL schema + RLS + storage policies
├── src/
│   ├── app/                 # Landing, sign-in/up, dashboard, API routes
│   ├── components/          # Logo, auth form, dashboard UI
│   └── lib/                 # env, auth, store adapters, pure domain modules
└── tests/                   # Vitest unit tests
```

## Prerequisites

- Node.js ≥ 20 (developed on Node 22) and npm
- Optional: a Supabase project (free tier works) for the production path

## Installation

```bash
git clone <this-repo> business-vault && cd business-vault
npm install
cp .env.example .env.local
```

## Environment Setup

`.env.local` (see `.env.example`; never commit real values):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server scripts only** (`samples:upload`) — never client-side |
| `AUTH_MODE` | `auto` (default) \| `supabase` \| `dev-fallback` |
| `DEV_SESSION_SECRET` | Dev-fallback cookie signing secret |

With the two Supabase variables empty the app runs in **dev-fallback** mode:
any email + 8-char password signs you in, documents live under `.data/`, and
the UI shows a permanent "not production-secure" banner.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com); copy the project
   URL and anon key into `.env.local`.
2. **Auth:** for a frictionless POC demo, disable "Confirm email" under
   *Authentication → Providers → Email* (otherwise sign-up returns a
   "confirm your email" step).
3. **Database:** apply the migrations (below).
4. **Storage:** the second migration creates the private
   `business-documents` bucket and its RLS policies. (In the dashboard it
   would be *Storage → New bucket → name `business-documents` → Public: OFF*.)
5. Set `AUTH_MODE=supabase` (or leave `auto`) and restart `npm run dev`.

### Database migrations

```bash
# Option A — Supabase CLI
supabase link --project-ref <project-ref>
supabase db push

# Option B — SQL editor: paste and run, in order:
#   supabase/migrations/20261114000001_init_schema.sql
#   supabase/migrations/20261114000002_storage_bucket.sql
```

Tables: `profiles`, `businesses`, `documents` (UUID PKs, FKs, CHECK
constraints, indexes) plus RLS policies restricting every row to the owning
user, and storage policies scoping objects to
`<business-id>/<YYYY>/<MM>/<uuid>.<ext>`. Details: `docs/DATABASE_SCHEMA.md`.

## Local Development

```bash
npm run dev        # http://localhost:3000  (dev-fallback mode by default)
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
```

Demo walkthrough (dev-fallback): sign up → click **"Load sample documents"**
→ filter November 2026 → **Export ZIP** → open `BusinessVault_November_2026.zip`.

## Tests

```bash
npm test           # Vitest unit suite (52 tests)
npm run test:watch # watch mode
```

### Test results (2026-11-14)

| Suite | Status | Notes |
| --- | --- | --- |
| Unit tests (Vitest, 52 tests / 6 files) | ✅ passed | dates, filenames, validation, filters, ZIP, local store + authz |
| `npm run build` | ✅ passed | 15 routes generated |
| `npm run lint` / `npm run typecheck` | ✅ passed | clean |
| Smoke — boot, auth, upload, filters, delete, preview | ✅ verified via dev server | incl. PNG/JPEG/PDF uploads |
| Smoke — invalid files (exe, spoofed content, garbage, empty) | ✅ rejected with per-file errors | server-side validation |
| Smoke — ZIP export + contents + duplicates + manifest | ✅ verified | `BusinessVault_November_2026.zip` |
| Smoke — missing storage object during export | ✅ aborts with 502 + named files | never a partial archive |
| Smoke — unauthorized access (2nd user) | ✅ 404/401, existence not leaked | preview, download, delete, list |
| Supabase live integration (auth, RLS, storage) | ⛔ blocked | no Supabase credentials in this environment — integration code complete, apply migrations to verify |
| Playwright E2E | ⛔ not executed | sandbox cannot download browser binaries |

## Sample Documents

10 fictional PDFs (rent, electricity, internet, laptop, supplies, sales,
fuel, software, equipment, payment) with dates across **October–November
2026**. Every page is watermarked **"SAMPLE — NOT A REAL TAX INVOICE"** and all
names, addresses, amounts and tax identifiers are fictional.

```bash
npm run samples:generate   # regenerate sample-data/*.pdf + manifest.json

# dev-fallback: click "Load sample documents" on the dashboard
# Supabase: upload to an existing user's business (explicit, never automatic):
SUPABASE_SERVICE_ROLE_KEY=... npm run samples:upload -- --email=you@example.com
```

Details: `sample-data/README.md`.

## Known Limitations

- **POC scope** — single business per user; no CA accounts, collaboration,
  OCR, GST or integrations (see roadmap).
- **Dev-fallback mode is not secure** — any credentials work; local file
  store. Disable with `AUTH_MODE=supabase`. See `docs/SECURITY_NOTES.md` for
  the full risk register (no rate limiting, no virus scanning, etc.).
- Month grouping uses the document date, falling back to the **UTC calendar
  date of upload** (documented convention to avoid timezone drift).
- ZIP is built in memory (fine for monthly volumes of ≤10 MB files).
- Playwright E2E and live Supabase verification are blocked in this sandbox
  (see test results).

## Future Roadmap

1. WhatsApp / email / SMS ingest channels (add sources behind the existing
   validated upload path).
2. OCR + AI classification of bills (suggested category/date).
3. Direct CA sharing links with expiry and access logs.
4. GST-aware fields, reports and filing integrations.
5. Multi-user businesses/teams and audit trails.
6. Streaming ZIP export and antivirus scanning at upload.

## Documentation

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
- [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)
- [`docs/SECURITY_NOTES.md`](docs/SECURITY_NOTES.md)
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

---

*Proof of concept. No security certification is claimed. Not a commercial
product.*

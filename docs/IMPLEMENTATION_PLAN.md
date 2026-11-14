# BusinessVault — Implementation Plan (POC)

## Stage 1 — Inspection ✅
- Repository inspected: single `README.md` ("# business-wallet"), clean tree,
  branch `arena/9b46c386-business-wallet` off `c510c98` (Initial commit).
- Environment: Node v22.22.3, npm 10.9.8.
- Decision: initialize Next.js application in-place (scaffold via
  `create-next-app`, moved in to preserve the existing README heading).

## Stage 2 — Specification ✅
- `docs/PRODUCT_SPEC.md`, `docs/TECHNICAL_DESIGN.md`, `docs/DATABASE_SCHEMA.md`,
  `docs/SECURITY_NOTES.md`, `docs/IMPLEMENTATION_PLAN.md` created.

## Stage 3 — Implementation ✅
1. **Domain layer (pure, testable)** ✅
   - `src/lib/config.ts` — categories, limits, constants.
   - `src/lib/dates.ts` — month keys, labels, formatting, effective date.
   - `src/lib/filenames.ts` — sanitize + de-duplicate.
   - `src/lib/file-validation.ts` — extension/MIME/size/magic-byte checks (Zod).
   - `src/lib/filters.ts` — list filtering + summary stats.
   - `src/lib/zip.ts` — monthly archive assembly (JSZip).
   - `src/lib/errors.ts` — safe `AppError` type.
2. **Infrastructure adapters** ✅
   - `src/lib/env.ts` — mode selection (`supabase` | `dev-fallback`).
   - `src/lib/auth/*` — session resolution (Supabase SSR / dev HMAC cookie).
   - `src/lib/store/*` — `DocumentStore` interface, Supabase + local-dev
     implementations.
3. **API routes** ✅ — `src/app/api/**` per TECHNICAL_DESIGN §3.
4. **UI** ✅ — landing, sign-in/up, dashboard (stats, filters, upload, list,
   preview, export, delete, states, responsive).
5. **Migrations** ✅ — `supabase/migrations/*.sql` with RLS + storage policies.

## Stage 4 — Database ✅ (code complete; applying requires a Supabase project)
- Schema + RLS migrations written; Supabase configuration documented in the
  README. Live migration execution is **blocked** without credentials.

## Stage 5 — Testing ✅ (Supabase live + Playwright blocked — see README)
- Unit tests (Vitest): 52 tests / 6 files, all passing — every pure module +
  local store authorization.
- Manual smoke against `npm run dev`: boot, auth, upload real sample PDFs and
  images, invalid-file rejection, filters, ZIP round-trip + contents,
  duplicate names, missing-file abort, delete (record + object), unauthorized
  access (2nd user + unauthenticated), empty month export, sample loader
  idempotency. All verified — details in README "Test results".
- Playwright: blocked in this sandbox (browser download host not reachable).

## Stage 6 — Final review ✅
- `npm run build` clean, `npm run lint` clean, `npm run typecheck` clean,
  vitest results documented, README completed with exact run commands and
  acceptance mapping.

## Risk register (POC)
| Risk | Mitigation |
| --- | --- |
| No Supabase credentials in dev sandbox | Dual-mode architecture; dev-fallback verified end-to-end |
| Timezone bugs in month grouping | Calendar-date strings (`YYYY-MM`) + documented UTC fallback |
| Incomplete ZIPs | Hard abort on missing objects with named errors |
| Filename collisions / traversal | Sanitize + UUID storage names + unique ZIP entries |
| Scope creep (WhatsApp, OCR, GST…) | Explicitly out of scope; only the two integration seams noted in TECHNICAL_DESIGN §9 |

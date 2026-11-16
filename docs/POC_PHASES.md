# BusinessVault — five phases

One line each. Each phase ends with something you can show someone on a phone.

| Phase | Focus | Ends with |
|---|---|---|
| 1 | The loop, on real files | Paste the CA's message, press Collect, get the ZIP — on the live site, with a 9 MB photo |
| 2 | Can it read? | Photos and scans get their own category instead of landing in review |
| 3 | Collect where the documents actually are | Share 5 photos from WhatsApp into the app on Android |
| 4 | Trust and control | The owner can see and fix every decision, including what was skipped |
| 5 | Handover | One button sends the pack to Drive; 5 owners finish in under 3 minutes |

Phases 1–2 are the POC. Phases 3–5 are what makes it usable by a real owner. If time runs out after phase 2, you still have a defensible POC: the hard part (sorting and checking against the CA's ask) is proven.

---

## Phase 1 — the loop, on real files

### What we focus on

**One path that works end to end with real documents.** Not features, not sources, not AI. The exact loop you described:

```
paste the CA's message  →  press Collect  →  checklist  →  ZIP
```

The logic already exists and runs in `demo/`. Phase 1 moves it behind a page in the web app and makes it survive real files.

### Why this is first

Two platform limits currently break the product before any feature matters: uploads over 4.5 MB fail, and ZIP responses over 4.5 MB fail. A normal phone photo is 3–5 MB, so a batch of three photos already breaks the current build. Nothing else can be demonstrated until that is fixed.

### The tickets

| # | Ticket | Blocked by | What it delivers |
|---|---|---|---|
| 1.1 | **Real files in and out** — upload straight to storage, stream the ZIP | none | A 9 MB photo uploads; a 10 MB pack downloads; both on the live URL |
| 1.2 | **Inputs become a job** — date range, amount range, optional note → checklist | none | Setting 01–31 Aug and typing "electricity, rent, UPI proofs" produces those three checklist rows |
| 1.3 | **Collect** — read the sources we have, fingerprint each file, sort by confidence, count as it goes | 1.1, 1.2 | Press Collect; see found / duplicates / sorted / needs-you counts move without a reload |
| 1.4 | **The pack** — folders per category, contents list, the CA's checklist inside | 1.3 | Download `BusinessVault_August_2026.zip` with 4 folders, `_manifest.txt`, `_coverage.txt` |
| 1.5 | **Nobody else can see it** — production cannot fall back to the open dev login; per-user access proven by a test | none | A forged session cookie is rejected; a second account sees zero documents |

1.2 and 1.1 have no blockers and can run in parallel. 1.5 is independent and should not be left to the end, because it is the one thing that would embarrass a live demo.

### Done when

1. On the deployed URL, on a real phone: upload 12 mixed files including one 9 MB photo.
2. Paste a CA message; the month and the checklist match it.
3. Press Collect; four counts appear and settle.
4. Download the pack: one folder per category, a contents list, a coverage sheet that names what is missing.
5. A second account sees nothing of the first.
6. The whole thing takes under 3 minutes from paste to download.

### Not in phase 1

Phase 1 is no longer scoped as a throwaway POC. The product is being built in full, so the following are now in scope where they serve the core loop, and are no longer deferred by default: AI classification and review (Phase 2 work pulled forward where it unblocks the loop), Drive handover, and the connectors from POC_PLAN Phase 7. SMS/WhatsApp text ingestion remains out of scope for the web app (needs a phone app). Native apps remain out of scope.

### The one risk

The upload rewrite is the only part that changes how files travel. Everything else is moving logic that already works. If 1.1 slips, the rest of the phase still lands and the demo runs on small files — but on the deployed site only, not on a real phone.

---

## Phases 2–5 in brief

**Phase 2 — can it read?**
Text from PDFs, OCR for photos, one structured extraction per document returning type, date, vendor, amount, confidence and a reason. Thirty documents with agreed answers become the measure. Ends when photos stop landing in review.

**Phase 3 — collect where the documents are.**
Camera, multi-select, share sheet into the installed web app (Android), and one Drive folder. No native app. Ends when a WhatsApp photo reaches the app in two taps.

**Phase 4 — trust and control.**
A review screen that shows only uncertain items, one-tap corrections, every skipped file with its reason, provenance on each document, and soft delete so originals are never destroyed. Ends when a wrong guess is fixed faster than doing it by hand.

**Phase 5 — handover.**
Drive delivery, a pack format confirmed with three CAs, and five timed sessions with real owners. Ends with the only number that matters: do they come back in month two without a reminder.

# BusinessVault — collection demo

A runnable demo of the POC loop, with **no phone, no native app, no credentials, and no `npm install`**. It uses only Node built-ins.

```
sources (the "phone")
  → discover
  → classify + confidence
  → de-duplicate by content hash
  → auto-accept the confident ones, queue the uncertain ones
  → pack approved files into a ZIP, one folder per category
```

## Run it

```bash
node demo/setup-samples.mjs     # create the demo sources (safe to re-run)
node demo/collect.mjs           # collect; leaves uncertain files in the queue
node demo/collect.mjs --approve-all   # approve the queue, build the full ZIP
```

Output lands in `demo/out/`:

- `BusinessVault_August_2026.zip` — the pack for the CA
- `report.json` — every file, its source, confidence, and decision
- `review-queue.json` — the files a human must confirm

## What the folders stand in for

| Folder | Real-world source | How a real build gets it |
|---|---|---|
| `sources/photos/` | Phone gallery | Android: MediaStore / Photo Picker. Web: file picker, or share sheet into an installed PWA |
| `sources/files/` | Downloads, WhatsApp documents, scanned PDFs | File picker, share sheet |
| `sources/sms/` | Bank / UPI SMS | Android `READ_SMS` — restricted; not available to a web app |
| `sources/notifications/` | GPay, bank, delivery notifications | Android `NotificationListenerService` — needs a special user grant |
| `sources/whatsapp/` | WhatsApp media + chat export | Only downloaded media, via the share sheet. **Message text is not readable by any app** |
| `sources/email/` | Gmail attachments | Gmail API with OAuth (`gmail.readonly`) — requires Google verification |
| `sources/drive/` | A connected Drive folder | Drive API with `drive.file` scope — the easiest real connector |

## What is real in this demo

- The discovery walk, content hashing, duplicate skip, confidence thresholds, review routing, category folders, manifest, index CSV, and report are all real logic operating on real files.
- The ZIP is a real ZIP, written by `demo/lib/zip.mjs` with no dependencies, and it opens in Explorer / Finder / `unzip`.

## What is simulated

- **No OCR and no LLM.** PDFs and images are never opened. Their only signal is the filename. A file called `electricity-bill-aug-2026.pdf` scores 0.89 from its name; `IMG_20260812_184501.png` scores 0.35 and goes to review. That is deliberate: it shows exactly why OCR + AI classification is the next build step, instead of hiding the gap.
- **No network.** Nothing is uploaded anywhere. The Drive step is a seam, not an integration.

## Where Google Drive plugs in

`demo/collect.mjs` builds the archive as a `Buffer`. The production version adds one function:

```
packForDrive(buffer, { businessName, period })  // drive.file scope, folder per period
```

That needs an OAuth client and a `drive.file` scope, which is the only Google scope that does not require a verification review. Everything before that point — discovery, classification, dedupe, review — is unchanged.

## Wiring it into the web app

The demo is intentionally outside `src/`. To move it in, the pieces map like this:

| Demo file | Becomes |
|---|---|
| `lib/classify.mjs` | `src/lib/classify.ts`, called per document after OCR |
| `collect.mjs` discovery loop | `src/lib/ingest.ts`, called by `POST /api/collections` |
| confidence thresholds | `src/lib/config.ts` |
| `review-queue.json` | `review_status` column + a review screen |
| `lib/zip.mjs` | replaced by streaming ZIP on the server (Vercel caps responses at 4.5 MB) |

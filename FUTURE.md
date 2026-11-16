# BusinessVault — Future Roadmap

Out of scope for current build but part of product vision.

## 1. Ingest channels
- WhatsApp (official Business integration only)
- Gmail (OAuth, history checkpoints, recovery)
- Google Drive (OAuth, import permitted docs)
- Local device (user-selected files/folders)
- SMS/notifications (web cannot read; screenshot/export/paste)

## 2. Document intelligence
- OCR for scanned docs
- Advanced duplicate detection (perceptual, text, financial identity, scored)
- Reason field in classification
- Drop threshold under 0.30

## 3. Background processing
- Durable jobs, queue, concurrency, progress, retry/backoff, idempotency, recovery

## 4. Organisation and CA handover
- Indian FY, any date range, views for found/reviewed/duplicates/missing
- CA package: manifest, source refs, duplicate groups, coverage, timestamp
- CA format confirmation with 3 CAs

## 5. Security and privacy
- Rate limiting, antivirus, audit log, AI consent, retention, revocable URLs, MFA

## 6. Platform
- Native apps (out of scope; web share target instead)
- Multi-user teams, payments, GST, analytics

## 7. Testing
- Duplicate levels, OCR golden set, route tests, Gmail recovery, export completeness, Playwright E2E

## Success metric
Owners return in month two without a reminder.

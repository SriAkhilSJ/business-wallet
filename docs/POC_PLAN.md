# BusinessVault — POC Plan

Status: draft for approval · 14 Nov 2026
Owner: product · Builds on: `docs/PRODUCT_SPEC.md`, the audit of 14 Nov 2026, and the working demo in `demo/`

---

## 1. The one thing this POC has to prove

**Hypothesis.** A business owner will hand over a month of documents to an app that sorts them automatically, and will come back the following month without being reminded.

**Why that is the hypothesis and not "does the ZIP work".** The ZIP already works. The open question is whether removing the sorting work is enough to change a habit that currently runs on WhatsApp.

**How we know it is true.** Two numbers, both measured on real users, not on our own sample files:

| Measure | Target |
|---|---|
| Time from opening the app to a finished pack, 20 mixed documents | under 3 minutes |
| Owners who return in month two without a reminder | 3 of 5 |

If month two does not happen on its own, the product is being pushed by the CA, not pulled by the owner, and the plan changes to a CA-side product. That is a real possible outcome, and the POC is designed to reveal it early rather than after a year of building.

---

## 2. Problem Statement

Business owners struggle to gather the financial documents their Chartered Accountant needs each month. Bills, invoices, receipts, payment proofs, bank notifications, emails and expense records are scattered across phone folders, the gallery, email, cloud drives and messaging apps. The owner has to search each source, work out which records belong to the period, remove duplicates, organise the files, and send everything to the CA. The work repeats every month, takes time, and goes wrong quietly: documents get missed, sent twice, or filed under the wrong heading.

---

## 3. Solution

One web app where the owner does three things:

1. **Sets three things:** the date range (from → to), an amount range, and — if the CA asked for something specific — types it into one free-text box. Nothing else to fill, no deadline field, no client field, no format field.
2. **Adds documents** the way they already have them: pick photos from the phone, take a photo, share files from WhatsApp into the app, or connect one Drive folder.
3. **Confirms the few the app is unsure about**, in one tap each.

Then the app answers the question the CA actually asked: **what was found, what needs one tap, and what is missing.** The pack is a ZIP organised into category folders with a contents list and that checklist inside it, or the same thing sent to Google Drive.

Everything else is automatic: reading the document, deciding what it is, filling in the date, spotting repeats, and checking the result against the CA's list.

The app says plainly, on the page, what it cannot do: it does not read SMS, WhatsApp messages, or notifications. Those need a phone app. The POC proves the sorting and packing first, because that is the part that can be built and shown now.

---

## 4. Who it is for

**The payer is the business owner.** They hold the documents, they feel the monthly annoyance, they decide whether to use it.

**The CA is the door, not the customer.** The CA already asks for these documents every month and already has the owner's trust. The CA introducing the app is what makes the owner try it. The CA gets no account in this POC.

This distinction matters for every design choice: the owner's effort must go down, because the owner is the one who has to change their habit.

---

## 5. User Stories

1. As a business owner, I want to add a month of documents in one action, so that I do not have to pick and label files one by one.
2. As a business owner, I want to share photos straight from WhatsApp into the app, so that I can use the habit I already have.
3. As a business owner, I want to photograph a paper bill and have it accepted, so that paper does not break the flow.
4. As a business owner, I want the app to work out what each document is, so that I never choose a category from a dropdown.
5. As a business owner, I want the app to read the date from the document, so that I do not type dates.
6. As a business owner, I want the app to tell me when the same bill appears twice, so that my CA does not receive duplicates.
7. As a business owner, I want to see only the documents the app is unsure about, so that I confirm three things instead of thirty.
8. As a business owner, I want to correct a wrong guess in one tap, so that fixing a mistake is faster than doing it by hand.
9. As a business owner, I want to see progress while documents are being read, so that I know it is working and how long is left.
10. As a business owner, I want to pick any date range, not just a calendar month, so that a quarter or a part-month works.
11. As a business owner, I want the finished pack organised into folders by category, so that my CA can find things without asking me.
12. As a business owner, I want a contents list inside the pack, so that the CA can check what was sent.
13. As a business owner, I want to send the pack to Google Drive, so that I do not have to download and forward a large file.
14. As a business owner, I want the app to ignore OTPs, delivery notices and ordinary chat, so that noise does not end up in my accounts.
15. As a business owner, I want to know which documents were left out and why, so that nothing disappears silently.
16. As a business owner, I want my documents visible only to me, so that my financial records are not exposed.
17. As a business owner on a slow connection, I want to add a 9 MB photo without the upload failing, so that normal phone pictures work.
18. As the person running the POC, I want a repeatable demo with fixed sample data, so that I can show the same result to every stakeholder.
19. As a business owner, I want to paste the CA's message instead of filling a form, so that I do not have to translate a request into settings.
20. As a business owner, I want the app to tell me what is still missing from the CA's list, so that I do not send an incomplete pack and get asked again.
21. As a business owner, I want the checklist to travel inside the pack, so that my CA can see what was sent and what was not available.
22. As a business owner, I want to see which message the job was built from, so that I can correct it if the CA's request was misread.

---

## 6. What "done" looks like

The POC is accepted when all six are true on the deployed URL, using a real phone:

1. 20 mixed documents (photos, PDFs, text messages) are added in under 2 minutes.
2. At most 4 need human confirmation, and each is confirmed in one tap.
3. The same file added twice is caught and reported once.
4. A 9 MB photo uploads without error.
5. The export covers a chosen date range and contains one folder per category plus a contents list.
6. A second user account cannot see, open, or export the first user's documents.
7. The pack carries a checklist that answers the CA's message item by item: found, needs confirmation, or missing, with the reason.

---

## 7. Implementation Decisions

**One application.** The existing Next.js app stays. No queue service, no worker fleet, no microservices. A POC that needs a message broker to sort 20 receipts is not a POC.

**Three seams, two of which already exist.** These are the only places behaviour is added or swapped:

1. **Ingest.** One function that takes a set of files plus their source and returns what was accepted, rejected and duplicated. Today this logic is copied inside the upload route and again inside the sample loader; a third copy would appear for every new source. One ingest function is the seam every source uses.
2. **Persistence.** The existing store interface (documents, storage, ownership) is extended, not replaced. It already has two adapters, so it is a real seam rather than a hypothetical one.
3. **Export.** The existing archive builder is generalised from a month to a date range, and reused by both download and Drive.

**Three inputs, one of them optional.** The job is defined by a date range, an amount range, and an optional free-text note. If the note names specific things ("electricity bill, rent receipt, UPI proofs"), those become the checklist and act as the filter; anything else found is listed as "also found, not sent" rather than silently dropped. If the note is empty, everything in the period and amount range is collected and the checklist lists what was found.

**Document model changes.** Each document gains: where it came from, the source's own identifier, when it was collected, a content hash, a classification with a confidence score, a review state, and a deletion marker instead of a hard delete. Without these, provenance, duplicate detection and "keep the original" are not implementable.

**Capture, four routes, no native app.**

- Phone gallery, many at once, through the browser file picker.
- Camera, through the browser.
- Share sheet into an installed web app with a share target (Android; not iOS).
- One Google Drive folder, using the `drive.file` scope, which is the only Google scope that needs no verification review.

**Reading documents.** Text is taken from the PDF text layer when present; OCR runs only when there is no text layer. One structured model call per document returns type, date, vendor, amount, confidence and a short reason. The demo's thresholds carry over: accept at 0.85 and above, ask between 0.30 and 0.85, drop below 0.30. Thresholds live in one config file, not inside a prompt.

**Duplicates.** Exact duplicates are identified by a hash of the file contents, unique per business. Similar-looking images are a later problem and are not attempted here.

**Jobs and progress.** One collection job row plus one row per item. The browser drives the work in small steps so each request is short; the page polls the job row for counts. No websockets, no server-sent events.

**Uploads go straight to storage.** The browser obtains a short-lived signed upload URL and writes the file to storage itself. This fixes two things at once: the current route buffers whole files in memory, and the hosting platform rejects request bodies over 4.5 MB.

**Export streams.** The hosting platform also caps responses at 4.5 MB, so the archive is streamed rather than built in memory, or generated in storage and handed over as a signed link. Either way, no full-size buffer in a request.

**Google Drive.** One function takes the finished archive and writes it to a dated folder using `drive.file`. It is the last step to build, and nothing before it changes.

**Security defaults.** The development login must refuse to run in production. Secrets are never accepted in the repository. The storage bucket gets a size limit and a type limit so the app's own rules cannot be bypassed.

---

## 8. Milestones

**M1 — Survives a real file (week 1).**
Acceptance: a 9 MB photo uploads and a 10 MB pack downloads on the deployed URL; a forged development cookie is rejected in production; tests cover the upload, export and unauthorised-access routes.

**M2 — Collection works on the owner's own data (week 2).**
Acceptance: a pasted CA message produces the right period and checklist; a folder of 30 files yields the correct discovered / duplicate / accepted / needs-review counts on screen without a reload; every stored file is byte-identical to the original; and the checklist marks at least one asked-for item as missing rather than pretending the pack is complete.

**M3 — Reading and reviewing (week 3).**
Acceptance: on 20 mixed documents, at most 4 land in review; each stored document has a category, a date, a confidence and a reason; an approved item appears in the next pack.

**M4 — The pack and the handover (week 4).**
Acceptance: any date range exports with one folder per category plus a contents list; the same pack can be sent to Drive; five owners complete the flow unaided and are timed.

---

## 9. Testing Decisions

A good test here checks what a user can observe, through the same seam a caller uses: given these files and this range, what is accepted, what is asked about, what ends up in the pack. Tests should not reach inside the classifier to assert rule internals.

- **Existing prior art.** The repository already tests pure modules and the local store. New tests follow that shape.
- **Seam tests.** Ingest is tested with in-memory files. Export is tested by building an archive and reading it back. Both run without a network.
- **Route tests.** Upload, list, export and download are tested for the three cases that matter: signed in and owns it, signed in and does not own it, not signed in. These do not exist today and are the largest gap.
- **Classification golden set.** Thirty documents with agreed answers, including four that must land in review. This set is the acceptance measure for every change to the reader, and it is the only way to know whether a prompt change helped or hurt.
- **No browser automation in this POC.** The five timed owner sessions replace it.

---

## 10. Risks

| Risk | What happens | Response |
|---|---|---|
| Owners do not return in month two | The product is CA-pushed, not owner-pulled | Measure it in month two; be ready to switch to a CA-side product |
| OCR is poor on phone photos | Everything lands in review, and the effort goes back up | Golden set first; accept review-heavy output rather than wrong categories |
| WhatsApp share target does not work on iPhone | Half the users cannot use the fastest route | State Android-first; keep gallery and camera as fallbacks |
| The hosting limits hit the export again | The demo fails on a real month | Streamed export in M1, tested with a 10 MB pack before anything else is built |
| The CA wants a different format | The pack looks tidy but is unusable | Show the pack to three CAs during M4, not after |

---

## 11. Out of Scope

- Reading SMS, notification text, or WhatsApp message text. These need a phone app, and SMS needs a permission the app store restricts.
- Gmail. It needs a restricted Google scope and a security review measured in weeks.
- Native Android or iOS apps.
- CA accounts, portals, or sharing links.
- GST filing, accounting integrations, bank feeds.
- Multiple users per business, teams, roles.
- Payments and subscriptions.
- Malware scanning, audit logs, retention policy.
- Similar-image duplicate detection.

---

## 12. Decisions I need from you

1. **Timeline.** Four weeks of build, or a two-week cut that stops at M3 (collection and review, no Drive)?
2. **The five testers.** Real owners you can reach in week four, or CA clients introduced through one CA? The second is faster and gives a stronger signal.
3. **Format for the CA.** Is a ZIP with one folder per category what your CA actually wants, or do they want a single PDF index plus files?

---

## 13. Further Notes

A working demo of the loop already exists in `demo/` and runs with no installation. It reads a CA's WhatsApp message, turns it into an August job with a six-item checklist, discovers 18 files across simulated sources, sorts 9 automatically, catches 1 duplicate, ignores 3 non-documents, queues 4 for review, and produces a 13-document ZIP with a folder per category, the original request, and a coverage file. Of the CA's six asks it covers four, cannot confirm one (the laptop invoice is an unread scan), and reports one as missing (the bank statement). It is the reference behaviour for M2 and M4, and it is how the flow can be shown before the web version is finished.

What the demo does not do is read PDFs or photos; it judges them by filename. That is the gap M3 closes, and the laptop invoice in the demo is the concrete example: the file is almost certainly in the folder, but without OCR the system will not claim it. It should be described that way in any demonstration.

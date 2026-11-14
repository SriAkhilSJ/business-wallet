# BusinessVault — Product Specification (POC)

Status: Proof of Concept
Date: 2026-11-14

## 1. Problem Statement (Hypothesis)

Business owners frequently struggle to collect and organize their financial
documents. Important documents are scattered across mobile galleries, WhatsApp
threads, email attachments, SMS messages, PDF folders and physical receipts.

At the end of each month, Chartered Accountants (CAs) request bills, receipts,
invoices and payment proofs. Owners spend considerable time searching,
collecting and sharing those documents, which can result in delays, missing
records and administrative stress.

> **Note:** This is an initial problem hypothesis. The market has **not** been
> validated. This POC exists to test whether centralized monthly document
> collection and sharing is useful.

## 2. Product Summary

BusinessVault is a business financial document management web application.
A business owner uploads bills, invoices and receipts into one place, organizes
them by month and category, and exports a month's documents as a single ZIP
file to share with their CA.

Core workflow this POC demonstrates:

```
UPLOAD → ORGANIZE → FILTER BY MONTH → DOWNLOAD ZIP → SHARE WITH CA (manual)
```

## 3. POC Objective

Demonstrate that monthly document collection and sharing can become easier
through one centralized application.

This is **not** the complete commercial product.

## 4. Users (POC)

| User | Need in POC |
| --- | --- |
| Business owner | Upload, organize, filter and export own documents |
| CA (indirect) | Receives a well-organized monthly ZIP (manual handover) |

No CA accounts, portals or collaboration features are in scope.

## 5. Features

### A. Landing page
- BusinessVault branding, product description.
- Explanation of the monthly document workflow.
- Sign in / Get started calls to action.

### B. Authentication
- Sign up, sign in, sign out.
- Protected dashboard routes (server-enforced).
- Supabase Auth when configured; clearly documented development fallback
  (NOT production-secure) for local UI/workflow testing when credentials
  are unavailable.

### C. Dashboard
- Total documents, current-month documents, recent uploads, category summaries.
- Upload button, month/year selector, category filter, search field.
- Document list with empty / loading / error states.
- Responsive desktop and mobile layout.

### D. Document upload
- File types: PDF, JPG, JPEG, PNG. Multiple files per submission.
- Metadata per document: original filename, document date, category, file
  type (MIME), file size, upload timestamp.
- Categories: Sales Invoice, Purchase Invoice, Expense, Receipt, Utility Bill,
  Payment Proof, Other.
- If no document date is given, the upload date is used as the fallback and
  this is clearly communicated in the UI.
- Server-side validation of extensions, MIME types, magic bytes, file size,
  file count and empty/invalid input. Browser-side validation is convenience
  only.

### E. Document management
- List, search (filename), filter (category / month / year).
- Preview for images and PDFs.
- Show document date and upload date.
- Delete own documents with confirmation (database record + storage object).

### F. Monthly filtering
- Month/year selector (e.g. "November 2026").
- Documents are grouped by **document date**; when a document has no document
  date, its **upload date** is used as a documented fallback.
- Dates are handled as calendar dates (no timezone shifting).

### G. Monthly ZIP export
- Real ZIP download, e.g. `BusinessVault_November_2026.zip`.
- Contains all eligible documents of the selected month, original filenames
  where possible, unique safe names when duplicates exist, plus a manifest.
- Server-side authorization; only the selected month's documents.
- Missing storage objects abort the export with a clear error — never a
  silently incomplete archive.
- No permanent public storage URLs.

### H. CA handover
- Manual sharing: the owner downloads the ZIP and sends it via their preferred
  channel. No CA accounts or integrations in the POC.

## 6. Out of Scope (POC)

WhatsApp / SMS / email integrations, notification or gallery collection, OCR,
AI extraction/classification, GST calculation/filing, bank or accounting
integrations, payment gateways, subscription billing, advanced analytics.

The architecture keeps a clean document-management core so such integrations
can be added later without a rewrite.

## 7. Success Criteria

1. Website opens successfully.
2. Dashboard works.
3. PDF upload works.
4. Image upload works.
5. Uploaded documents appear in the list.
6. Month/year filtering works.
7. Category filtering works.
8. Real monthly ZIP downloads.
9. ZIP contains the correct documents.
10. Duplicate filenames are handled.
11. Unauthorized document access is prevented.
12. Sample documents can demonstrate the workflow.
13. README provides setup instructions.
14. Tests are executed and results documented.

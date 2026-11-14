# Sample Documents

10 fictional PDF bills, invoices and receipts for demonstrating BusinessVault.

**Every document is watermarked "SAMPLE — NOT A REAL TAX INVOICE" and uses
fictional businesses, addresses, invoice numbers, amounts and tax identifiers.
No real GSTINs, people or companies are used. Do not use these for tax or
accounting purposes.**

Regenerate with `npm run samples:generate` (writes `manifest.json` too).

| # | File | Category | Document date | Description |
| --- | --- | --- | --- | --- |
| 1 | sample-01-office-rent-invoice.pdf | Expense | 2026-10-05 | Office rent invoice (Oct 2026) |
| 2 | sample-02-electricity-bill.pdf | Utility Bill | 2026-10-18 | Electricity bill |
| 3 | sample-03-internet-bill.pdf | Utility Bill | 2026-11-03 | Internet / broadband bill |
| 4 | sample-04-laptop-purchase-invoice.pdf | Purchase Invoice | 2026-10-22 | Laptop purchase invoice |
| 5 | sample-05-office-supplies-receipt.pdf | Receipt | 2026-11-07 | Office supplies receipt |
| 6 | sample-06-client-sales-invoice.pdf | Sales Invoice | 2026-11-10 | Client sales invoice |
| 7 | sample-07-fuel-receipt.pdf | Receipt | 2026-11-12 | Fuel receipt |
| 8 | sample-08-software-subscription-invoice.pdf | Expense | 2026-10-30 | Software subscription invoice |
| 9 | sample-09-equipment-purchase-bill.pdf | Purchase Invoice | 2026-11-13 | Equipment purchase bill |
| 10 | sample-10-payment-receipt.pdf | Payment Proof | 2026-10-15 | Payment receipt |

Dates are deliberately spread across **October and November 2026** so the
month filter and the monthly ZIP export can be demonstrated.

## Loading them into the app

- **Dev-fallback mode (no Supabase):** click **"Load sample documents"** in the
  amber banner on the dashboard (calls `POST /api/dev/load-samples`).
  Already-loaded samples are skipped, so clicking twice is safe.
- **Supabase mode:** `npm run samples:upload -- --email=you@example.com`
  (requires `SUPABASE_SERVICE_ROLE_KEY`; uploads only to the explicitly named
  user's business — never automatic).

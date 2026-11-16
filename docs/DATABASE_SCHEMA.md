# BusinessVault — Database Schema

PostgreSQL (Supabase). Migrations live in `supabase/migrations/`.

## 1. Tables

### `profiles`
| Column | Type | Constraints |
| --- | --- | --- |
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| full_name | text | NOT NULL, length 1–120 |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

### `businesses`
| Column | Type | Constraints |
| --- | --- | --- |
| id | uuid | PK DEFAULT gen_random_uuid() |
| owner_id | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| business_name | text | NOT NULL, length 1–160 |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

Index: `idx_businesses_owner` on `owner_id`.

### `documents`
| Column | Type | Constraints |
| --- | --- | --- |
| id | uuid | PK DEFAULT gen_random_uuid() |
| business_id | uuid | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE |
| uploaded_by | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| original_filename | text | NOT NULL, length 1–255 |
| storage_path | text | NOT NULL, UNIQUE |
| mime_type | text | NOT NULL IN (application/pdf, image/jpeg, image/png, text/plain) |
| file_size | bigint | NOT NULL, > 0 AND ≤ 10485760 (10 MB) |
| document_date | date | NULL — calendar date; NULL means "use upload date" |
| category | text | NOT NULL IN (Sales Invoice, Purchase Invoice, Expense, Receipt, Utility Bill, Payment Proof, Other) |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

Indexes:
- `idx_documents_business` on `(business_id)`
- `idx_documents_business_date` on `(business_id, document_date)`
- `idx_documents_category` on `(business_id, category)`

## 2. Relationships

```
auth.users 1 ── * businesses          (owner_id)
auth.users 1 ── * documents           (uploaded_by)
businesses 1 ── * documents           (business_id, ON DELETE CASCADE)
```

Referential integrity is enforced with foreign keys. Application code uses
The effective date of a document is `document_date` when present. Documents without a read
date are not attributed to the upload month; they are excluded from month-scoped exports and
listed separately in the coverage report, so nothing is silently dated to the upload day.

## 3. Row Level Security

RLS is enabled on `profiles`, `businesses` and `documents`. All policies are
`USING (owner_id = auth.uid())` style — a user can only read or mutate rows
for businesses they own; `documents` access is derived via its `business_id`.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | own row (`id = auth.uid()`) | own row | own row | own row |
| businesses | own (`owner_id = auth.uid()`) | own | own | own |
| documents | via owning business | via owning business | via owning business | via owning business |

Storage policies (bucket `business-documents`, private):
- SELECT/INSERT/DELETE on `storage.objects` restricted to rows where
  `bucket_id = 'business-documents'` **and** the first path segment
  (`(storage.foldername(name))[1]`) equals the id of a business owned by
  `auth.uid()`.

Defense in depth: even though RLS is active, every API route independently
verifies ownership in application code before reading, exporting or deleting.

## 4. Storage Layout

Private bucket `business-documents`:

```
business-documents/
  <business-id>/
    <YYYY>/
      <MM>/
        <uuid>.<ext>
```

Example: `business-documents/8f1c…/2026/11/5b2a….pdf`

The full object path is stored in `documents.storage_path`. No binary file
data is stored in PostgreSQL. No object is ever publicly readable; access is
via short-lived signed URLs or authorized server-side streaming.

## 5. Migrations

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261114000001_init_schema.sql` | Tables, constraints, indexes, triggers, RLS policies |
| `supabase/migrations/20261114000002_storage_bucket.sql` | Private bucket + storage RLS policies |
| `supabase/migrations/20261115000001_classification.sql` | Classification fields (amount, vendor, gstin, confidence, classified_by) |
| `supabase/migrations/20261116000001_text_documents.sql` | Allow text/plain documents |
| `supabase/migrations/20261117000001_content_hash.sql` | Content hash column + lookup index for duplicate detection |

Apply via the Supabase CLI (`supabase db push`) or by pasting into the
Supabase SQL editor — see README "Supabase setup".

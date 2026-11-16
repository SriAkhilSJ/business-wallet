-- BusinessVault — classification fields
-- Adds what a vision model returns, so a document can be filed without a human
-- telling the app what it is.

alter table public.documents
  add column if not exists amount        numeric(14, 2),
  add column if not exists vendor        text,
  add column if not exists gstin         text,
  add column if not exists confidence    numeric(3, 2),
  add column if not exists classified_by text;

comment on column public.documents.amount is
  'Grand total read from the document, in rupees. NULL until something reads it.';
comment on column public.documents.confidence is
  'Model confidence 0..1 for the classification. NULL when a human chose the category.';
comment on column public.documents.classified_by is
  'Which model produced the classification. NULL means a human or the uploader chose it.';

create index if not exists idx_documents_business_amount
  on public.documents (business_id, amount);

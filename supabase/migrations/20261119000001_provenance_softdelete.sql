-- BusinessVault — provenance and soft delete
-- Records where a document came from and keeps a deletion marker instead of
-- destroying the original.

alter table public.documents
  add column if not exists source_type        text,
  add column if not exists source_account     text,
  add column if not exists source_file_id     text,
  add column if not exists imported_at        timestamptz,
  add column if not exists processing_status  text,
  add column if not exists verification_status text,
  add column if not exists duplicate_group_id uuid,
  add column if not exists deleted_at         timestamptz;

comment on column public.documents.source_type is
  'Where the document came from (upload, sample, gmail, drive, device, ...).';
comment on column public.documents.deleted_at is
  'Soft delete marker. NULL means the document is live.';

create index if not exists idx_documents_business_deleted
  on public.documents (business_id, deleted_at);

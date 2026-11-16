-- BusinessVault — content hash for duplicate detection
-- Two uploads of the same file are the same document. The hash is computed on
-- the server from the bytes, never sent by the client.

alter table public.documents
  add column if not exists content_hash text;

-- One copy of any given file per business. Partial index so rows written
-- before this migration (hash NULL) do not collide.
create unique index if not exists idx_documents_business_hash
  on public.documents (business_id, content_hash)
  where content_hash is not null;

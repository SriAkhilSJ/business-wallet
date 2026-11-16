-- BusinessVault — make content hash a lookup index, not a unique constraint
-- Repeated uploads of the same file (including cross-source imports) must not
-- be rejected. Exact duplicates are detected in application code and grouped;
-- the database only needs a fast lookup index.

drop index if exists public.idx_documents_business_hash;

create index if not exists idx_documents_business_hash
  on public.documents (business_id, content_hash)
  where content_hash is not null;
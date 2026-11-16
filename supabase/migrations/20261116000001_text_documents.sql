-- BusinessVault — allow plain text documents
-- Owners export SMS alerts and bank messages as .txt; those are financial
-- records too and must be storable and readable like any other document.

alter table public.documents drop constraint if exists documents_mime_type_check;

alter table public.documents add constraint documents_mime_type_check
  check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'text/plain'));

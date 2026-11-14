-- BusinessVault — private storage bucket + storage RLS
-- Bucket: business-documents (PRIVATE — never public).
-- Object layout: <business-id>/<YYYY>/<MM>/<uuid>.<ext>

insert into storage.buckets (id, name, public)
values ('business-documents', 'business-documents', false)
on conflict (id) do update set public = false;

-- Access is restricted to the owner of the business named by the first
-- path segment of the object (its business id).

drop policy if exists business_documents_select on storage.objects;
create policy business_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-documents'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists business_documents_insert on storage.objects;
create policy business_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-documents'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists business_documents_delete on storage.objects;
create policy business_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-documents'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );

-- BusinessVault — initial schema
-- PostgreSQL (Supabase). Apply with `supabase db push` or the SQL editor.

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 160),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_businesses_owner
  on public.businesses (owner_id);

create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  uploaded_by       uuid not null references auth.users (id) on delete cascade,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path      text not null unique,
  mime_type         text not null check (
                      mime_type in ('application/pdf', 'image/jpeg', 'image/png')
                    ),
  file_size         bigint not null check (file_size > 0 and file_size <= 10485760),
  -- Calendar date (no time / timezone). NULL = "use the upload date".
  document_date     date,
  category          text not null check (
                      category in (
                        'Sales Invoice',
                        'Purchase Invoice',
                        'Expense',
                        'Receipt',
                        'Utility Bill',
                        'Payment Proof',
                        'Other'
                      )
                    ),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_documents_business
  on public.documents (business_id);
create index if not exists idx_documents_business_date
  on public.documents (business_id, document_date);
create index if not exists idx_documents_category
  on public.documents (business_id, category);

-- ------------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- A user may only touch rows for businesses they own. Application code
-- also checks ownership explicitly (defense in depth).
-- ------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.documents enable row level security;

-- profiles: own row only
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = auth.uid());

-- businesses: own businesses only
drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists businesses_insert_own on public.businesses;
create policy businesses_insert_own on public.businesses
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists businesses_update_own on public.businesses;
create policy businesses_update_own on public.businesses
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists businesses_delete_own on public.businesses;
create policy businesses_delete_own on public.businesses
  for delete to authenticated using (owner_id = auth.uid());

-- documents: only via a business the caller owns
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents
  for select to authenticated using (
    exists (
      select 1 from public.businesses b
      where b.id = documents.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents
  for insert to authenticated with check (
    exists (
      select 1 from public.businesses b
      where b.id = documents.business_id
        and b.owner_id = auth.uid()
    )
    and uploaded_by = auth.uid()
  );

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own on public.documents
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = documents.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = documents.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents
  for delete to authenticated using (
    exists (
      select 1 from public.businesses b
      where b.id = documents.business_id
        and b.owner_id = auth.uid()
    )
  );

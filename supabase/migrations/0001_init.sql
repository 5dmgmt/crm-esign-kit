create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  last_name text not null default '',
  first_name text not null default '',
  company_name text not null default '',
  job_title text not null default '',
  email text unique,
  phone text not null default '',
  postal_code text not null default '',
  address text not null default '',
  tags text[] not null default '{}',
  stage text not null default '見込み',
  status text not null default 'active' check (status in ('active', 'archived')),
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  note_type text not null default 'note',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('meeting', 'phone', 'email', 'note')),
  occurred_at timestamptz not null default now(),
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  version text not null default '1',
  source_url text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url is not null or storage_path is not null)
);

create table public.document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  interaction_id uuid references public.interactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (contact_id is not null or interaction_id is not null),
  unique nulls not distinct (document_id, contact_id, interaction_id)
);

create table public.esign_documents (
  id uuid primary key default gen_random_uuid(),
  doc_number bigint generated always as identity unique,
  contact_id uuid references public.contacts(id) on delete set null,
  template_id text not null,
  template_version text not null,
  fields jsonb not null default '{}'::jsonb,
  client_kind text not null check (client_kind in ('individual', 'corporation')),
  stage_tag_on_sign text,
  title text not null,
  client_company text not null default '',
  client_representative text not null,
  client_email text not null,
  contract_html text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'sent' check (status in ('sent', 'signed', 'void')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  client_signed_at timestamptz,
  client_sign_company text,
  client_sign_name text,
  client_sign_ip text,
  client_sign_ua text,
  issuer_signed_at timestamptz not null default now(),
  issuer_name text not null,
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();
create trigger contact_notes_set_updated_at before update on public.contact_notes
for each row execute function public.set_updated_at();
create trigger interactions_set_updated_at before update on public.interactions
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();
create trigger esign_documents_set_updated_at before update on public.esign_documents
for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
for each row execute function public.set_updated_at();

create index contacts_status_stage_idx on public.contacts (status, stage);
create index contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);
create index interactions_contact_idx on public.interactions (contact_id, occurred_at desc);
create index documents_contact_idx on public.documents (contact_id, created_at desc);
create index esign_documents_contact_idx on public.esign_documents (contact_id, created_at desc);
create index esign_documents_status_idx on public.esign_documents (status, created_at desc);
create index esign_documents_token_hash_idx on public.esign_documents (token_hash);

alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.interactions enable row level security;
alter table public.documents enable row level security;
alter table public.document_links enable row level security;
alter table public.esign_documents enable row level security;
alter table public.settings enable row level security;

create policy contacts_service_role on public.contacts for all to service_role using (true) with check (true);
create policy contact_notes_service_role on public.contact_notes for all to service_role using (true) with check (true);
create policy interactions_service_role on public.interactions for all to service_role using (true) with check (true);
create policy documents_service_role on public.documents for all to service_role using (true) with check (true);
create policy document_links_service_role on public.document_links for all to service_role using (true) with check (true);
create policy esign_documents_service_role on public.esign_documents for all to service_role using (true) with check (true);
create policy settings_service_role on public.settings for all to service_role using (true) with check (true);

revoke all on public.contacts, public.contact_notes, public.interactions, public.documents,
  public.document_links, public.esign_documents, public.settings from anon, authenticated;
grant all on public.contacts, public.contact_notes, public.interactions, public.documents,
  public.document_links, public.esign_documents, public.settings to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into storage.buckets (id, name, public)
values ('crm-documents', 'crm-documents', false)
on conflict (id) do update set public = false;

create policy crm_documents_storage_service_role
on storage.objects for all to service_role
using (bucket_id = 'crm-documents')
with check (bucket_id = 'crm-documents');

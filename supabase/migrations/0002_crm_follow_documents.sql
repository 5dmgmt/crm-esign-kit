alter table public.contact_notes
  add column if not exists due_on date,
  add column if not exists done_at timestamptz;

alter table public.documents
  add column if not exists original_file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

alter table public.contact_notes
  drop constraint if exists contact_notes_note_type_check;
alter table public.contact_notes
  add constraint contact_notes_note_type_check
  check (note_type in ('note', 'meeting', 'follow'));

create index if not exists contact_notes_follow_due_idx
  on public.contact_notes (due_on, done_at)
  where note_type = 'follow';
create index if not exists contacts_updated_idx
  on public.contacts (updated_at desc);


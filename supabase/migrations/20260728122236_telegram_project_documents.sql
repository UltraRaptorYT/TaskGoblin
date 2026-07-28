create table public.taskgoblin_project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  source_telegram_message_id uuid not null unique references public.taskgoblin_telegram_messages(id) on delete cascade,
  telegram_file_id text not null,
  telegram_file_unique_id text not null,
  filename text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  parse_status text not null check (parse_status in ('processed', 'failed')),
  extracted_text text not null default '',
  was_truncated boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index taskgoblin_project_documents_context_idx
  on public.taskgoblin_project_documents(project_id, created_at desc)
  where parse_status = 'processed';

alter table public.taskgoblin_project_documents enable row level security;

revoke all on public.taskgoblin_project_documents from anon, authenticated;
grant select, insert, update on public.taskgoblin_project_documents to service_role;

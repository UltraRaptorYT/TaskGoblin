create extension if not exists "pgcrypto";

create table public.taskgoblin_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taskgoblin_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.taskgoblin_workspaces(id) on delete cascade,
  name text not null,
  description text,
  source text not null default 'telegram',
  health_score numeric not null default 0 check (health_score between 0 and 100),
  health_label text not null default 'Unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taskgoblin_telegram_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  chat_id text not null,
  chat_name text not null,
  chat_type text not null,
  source_filename text not null,
  import_status text not null default 'uploaded' check (import_status in ('uploaded','parsed','scanning','scanned','failed')),
  parser_version text not null,
  message_count integer not null default 0 check (message_count >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

create table public.taskgoblin_chat_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  display_name text not null,
  telegram_user_id text,
  telegram_username text,
  created_at timestamptz not null default now()
);

create table public.taskgoblin_telegram_messages (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.taskgoblin_telegram_imports(id) on delete cascade,
  telegram_message_id bigint not null,
  message_type text not null,
  sent_at timestamptz,
  sender_name text,
  sender_telegram_id text,
  plain_text text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_id, telegram_message_id)
);

create table public.taskgoblin_scan_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  telegram_import_id uuid references public.taskgoblin_telegram_imports(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  model text not null,
  prompt_version text not null,
  raw_output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.taskgoblin_tasks (
  id text primary key,
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  scan_run_id uuid references public.taskgoblin_scan_runs(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'backlog' check (status in ('backlog','todo','doing','blocked','overdue','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  source_participant_name text,
  due_label text,
  due_at timestamptz,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  blocked_by text,
  source_message_ids bigint[] not null default '{}',
  source_snippet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taskgoblin_project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  event_type text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.taskgoblin_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.taskgoblin_tasks(id) on delete cascade,
  channel text not null default 'telegram' check (channel in ('telegram','email','calendar','in_app')),
  tone text not null default 'friendly',
  message text not null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.taskgoblin_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.taskgoblin_reminders(id) on delete set null,
  channel text not null default 'telegram',
  provider_message_id text,
  status text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index taskgoblin_projects_workspace_idx on public.taskgoblin_projects(workspace_id);
create index taskgoblin_imports_project_idx on public.taskgoblin_telegram_imports(project_id);
create index taskgoblin_messages_import_idx on public.taskgoblin_telegram_messages(import_id);
create index taskgoblin_tasks_project_status_idx on public.taskgoblin_tasks(project_id, status);
create index taskgoblin_reminders_task_schedule_idx on public.taskgoblin_reminders(task_id, scheduled_for);

alter table public.taskgoblin_workspaces enable row level security;
alter table public.taskgoblin_projects enable row level security;
alter table public.taskgoblin_telegram_imports enable row level security;
alter table public.taskgoblin_chat_participants enable row level security;
alter table public.taskgoblin_telegram_messages enable row level security;
alter table public.taskgoblin_scan_runs enable row level security;
alter table public.taskgoblin_tasks enable row level security;
alter table public.taskgoblin_project_events enable row level security;
alter table public.taskgoblin_reminders enable row level security;
alter table public.taskgoblin_notification_deliveries enable row level security;

create policy "owners_manage_taskgoblin_workspaces" on public.taskgoblin_workspaces
  for all to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "owners_manage_taskgoblin_projects" on public.taskgoblin_projects
  for all to authenticated
  using (exists (select 1 from public.taskgoblin_workspaces w where w.id = workspace_id and w.created_by = (select auth.uid())))
  with check (exists (select 1 from public.taskgoblin_workspaces w where w.id = workspace_id and w.created_by = (select auth.uid())));

create policy "owners_manage_taskgoblin_tasks" on public.taskgoblin_tasks
  for all to authenticated
  using (exists (select 1 from public.taskgoblin_projects p join public.taskgoblin_workspaces w on w.id = p.workspace_id where p.id = project_id and w.created_by = (select auth.uid())))
  with check (exists (select 1 from public.taskgoblin_projects p join public.taskgoblin_workspaces w on w.id = p.workspace_id where p.id = project_id and w.created_by = (select auth.uid())));

grant select, insert, update, delete on all tables in schema public to authenticated;

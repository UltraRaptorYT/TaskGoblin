create extension if not exists "pgcrypto";

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.project_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.task_status as enum ('backlog', 'todo', 'doing', 'blocked', 'done', 'overdue');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.import_status as enum ('uploaded', 'parsed', 'scanning', 'scanned', 'failed');
create type public.scan_status as enum ('queued', 'running', 'completed', 'failed');
create type public.reminder_status as enum ('scheduled', 'sent', 'failed', 'cancelled');
create type public.notification_channel as enum ('telegram', 'email', 'calendar', 'in_app');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  telegram_user_id text unique,
  telegram_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  source text not null default 'telegram',
  health_score numeric not null default 0,
  health_label text not null default 'Unknown',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.project_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create table public.telegram_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  chat_id text not null,
  chat_name text not null,
  chat_type text not null,
  source_filename text not null,
  import_status public.import_status not null default 'uploaded',
  parser_version text not null,
  message_count integer not null default 0,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  telegram_user_id text,
  telegram_username text,
  created_at timestamptz not null default now()
);

create table public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.telegram_imports(id) on delete cascade,
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

create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  telegram_import_id uuid references public.telegram_imports(id) on delete set null,
  status public.scan_status not null default 'queued',
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  raw_output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.tasks (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'backlog',
  priority public.task_priority not null default 'medium',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  source_participant_name text,
  due_label text,
  due_at timestamptz,
  confidence numeric not null default 0,
  blocked_by text,
  source_message_ids bigint[] not null default '{}',
  source_snippet text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decisions (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  text text not null,
  source text,
  source_message_ids bigint[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.questions (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  text text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  source_participant_name text,
  source_message_ids bigint[] not null default '{}',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.risks (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  type text not null,
  severity text not null,
  message text not null,
  reason text,
  source_message_ids bigint[] not null default '{}',
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blockers (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  message text not null,
  blocked_by text,
  source_message_ids bigint[] not null default '{}',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.tasks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.tasks(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  channel public.notification_channel not null default 'telegram',
  tone text not null default 'friendly',
  message text not null,
  scheduled_for timestamptz not null,
  status public.reminder_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.reminders(id) on delete set null,
  channel public.notification_channel not null default 'telegram',
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  provider_message_id text,
  status text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index on public.projects(workspace_id);
create index on public.telegram_imports(project_id);
create index on public.telegram_messages(import_id);
create index on public.tasks(project_id, status);
create index on public.reminders(task_id, scheduled_for);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_project_admin(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.profile_id = auth.uid()
      and pm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.telegram_imports enable row level security;
alter table public.chat_participants enable row level security;
alter table public.telegram_messages enable row level security;
alter table public.scan_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.decisions enable row level security;
alter table public.questions enable row level security;
alter table public.risks enable row level security;
alter table public.blockers enable row level security;
alter table public.task_comments enable row level security;
alter table public.project_events enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_members" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspace_members_select_members" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "projects_select_members" on public.projects
  for select using (public.is_project_member(id));
create policy "projects_update_admins" on public.projects
  for update using (public.is_project_admin(id)) with check (public.is_project_admin(id));
create policy "project_members_select_members" on public.project_members
  for select using (public.is_project_member(project_id));
create policy "project_members_manage_admins" on public.project_members
  for all using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));

create policy "telegram_imports_project_members" on public.telegram_imports
  for select using (public.is_project_member(project_id));
create policy "chat_participants_project_members" on public.chat_participants
  for select using (public.is_project_member(project_id));
create policy "scan_runs_project_members" on public.scan_runs
  for select using (public.is_project_member(project_id));
create policy "tasks_project_members_select" on public.tasks
  for select using (public.is_project_member(project_id));
create policy "tasks_project_members_update" on public.tasks
  for update using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "decisions_project_members" on public.decisions
  for select using (public.is_project_member(project_id));
create policy "questions_project_members" on public.questions
  for select using (public.is_project_member(project_id));
create policy "risks_project_members" on public.risks
  for select using (public.is_project_member(project_id));
create policy "blockers_project_members" on public.blockers
  for select using (public.is_project_member(project_id));
create policy "task_comments_project_members" on public.task_comments
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and public.is_project_member(t.project_id)
    )
  );
create policy "project_events_project_members" on public.project_events
  for select using (public.is_project_member(project_id));
create policy "reminders_project_members" on public.reminders
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = reminders.task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "telegram_messages_project_members" on public.telegram_messages
  for select using (
    exists (
      select 1 from public.telegram_imports ti
      where ti.id = telegram_messages.import_id
        and public.is_project_member(ti.project_id)
    )
  );

create policy "notification_deliveries_recipient" on public.notification_deliveries
  for select using (recipient_profile_id = auth.uid());

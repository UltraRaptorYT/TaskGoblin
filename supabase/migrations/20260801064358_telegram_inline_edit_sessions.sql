create table public.taskgoblin_telegram_edit_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  telegram_chat_record_id uuid not null references public.taskgoblin_telegram_chats(id) on delete cascade,
  telegram_user_id uuid not null references public.taskgoblin_telegram_users(id) on delete cascade,
  target_kind text not null check (target_kind in ('task', 'project_event_candidate')),
  target_id text not null,
  field_name text not null check (field_name in ('title', 'owner')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index taskgoblin_telegram_edit_sessions_active_idx
  on public.taskgoblin_telegram_edit_sessions(
    telegram_chat_record_id,
    telegram_user_id
  )
  where consumed_at is null;

create index taskgoblin_telegram_edit_sessions_expiry_idx
  on public.taskgoblin_telegram_edit_sessions(expires_at)
  where consumed_at is null;

alter table public.taskgoblin_telegram_edit_sessions enable row level security;

revoke all on public.taskgoblin_telegram_edit_sessions from anon, authenticated;
grant select, insert, update, delete on public.taskgoblin_telegram_edit_sessions to service_role;

alter table public.taskgoblin_tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

comment on column public.taskgoblin_tasks.subtasks is
  'Atomic implementation steps extracted for a parent task.';

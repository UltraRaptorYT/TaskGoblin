create index taskgoblin_tasks_telegram_owner_updated_idx
  on public.taskgoblin_tasks(owner_telegram_user_id, updated_at desc)
  where owner_telegram_user_id is not null;

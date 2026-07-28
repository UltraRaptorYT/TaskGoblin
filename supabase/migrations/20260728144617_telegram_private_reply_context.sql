alter table public.taskgoblin_notification_deliveries
  add column recipient_telegram_chat_id bigint;

update public.taskgoblin_notification_deliveries
set recipient_telegram_chat_id =
  (provider_payload #>> '{result,chat,id}')::bigint
where channel = 'telegram'
  and recipient_telegram_chat_id is null
  and (provider_payload #>> '{result,chat,id}') ~ '^-?[0-9]+$';

create index taskgoblin_notification_delivery_telegram_reply_idx
  on public.taskgoblin_notification_deliveries(
    recipient_telegram_chat_id,
    provider_message_id
  )
  where channel = 'telegram'
    and status = 'sent'
    and provider_message_id is not null
    and recipient_telegram_chat_id is not null;

comment on column public.taskgoblin_notification_deliveries.recipient_telegram_chat_id is
  'Telegram chat that received the outbound message. Combined with provider_message_id to resolve private reminder replies safely.';

import { NextResponse } from "next/server";

import { generateAccountabilityMessage } from "@/lib/accountability";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!supabase || !chatId) {
    return NextResponse.json({ error: "Supabase or Telegram is not configured." }, { status: 503 });
  }

  const { data: reminders, error } = await supabase
    .from("taskgoblin_reminders")
    .select("id, task_id, tone, taskgoblin_tasks(*)")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const reminder of reminders ?? []) {
    const row = Array.isArray(reminder.taskgoblin_tasks) ? reminder.taskgoblin_tasks[0] : reminder.taskgoblin_tasks;
    if (!row) continue;
    const task: TaskItem = {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      owner: row.source_participant_name,
      deadline: row.due_label ?? row.due_at,
      status: row.status,
      priority: row.priority,
      confidence: Number(row.confidence),
      blockedBy: row.blocked_by ?? undefined,
      sourceMessageIds: row.source_message_ids ?? [],
      sourceSnippet: row.source_snippet ?? undefined,
      subtasks: row.subtasks ?? [],
    };
    const message = await generateAccountabilityMessage(task, reminder.tone as AccountabilityTone);
    const delivery = await sendTelegramMessage(chatId, message);
    await supabase.from("taskgoblin_reminders").update({ message, status: delivery.sent ? "sent" : "failed", sent_at: delivery.sent ? new Date().toISOString() : null }).eq("id", reminder.id);
    await supabase.from("taskgoblin_notification_deliveries").insert({ reminder_id: reminder.id, channel: "telegram", provider_message_id: delivery.messageId ? String(delivery.messageId) : null, status: delivery.sent ? "sent" : "failed", provider_payload: delivery.providerPayload ?? {}, error_message: delivery.error ?? null });
    if (delivery.sent) sent += 1;
  }

  return NextResponse.json({ processed: reminders?.length ?? 0, sent });
}

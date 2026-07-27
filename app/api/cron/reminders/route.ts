import { NextResponse } from "next/server";

import { generateAccountabilityMessage } from "@/lib/accountability";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  sendTelegramMessage,
  type TelegramDelivery,
} from "@/lib/telegram-bot";
import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

type ReminderTaskRow = {
  id: string;
  title: string;
  description: string | null;
  source_participant_name: string | null;
  owner_telegram_user_id: string | null;
  due_label: string | null;
  due_at: string | null;
  status: TaskItem["status"];
  priority: TaskItem["priority"];
  confidence: number | string;
  blocked_by: string | null;
  source_message_ids: number[] | null;
  source_snippet: string | null;
  subtasks: TaskItem["subtasks"] | null;
};

type DueReminderRow = {
  id: string;
  tone: AccountabilityTone;
  taskgoblin_tasks: ReminderTaskRow | ReminderTaskRow[] | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("taskgoblin_reminders")
    .select("id, task_id, tone, taskgoblin_tasks(*)")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reminders = (data ?? []) as DueReminderRow[];
  const tasks = reminders
    .map((reminder) => reminderTask(reminder))
    .filter((task): task is ReminderTaskRow => Boolean(task));
  const ownerRecordIds = [
    ...new Set(
      tasks
        .map((task) => task.owner_telegram_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const ownersById = new Map<string, string>();

  if (ownerRecordIds.length) {
    const { data: owners, error: ownerError } = await supabase
      .from("taskgoblin_telegram_users")
      .select("id, telegram_user_id")
      .in("id", ownerRecordIds);
    if (ownerError) {
      return NextResponse.json(
        { error: ownerError.message },
        { status: 500 },
      );
    }
    for (const owner of owners ?? []) {
      ownersById.set(String(owner.id), String(owner.telegram_user_id));
    }
  }

  let sent = 0;
  for (const reminder of reminders) {
    const row = reminderTask(reminder);
    let message = "";
    let delivery: TelegramDelivery;

    if (!row) {
      delivery = { sent: false, error: "Reminder task no longer exists." };
    } else {
      const recipientId = row.owner_telegram_user_id
        ? ownersById.get(row.owner_telegram_user_id)
        : null;
      if (!recipientId) {
        delivery = {
          sent: false,
          error: "The task has no linked Telegram owner.",
        };
      } else {
        const task = taskItem(row);
        message = await generateAccountabilityMessage(task, reminder.tone);
        delivery = await sendTelegramMessage(recipientId, message);
      }
    }

    await supabase
      .from("taskgoblin_reminders")
      .update({
        message,
        status: delivery.sent ? "sent" : "failed",
        sent_at: delivery.sent ? new Date().toISOString() : null,
      })
      .eq("id", reminder.id)
      .eq("status", "scheduled");
    await supabase.from("taskgoblin_notification_deliveries").insert({
      reminder_id: reminder.id,
      channel: "telegram",
      provider_message_id: delivery.messageId
        ? String(delivery.messageId)
        : null,
      status: delivery.sent ? "sent" : "failed",
      provider_payload: delivery.providerPayload ?? {},
      error_message: delivery.error ?? null,
    });
    if (delivery.sent) sent += 1;
  }

  return NextResponse.json({ processed: reminders.length, sent });
}

function reminderTask(reminder: DueReminderRow) {
  return Array.isArray(reminder.taskgoblin_tasks)
    ? reminder.taskgoblin_tasks[0] ?? null
    : reminder.taskgoblin_tasks;
}

function taskItem(row: ReminderTaskRow): TaskItem {
  return {
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
}

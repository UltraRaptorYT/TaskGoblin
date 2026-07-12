import { NextResponse } from "next/server";

import { generateAccountabilityMessage } from "@/lib/accountability";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage, type TelegramDelivery } from "@/lib/telegram-bot";
import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

export async function POST(
  request: Request,
  context: RouteContext<"/api/tasks/[id]/reminders">
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    task?: TaskItem;
    tone?: AccountabilityTone;
    scheduledFor?: string;
  };
  const tone = body.tone ?? "friendly";
  const task =
    body.task ??
    ({
      id,
      title: "Task follow-up",
      owner: null,
      deadline: null,
      status: "todo",
      priority: "medium",
      confidence: 0,
      sourceMessageIds: [],
    } satisfies TaskItem);
  const message = await generateAccountabilityMessage(task, tone);
  const supabase = getSupabaseAdmin();
  const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  const delivery: TelegramDelivery = chatId
    ? await sendTelegramMessage(chatId, message)
    : { sent: false, error: "Telegram reminder chat ID is not configured." };

  if (!supabase) {
    return NextResponse.json({
      reminderId: "demo-reminder",
      taskId: id,
      message,
      persisted: false,
      delivered: delivery.sent,
      deliveryError: delivery.error,
    });
  }

  const { data, error } = await supabase
    .from("taskgoblin_reminders")
    .insert({
      task_id: id,
      channel: "telegram",
      tone,
      message,
      scheduled_for: body.scheduledFor ?? new Date().toISOString(),
      status: delivery.sent ? "sent" : "scheduled",
      sent_at: delivery.sent ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({
      message,
      persisted: false,
      delivered: delivery.sent,
      deliveryError: delivery.error,
      persistenceError: error.message,
    });
  }

  if (delivery.sent || delivery.error) {
    await supabase.from("taskgoblin_notification_deliveries").insert({
      reminder_id: data.id,
      channel: "telegram",
      provider_message_id: delivery.messageId
        ? String(delivery.messageId)
        : null,
      status: delivery.sent ? "sent" : "failed",
      provider_payload: delivery.providerPayload ?? {},
      error_message: delivery.error ?? null,
    });
  }

  return NextResponse.json({
    reminder: data,
    message,
    persisted: true,
    delivered: delivery.sent,
    deliveryError: delivery.error,
  });
}

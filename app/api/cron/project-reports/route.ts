import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import { projectHomeMenu } from "@/lib/telegram-command-responses";
import {
  dailyProjectReport,
  singaporeReportDate,
} from "@/lib/telegram-project-report";
import type {
  TelegramProjectRow,
  TelegramTaskRow,
} from "@/lib/telegram-repository";

type ReportChatRow = {
  id: string;
  telegram_chat_id: number | string;
  project_id: string;
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

  const { data: chatRows, error: chatError } = await supabase
    .from("taskgoblin_telegram_chats")
    .select("id, telegram_chat_id, project_id")
    .in("chat_type", ["group", "supergroup"])
    .eq("is_active", true)
    .not("project_id", "is", null)
    .limit(100);
  if (chatError) {
    return NextResponse.json({ error: chatError.message }, { status: 500 });
  }

  const chats = (chatRows ?? []) as ReportChatRow[];
  const projectIds = [...new Set(chats.map((chat) => chat.project_id))];
  if (!projectIds.length) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  const [projectResult, taskResult] = await Promise.all([
    supabase
      .from("taskgoblin_projects")
      .select("id, name, description, health_score, health_label, timezone")
      .in("id", projectIds),
    supabase
      .from("taskgoblin_tasks")
      .select(
        "id, project_id, title, description, status, priority, source_participant_name, due_label, due_at, blocked_by, owner_telegram_user_id, updated_at",
      )
      .in("project_id", projectIds)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (projectResult.error) {
    return NextResponse.json(
      { error: projectResult.error.message },
      { status: 500 },
    );
  }
  if (taskResult.error) {
    return NextResponse.json(
      { error: taskResult.error.message },
      { status: 500 },
    );
  }

  const projects = new Map(
    ((projectResult.data ?? []) as TelegramProjectRow[]).map((project) => [
      project.id,
      project,
    ]),
  );
  const tasksByProject = new Map<string, TelegramTaskRow[]>();
  for (const task of (taskResult.data ?? []) as TelegramTaskRow[]) {
    const tasks = tasksByProject.get(task.project_id) ?? [];
    tasks.push(task);
    tasksByProject.set(task.project_id, tasks);
  }

  const now = new Date();
  const reportDate = singaporeReportDate(now);
  let sent = 0;
  let skipped = 0;

  for (const chat of chats) {
    const project = projects.get(chat.project_id);
    if (!project) {
      skipped += 1;
      continue;
    }

    const { data: deliveryRow, error: claimError } = await supabase
      .from("taskgoblin_project_report_deliveries")
      .insert({
        project_id: project.id,
        telegram_chat_record_id: chat.id,
        report_date: reportDate,
        status: "processing",
      })
      .select("id")
      .single();
    if (claimError) {
      if (claimError.code === "23505") {
        skipped += 1;
        continue;
      }
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    const delivery = await sendTelegramMessage(
      chat.telegram_chat_id,
      dailyProjectReport(project, tasksByProject.get(project.id) ?? [], now),
      { replyMarkup: projectHomeMenu(project) },
    );
    await supabase
      .from("taskgoblin_project_report_deliveries")
      .update({
        status: delivery.sent ? "sent" : "failed",
        provider_message_id: delivery.messageId
          ? String(delivery.messageId)
          : null,
        error_message: delivery.error ?? null,
        sent_at: delivery.sent ? new Date().toISOString() : null,
      })
      .eq("id", deliveryRow.id);
    if (delivery.sent) sent += 1;
  }

  return NextResponse.json({ processed: chats.length, sent, skipped });
}

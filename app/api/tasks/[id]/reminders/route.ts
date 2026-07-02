import { NextResponse } from "next/server";

import { createAccountabilityMessage } from "@/lib/accountability";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
  const message = createAccountabilityMessage(task, tone);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      reminderId: "demo-reminder",
      taskId: id,
      message,
      persisted: false,
    });
  }

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      task_id: id,
      channel: "telegram",
      tone,
      message,
      scheduled_for: body.scheduledFor ?? new Date().toISOString(),
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminder: data, message, persisted: true });
}

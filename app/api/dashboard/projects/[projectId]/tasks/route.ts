import { NextResponse } from "next/server";
import { z } from "zod";

import { getTelegramProjectAdminAccess } from "@/lib/telegram-web-permissions";

const taskCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: z
      .enum(["backlog", "todo", "doing", "blocked", "overdue", "done"])
      .default("backlog"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    ownerTelegramUserId: z.string().uuid().nullable().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: RouteContext<"/api/dashboard/projects/[projectId]/tasks">,
) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Cross-origin task creation is not allowed." },
      { status: 403 },
    );
  }

  const { projectId } = await context.params;
  const access = await getTelegramProjectAdminAccess(projectId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = taskCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  let ownerName: string | null = null;
  if (input.ownerTelegramUserId) {
    const { data: owner, error: ownerError } = await access.admin
      .from("taskgoblin_project_members")
      .select("display_name")
      .eq("project_id", projectId)
      .eq("telegram_user_id", input.ownerTelegramUserId)
      .maybeSingle();
    if (ownerError || !owner) {
      return NextResponse.json(
        { error: "The selected owner is not a member of this project." },
        { status: 400 },
      );
    }
    ownerName = owner.display_name;
  }

  const taskId = crypto.randomUUID();
  const { data: task, error: taskError } = await access.admin
    .from("taskgoblin_tasks")
    .insert({
      id: taskId,
      project_id: projectId,
      title: input.title,
      description: input.description || null,
      status: input.status,
      priority: input.priority,
      owner_telegram_user_id: input.ownerTelegramUserId ?? null,
      source_participant_name: ownerName,
      due_at: input.dueAt ?? null,
      due_label: null,
      confidence: 1,
      source_message_ids: [],
      source_snippet: null,
    })
    .select(
      "id, title, description, status, priority, due_at, due_label, owner_telegram_user_id, source_participant_name",
    )
    .single();

  if (taskError || !task) {
    return NextResponse.json(
      { error: taskError?.message ?? "Task creation failed." },
      { status: 500 },
    );
  }

  const { error: eventError } = await access.admin
    .from("taskgoblin_project_events")
    .insert({
      project_id: projectId,
      event_type: "web_task_created",
      title: `Created task: ${task.title}`,
      metadata: {
        taskId,
        createdByTelegramUserRecordId:
          access.identity.telegramUserRecordId,
        source: "web_dashboard",
      },
    });

  if (eventError) {
    console.error("Could not audit web task creation", eventError);
  }

  return NextResponse.json(
    {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.due_at,
        dueLabel: task.due_label,
        ownerTelegramUserId: task.owner_telegram_user_id,
        ownerName: task.source_participant_name,
      },
      auditPersisted: !eventError,
    },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getTelegramProjectAdminAccess } from "@/lib/telegram-web-permissions";

const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: z
      .enum(["backlog", "todo", "doing", "blocked", "overdue", "done"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    ownerTelegramUserId: z.string().uuid().nullable().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one task field to update.",
  });

export async function PATCH(
  request: Request,
  context: RouteContext<
    "/api/dashboard/projects/[projectId]/tasks/[taskId]"
  >,
) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Cross-origin task updates are not allowed." },
      { status: 403 },
    );
  }

  const { projectId, taskId } = await context.params;
  const access = await getTelegramProjectAdminAccess(projectId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = taskPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task update." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) {
    patch.description = input.description || null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueAt !== undefined) {
    patch.due_at = input.dueAt;
    patch.due_label = null;
  }

  if (input.ownerTelegramUserId !== undefined) {
    patch.owner_telegram_user_id = input.ownerTelegramUserId;
    patch.source_participant_name = null;
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
      patch.source_participant_name = owner.display_name;
    }
  }

  const { data: task, error: taskError } = await access.admin
    .from("taskgoblin_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select(
      "id, title, description, status, priority, due_at, due_label, owner_telegram_user_id, source_participant_name",
    )
    .maybeSingle();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json(
      { error: "Task not found in this project." },
      { status: 404 },
    );
  }

  const changedFields = Object.keys(input);
  const { error: eventError } = await access.admin
    .from("taskgoblin_project_events")
    .insert({
      project_id: projectId,
      event_type: "web_task_updated",
      title: `Updated task: ${task.title}`,
      metadata: {
        taskId,
        changedFields,
        editedByTelegramUserRecordId:
          access.identity.telegramUserRecordId,
        source: "web_dashboard",
      },
    });

  if (eventError) {
    console.error("Could not audit web task update", eventError);
  }

  return NextResponse.json({
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
  });
}

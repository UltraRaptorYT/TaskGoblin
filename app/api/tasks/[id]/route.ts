import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_FIELDS = new Set([
  "status",
  "priority",
  "owner_profile_id",
  "source_participant_name",
  "due_label",
  "due_at",
  "subtasks",
]);

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      taskId: id,
      persisted: false,
      message:
        "Task update accepted in demo mode. Configure Supabase to persist board changes.",
    });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const aliases: Record<string, string> = {
    owner: "source_participant_name",
    deadline: "due_label",
  };
  const patch = Object.fromEntries(
    Object.entries(body)
      .map(([key, value]) => [aliases[key] ?? key, value] as [string, unknown])
      .filter(([key]) => ALLOWED_FIELDS.has(key))
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No supported task fields provided." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("taskgoblin_tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data, persisted: true });
}

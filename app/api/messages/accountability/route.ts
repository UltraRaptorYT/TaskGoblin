import { NextResponse } from "next/server";

import { createAccountabilityMessage } from "@/lib/accountability";
import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    task?: TaskItem;
    tone?: AccountabilityTone;
  } | null;

  if (!body?.task) {
    return NextResponse.json(
      { error: "Provide a task to generate an accountability message." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    tone: body.tone ?? "friendly",
    message: createAccountabilityMessage(body.task, body.tone ?? "friendly"),
  });
}

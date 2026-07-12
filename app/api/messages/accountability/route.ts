import { NextResponse } from "next/server";

import { generateAccountabilityMessage } from "@/lib/accountability";
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

  const tone = body.tone ?? "friendly";
  const message = await generateAccountabilityMessage(body.task, tone);

  return NextResponse.json({ tone, message });
}

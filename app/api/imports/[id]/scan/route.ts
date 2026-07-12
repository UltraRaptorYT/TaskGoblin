import { NextResponse } from "next/server";

import { createMockScanResult } from "@/lib/mock-scan";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { NormalizedTelegramImport } from "@/lib/taskgoblin-types";

export async function POST(
  request: Request,
  context: RouteContext<"/api/imports/[id]/scan">
) {
  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const body = (await request.json().catch(() => null)) as {
      telegramImport?: NormalizedTelegramImport;
    } | null;

    if (!body?.telegramImport) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured. Provide telegramImport in the request body for demo scanning.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      importId: id,
      scan: createMockScanResult(body.telegramImport),
      persisted: false,
    });
  }

  const { data: telegramImport, error } = await supabase
    .from("taskgoblin_telegram_imports")
    .select("id, project_id, chat_name, message_count")
    .eq("id", id)
    .single();

  if (error || !telegramImport) {
    return NextResponse.json(
      { error: "Telegram import not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    importId: id,
    persisted: true,
    status: "already_scanned",
    telegramImport,
  });
}

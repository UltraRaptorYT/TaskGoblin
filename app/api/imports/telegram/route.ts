import { NextResponse } from "next/server";

import { scanTelegramImport } from "@/lib/openai-scan";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeTelegramExport } from "@/lib/telegram-parser";
import { persistTelegramImport } from "@/lib/telegram-import-storage";
import { readTelegramUpload } from "@/lib/telegram-upload";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a Telegram Desktop result.json or ZIP file." },
        { status: 400 }
      );
    }

    const upload = await readTelegramUpload(file);
    const telegramImport = normalizeTelegramExport(upload.json);
    const { result: scan, usedMock, model } =
      await scanTelegramImport(telegramImport);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({
        importId: "demo-import",
        projectId: "demo-project",
        persisted: false,
        usedMock,
        normalized: {
          chatName: telegramImport.chatName,
          messageCount: telegramImport.messages.length,
          participantCount: telegramImport.participants.length,
        },
        scan,
      });
    }

    const persisted = await persistTelegramImport({
      supabase,
      telegramImport,
      scan,
      sourceFilename: upload.filename,
      model,
    });

    return NextResponse.json({
      ...persisted,
      persisted: true,
      usedMock,
      normalized: {
        chatName: telegramImport.chatName,
        messageCount: telegramImport.messages.length,
        participantCount: telegramImport.participants.length,
      },
      scan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import Telegram chat.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { scanProjectBrief } from "@/lib/openai-scan";
import {
  normalizeProjectBrief,
  readProjectBrief,
} from "@/lib/project-brief-parser";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { persistTelegramImport } from "@/lib/telegram-import-storage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a PDF, Word document, Markdown file, or text file." },
        { status: 400 }
      );
    }

    const brief = await readProjectBrief(file);
    const normalized = normalizeProjectBrief(brief);
    const { result: scan, usedMock, model } = await scanProjectBrief(normalized);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({
        importId: "demo-brief-import",
        projectId: "demo-brief-project",
        persisted: false,
        usedMock,
        wasTruncated: brief.wasTruncated,
        normalized: {
          chatName: normalized.chatName,
          messageCount: normalized.messages.length,
          participantCount: 0,
        },
        scan,
      });
    }

    const persisted = await persistTelegramImport({
      supabase,
      telegramImport: normalized,
      scan,
      sourceFilename: brief.filename,
      model,
    });

    return NextResponse.json({
      ...persisted,
      persisted: true,
      usedMock,
      wasTruncated: brief.wasTruncated,
      normalized: {
        chatName: normalized.chatName,
        messageCount: normalized.messages.length,
        participantCount: 0,
      },
      scan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import project brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

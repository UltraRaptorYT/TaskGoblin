import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processTelegramUpdate } from "@/lib/telegram-handler";
import {
  normalizeTelegramUpdate,
  validateTelegramWebhookSecret,
} from "@/lib/telegram-update";

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get(
    "x-telegram-bot-api-secret-token",
  );

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Telegram webhook secret is not configured." },
      { status: 503 },
    );
  }
  if (!validateTelegramWebhookSecret(expectedSecret, receivedSecret)) {
    return NextResponse.json(
      { error: "Invalid webhook secret." },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);
  const normalized = normalizeTelegramUpdate(payload);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  if (!normalized.update) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured for Telegram persistence." },
      { status: 503 },
    );
  }

  try {
    const result = await processTelegramUpdate(supabase, normalized.update);
    return NextResponse.json({
      ok: true,
      persisted: true,
      duplicate: result.duplicate,
      replySent: result.replySent,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Telegram update processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

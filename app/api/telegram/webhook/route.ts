import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram-bot";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number; type?: string; title?: string };
    from?: { first_name?: string; username?: string };
  };
};

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return NextResponse.json({ error: "Invalid Telegram update." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  let replySent = false;

  if (chatId && isCommand(text, "start")) {
    const firstName = update.message?.from?.first_name;
    const delivery = await sendTelegramMessage(
      chatId,
      `${firstName ? `Hey ${firstName}! ` : ""}I’m TaskGoblin. 🧌\n\nI turn project chats into clear tasks, owners, deadlines, and reminders. Add me to a project group, then upload the Telegram export or project brief in TaskGoblin to build your board.\n\nYour personal reminder chat ID is: ${chatId}\nAdd it as TELEGRAM_DEFAULT_CHAT_ID in Vercel.\n\nUse /help to see what I can do.`,
    );
    replySent = delivery.sent;
  } else if (chatId && isCommand(text, "help")) {
    const delivery = await sendTelegramMessage(
      chatId,
      "TaskGoblin commands:\n/start — introduce the bot\n/help — show this guide\n\nLive chat scanning and scheduled Telegram delivery are the next automation steps. You can already import a Telegram result.json or ZIP in the TaskGoblin app.",
    );
    replySent = delivery.sent;
  }

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      replySent,
      message: "Telegram webhook processed in demo mode.",
    });
  }

  const { error } = await supabase.from("taskgoblin_notification_deliveries").insert({
    channel: "telegram",
    status: "received",
    provider_payload: update,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true, replySent });
}

function isCommand(text: string, command: string) {
  return new RegExp(`^/${command}(?:@\\w+)?(?:\\s|$)`, "i").test(text);
}

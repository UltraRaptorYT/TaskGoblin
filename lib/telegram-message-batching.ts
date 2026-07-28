import type { SupabaseClient } from "@supabase/supabase-js";

import { isTelegramCommandLike } from "@/lib/telegram-commands";
import type { TelegramContext } from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const DEFAULT_DEBOUNCE_MS = 2_500;
const MAX_DEBOUNCE_MS = 5_000;
const RAPID_MESSAGE_WINDOW_MS = 30_000;
const MAX_BATCH_MESSAGES = 8;
const MAX_BATCH_CHARACTERS = 4_000;

type RapidMessageRow = {
  telegram_message_id: number | string;
  plain_text: string;
  sent_at: string | null;
};

export type TelegramMessageBatchResult = {
  message: TelegramInboundMessage;
  superseded: boolean;
  messageCount: number;
};

export async function coalesceRapidTelegramMessages(
  supabase: SupabaseClient,
  context: TelegramContext,
  message: TelegramInboundMessage,
  options: {
    delay?: (milliseconds: number) => Promise<void>;
    debounceMs?: number;
  } = {},
): Promise<TelegramMessageBatchResult> {
  if (!shouldCoalesceTelegramMessage(message, context)) {
    return { message, superseded: false, messageCount: 1 };
  }

  const configuredDelay = Number(
    process.env.TELEGRAM_MESSAGE_DEBOUNCE_MS ?? DEFAULT_DEBOUNCE_MS,
  );
  const debounceMs = Math.min(
    Math.max(
      options.debounceMs ??
        (Number.isFinite(configuredDelay)
          ? configuredDelay
          : DEFAULT_DEBOUNCE_MS),
      0,
    ),
    MAX_DEBOUNCE_MS,
  );
  await (options.delay ?? wait)(debounceMs);

  try {
    const sentAt = message.sentAt ? new Date(message.sentAt) : null;
    let query = supabase
      .from("taskgoblin_telegram_messages")
      .select("telegram_message_id, plain_text, sent_at")
      .eq("telegram_chat_record_id", context.chatRecordId!)
      .eq("telegram_user_record_id", context.userRecordId!)
      .in("message_type", ["message", "edited_message"])
      .neq("plain_text", "")
      .order("telegram_message_id", { ascending: false })
      .limit(MAX_BATCH_MESSAGES);
    query =
      message.messageThreadId === null
        ? query.is("message_thread_id", null)
        : query.eq("message_thread_id", message.messageThreadId);
    if (sentAt && !Number.isNaN(sentAt.getTime())) {
      query = query.gte(
        "sent_at",
        new Date(sentAt.getTime() - RAPID_MESSAGE_WINDOW_MS).toISOString(),
      );
    }

    const { data, error } = await query;
    if (error || !data?.length) {
      return { message, superseded: false, messageCount: 1 };
    }
    return buildTelegramMessageBatch(message, data as RapidMessageRow[]);
  } catch {
    return { message, superseded: false, messageCount: 1 };
  }
}

export function buildTelegramMessageBatch(
  message: TelegramInboundMessage,
  rows: RapidMessageRow[],
): TelegramMessageBatchResult {
  const chronological = [...rows]
    .map((row) => ({
      ...row,
      telegramMessageId: Number(row.telegram_message_id),
      text: row.plain_text.replace(/\s+/g, " ").trim(),
    }))
    .filter(
      (row) =>
        Number.isSafeInteger(row.telegramMessageId) &&
        row.text &&
        !isTelegramCommandLike(row.text) &&
        !row.text.startsWith("Telegram document:"),
    )
    .sort((left, right) => left.telegramMessageId - right.telegramMessageId);
  const newest = chronological.at(-1);
  if (!newest || newest.telegramMessageId < message.messageId) {
    return { message, superseded: false, messageCount: 1 };
  }
  if (newest.telegramMessageId > message.messageId) {
    return { message, superseded: true, messageCount: 1 };
  }

  const fragments = chronological.filter(
    (row) => row.telegramMessageId <= message.messageId,
  );
  if (fragments.length < 2) {
    return { message, superseded: false, messageCount: 1 };
  }
  const combinedText = fragments
    .map((row) => row.text)
    .join("\n")
    .slice(0, MAX_BATCH_CHARACTERS);
  return {
    message: { ...message, text: combinedText },
    superseded: false,
    messageCount: fragments.length,
  };
}

function shouldCoalesceTelegramMessage(
  message: TelegramInboundMessage,
  context: TelegramContext,
) {
  return (
    (message.chat.type === "group" || message.chat.type === "supergroup") &&
    message.updateType === "message" &&
    Boolean(context.projectId && context.chatRecordId && context.userRecordId) &&
    Boolean(message.actor && !message.actor.isBot) &&
    !message.document &&
    !message.newChatMembers.length &&
    !isTelegramCommandLike(message.text) &&
    Boolean(message.text.trim())
  );
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

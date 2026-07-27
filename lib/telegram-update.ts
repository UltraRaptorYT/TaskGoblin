import { z } from "zod";

import type {
  TelegramActor,
  TelegramChat,
  TelegramChatType,
  TelegramInboundCallback,
  TelegramInboundMessage,
  TelegramInboundUpdate,
} from "@/lib/taskgoblin-types";

const telegramUserSchema = z.object({
  id: z.number().int(),
  is_bot: z.boolean().optional(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.string().min(1),
  title: z.string().optional(),
  username: z.string().optional(),
});

const telegramMessageSchema = z.object({
  message_id: z.number().int(),
  date: z.number().int().optional(),
  edit_date: z.number().int().optional(),
  message_thread_id: z.number().int().optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  chat: telegramChatSchema,
  from: telegramUserSchema.optional(),
  reply_to_message: z
    .object({ message_id: z.number().int() })
    .passthrough()
    .optional(),
}).passthrough();

const telegramCallbackQuerySchema = z.object({
  id: z.string().min(1),
  from: telegramUserSchema,
  data: z.string().optional(),
  message: telegramMessageSchema.optional(),
}).passthrough();

const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: telegramMessageSchema.optional(),
  edited_message: telegramMessageSchema.optional(),
  channel_post: telegramMessageSchema.optional(),
  edited_channel_post: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
}).passthrough();

export type TelegramNormalizationResult =
  | { ok: true; update: TelegramInboundUpdate | null }
  | { ok: false; error: string };

export function validateTelegramWebhookSecret(
  expectedSecret: string | undefined,
  receivedSecret: string | null,
) {
  return Boolean(expectedSecret && receivedSecret === expectedSecret);
}

export function normalizeTelegramUpdate(
  payload: unknown,
): TelegramNormalizationResult {
  const parsed = telegramUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid Telegram update.",
    };
  }

  const { update_id: updateId } = parsed.data;
  if (parsed.data.callback_query) {
    const callback = parsed.data.callback_query;
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId,
      updateType: "callback_query",
      callbackQueryId: callback.id,
      data: callback.data ?? null,
      actor: normalizeActor(callback.from),
      chat: callback.message ? normalizeChat(callback.message.chat) : null,
      messageId: callback.message?.message_id ?? null,
      raw: payload,
    };
    return { ok: true, update };
  }

  const messageEntries = [
    ["message", parsed.data.message],
    ["edited_message", parsed.data.edited_message],
    ["channel_post", parsed.data.channel_post],
    ["edited_channel_post", parsed.data.edited_channel_post],
  ] as const;

  for (const [updateType, message] of messageEntries) {
    if (!message) continue;
    const update: TelegramInboundMessage = {
      kind: "message",
      updateId,
      updateType,
      messageId: message.message_id,
      sentAt: unixTimestamp(message.date),
      editedAt: unixTimestamp(message.edit_date),
      text: (message.text ?? message.caption ?? "").trim(),
      chat: normalizeChat(message.chat),
      actor: message.from ? normalizeActor(message.from) : null,
      replyToMessageId: message.reply_to_message?.message_id ?? null,
      messageThreadId: message.message_thread_id ?? null,
      raw: payload,
    };
    return { ok: true, update };
  }

  return { ok: true, update: null };
}

function normalizeActor(
  user: z.infer<typeof telegramUserSchema>,
): TelegramActor {
  return {
    id: user.id,
    isBot: user.is_bot ?? false,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    languageCode: user.language_code ?? null,
  };
}

function normalizeChat(chat: z.infer<typeof telegramChatSchema>): TelegramChat {
  return {
    id: chat.id,
    type: normalizeChatType(chat.type),
    title: chat.title ?? null,
    username: chat.username ?? null,
  };
}

function normalizeChatType(type: string): TelegramChatType {
  if (
    type === "private" ||
    type === "group" ||
    type === "supergroup" ||
    type === "channel"
  ) {
    return type;
  }
  return "unknown";
}

function unixTimestamp(value: number | undefined) {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

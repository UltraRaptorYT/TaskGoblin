type TelegramSendResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
};

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data: string;
    }>
  >;
};

export type TelegramSendOptions = {
  replyMarkup?: TelegramInlineKeyboard;
  replyToMessageId?: number;
};

export type TelegramDelivery = {
  sent: boolean;
  messageId?: number;
  error?: string;
  providerPayload?: TelegramSendResponse;
};

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramDelivery> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "Telegram bot token is not configured." };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: options.replyMarkup,
          reply_parameters: options.replyToMessageId
            ? { message_id: options.replyToMessageId }
            : undefined,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as TelegramSendResponse;

    if (!response.ok || !payload.ok) {
      return {
        sent: false,
        error: payload.description ?? "Telegram rejected the reminder.",
        providerPayload: payload,
      };
    }

    return {
      sent: true,
      messageId: payload.result?.message_id,
      providerPayload: payload,
    };
  } catch {
    return { sent: false, error: "Could not reach Telegram." };
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  return callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function clearTelegramInlineKeyboard(
  chatId: string | number,
  messageId: number,
) {
  return callTelegram("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramDelivery> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "Telegram bot token is not configured." };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as TelegramSendResponse;
    if (!response.ok || !payload.ok) {
      return {
        sent: false,
        error: payload.description ?? `Telegram rejected ${method}.`,
        providerPayload: payload,
      };
    }
    return {
      sent: true,
      messageId: payload.result?.message_id,
      providerPayload: payload,
    };
  } catch {
    return { sent: false, error: "Could not reach Telegram." };
  }
}

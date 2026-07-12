type TelegramSendResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
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
): Promise<TelegramDelivery> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "Telegram bot token is not configured." };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
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

import { describe, expect, it } from "vitest";

import { buildTelegramMessageBatch } from "@/lib/telegram-message-batching";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const message: TelegramInboundMessage = {
  kind: "message",
  updateId: 20,
  updateType: "message",
  messageId: 20,
  sentAt: "2026-07-28T14:39:10.000Z",
  editedAt: null,
  text: "then move on to an experiment",
  chat: { id: -100, type: "group", title: "TaskTransformer", username: null },
  actor: {
    id: 42,
    isBot: false,
    firstName: "Hong",
    lastName: "Yu",
    username: "UltraRaptor",
    languageCode: "en",
  },
  document: null,
  newChatMembers: [],
  replyToMessageId: null,
  messageThreadId: null,
  raw: {},
};

describe("rapid Telegram message batching", () => {
  it("coalesces a burst into one coherent model input", () => {
    const result = buildTelegramMessageBatch(message, [
      row(20, "then move on to an experiment"),
      row(18, "need to break it down into small tasks"),
      row(19, "like do some research first"),
      row(17, "I need to work on the AI agent"),
    ]);

    expect(result.superseded).toBe(false);
    expect(result.messageCount).toBe(4);
    expect(result.message.text).toBe(
      [
        "I need to work on the AI agent",
        "need to break it down into small tasks",
        "like do some research first",
        "then move on to an experiment",
      ].join("\n"),
    );
  });

  it("lets only the newest message in a burst invoke the model", () => {
    const result = buildTelegramMessageBatch(message, [
      row(20, "then move on to an experiment"),
      row(21, "and prepare a short evaluation"),
    ]);

    expect(result.superseded).toBe(true);
    expect(result.message.text).toBe(message.text);
  });

  it("does not merge commands or extracted document bodies", () => {
    const result = buildTelegramMessageBatch(message, [
      row(17, "/tasks"),
      row(18, "Telegram document: assignment.pdf"),
      row(20, "then move on to an experiment"),
    ]);

    expect(result.superseded).toBe(false);
    expect(result.messageCount).toBe(1);
    expect(result.message.text).toBe(message.text);
  });
});

function row(telegramMessageId: number, text: string) {
  return {
    telegram_message_id: telegramMessageId,
    plain_text: text,
    sent_at: "2026-07-28T14:39:00.000Z",
  };
}

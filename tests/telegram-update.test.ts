import { describe, expect, it } from "vitest";

import { normalizeTelegramUpdate } from "@/lib/telegram-update";

describe("normalizeTelegramUpdate", () => {
  it("normalizes a group message", () => {
    const result = normalizeTelegramUpdate({
      update_id: 55,
      message: {
        message_id: 12,
        date: 1_700_000_000,
        chat: { id: -100123, type: "supergroup", title: "Launch" },
        from: {
          id: 42,
          is_bot: false,
          first_name: "Alex",
          username: "alex",
        },
        text: "I will prepare the demo",
        reply_to_message: { message_id: 10 },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.update || result.update.kind !== "message") {
      throw new Error("Expected a normalized message");
    }
    expect(result.update.updateType).toBe("message");
    expect(result.update.chat).toMatchObject({
      id: -100123,
      type: "supergroup",
      title: "Launch",
    });
    expect(result.update.actor?.id).toBe(42);
    expect(result.update.replyToMessageId).toBe(10);
    expect(result.update.text).toBe("I will prepare the demo");
  });

  it("normalizes edited captions and callback queries", () => {
    const edited = normalizeTelegramUpdate({
      update_id: 56,
      edited_channel_post: {
        message_id: 13,
        date: 1_700_000_000,
        edit_date: 1_700_000_100,
        chat: { id: -100123, type: "channel", title: "Updates" },
        caption: "Updated delivery note",
      },
    });
    expect(edited.ok && edited.update?.kind).toBe("message");
    if (edited.ok && edited.update?.kind === "message") {
      expect(edited.update.updateType).toBe("edited_channel_post");
      expect(edited.update.text).toBe("Updated delivery note");
      expect(edited.update.editedAt).not.toBeNull();
    }

    const callback = normalizeTelegramUpdate({
      update_id: 57,
      callback_query: {
        id: "callback-1",
        from: { id: 42, first_name: "Alex" },
        data: "tg:c:ignore:123e4567-e89b-12d3-a456-426614174000",
        message: {
          message_id: 99,
          chat: { id: -100123, type: "supergroup", title: "Launch" },
        },
      },
    });
    expect(callback.ok && callback.update?.kind).toBe("callback_query");
    if (callback.ok && callback.update?.kind === "callback_query") {
      expect(callback.update.callbackQueryId).toBe("callback-1");
      expect(callback.update.messageId).toBe(99);
    }
  });

  it("ignores unsupported updates and rejects malformed payloads", () => {
    expect(
      normalizeTelegramUpdate({ update_id: 58, poll: { id: "poll" } }),
    ).toEqual({ ok: true, update: null });
    expect(normalizeTelegramUpdate({ message: {} }).ok).toBe(false);
  });
});

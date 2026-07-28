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
    expect(result.update.newChatMembers).toEqual([]);
    expect(result.update.replyToMessageId).toBe(10);
    expect(result.update.text).toBe("I will prepare the demo");
  });

  it("normalizes bot-added service messages", () => {
    const result = normalizeTelegramUpdate({
      update_id: 59,
      message: {
        message_id: 14,
        date: 1_700_000_000,
        chat: { id: -100123, type: "supergroup", title: "Launch" },
        from: {
          id: 42,
          is_bot: false,
          first_name: "Alex",
          username: "alex",
        },
        new_chat_members: [
          {
            id: 99,
            is_bot: true,
            first_name: "TaskGoblin",
            username: "taskgoblin_launch_bot",
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.update || result.update.kind !== "message") {
      throw new Error("Expected a normalized service message");
    }
    expect(result.update.text).toBe("");
    expect(result.update.newChatMembers).toEqual([
      {
        id: 99,
        isBot: true,
        firstName: "TaskGoblin",
        lastName: null,
        username: "taskgoblin_launch_bot",
        languageCode: null,
      },
    ]);
  });

  it("normalizes Telegram document metadata and its caption", () => {
    const result = normalizeTelegramUpdate({
      update_id: 61,
      message: {
        message_id: 15,
        date: 1_700_000_000,
        chat: { id: -100123, type: "supergroup", title: "Launch" },
        from: {
          id: 42,
          is_bot: false,
          first_name: "Alex",
          username: "alex",
        },
        caption: "Here is our assignment brief",
        document: {
          file_id: "telegram-file-id",
          file_unique_id: "stable-file-id",
          file_name: "assignment.pdf",
          mime_type: "application/pdf",
          file_size: 159_300,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.update || result.update.kind !== "message") {
      throw new Error("Expected a normalized document message");
    }
    expect(result.update.text).toBe("Here is our assignment brief");
    expect(result.update.document).toEqual({
      fileId: "telegram-file-id",
      fileUniqueId: "stable-file-id",
      fileName: "assignment.pdf",
      mimeType: "application/pdf",
      fileSize: 159_300,
    });
  });

  it("normalizes the reliable my_chat_member bot-added update", () => {
    const result = normalizeTelegramUpdate({
      update_id: 60,
      my_chat_member: {
        chat: { id: -100123, type: "supergroup", title: "Launch" },
        from: {
          id: 42,
          is_bot: false,
          first_name: "Alex",
          username: "alex",
        },
        date: 1_700_000_000,
        old_chat_member: {
          status: "left",
          user: {
            id: 99,
            is_bot: true,
            first_name: "TaskGoblin",
            username: "taskgoblin_launch_bot",
          },
        },
        new_chat_member: {
          status: "member",
          user: {
            id: 99,
            is_bot: true,
            first_name: "TaskGoblin",
            username: "taskgoblin_launch_bot",
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.update || result.update.kind !== "bot_added") {
      throw new Error("Expected a normalized bot-added update");
    }
    expect(result.update.updateType).toBe("my_chat_member");
    expect(result.update.chat.id).toBe(-100123);
    expect(result.update.actor.id).toBe(42);
    expect(result.update.bot.username).toBe("taskgoblin_launch_bot");
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

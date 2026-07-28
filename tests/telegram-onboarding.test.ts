import { describe, expect, it } from "vitest";

import { telegramOnboardingReply } from "@/lib/telegram-onboarding";
import type { TelegramContext } from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const context: TelegramContext = {
  chatRecordId: "chat-1",
  userRecordId: "user-1",
  projectId: "project-1",
  displayName: "Alex Tan",
};

const message: TelegramInboundMessage = {
  kind: "message",
  updateId: 1,
  updateType: "message",
  messageId: 2,
  sentAt: "2026-07-28T00:00:00.000Z",
  editedAt: null,
  text: "",
  chat: { id: -10, type: "group", title: "Launch", username: null },
  actor: {
    id: 42,
    isBot: false,
    firstName: "Alex",
    lastName: "Tan",
    username: "alex",
    languageCode: "en",
  },
  newChatMembers: [],
  replyToMessageId: null,
  messageThreadId: null,
  raw: {},
};

describe("Telegram onboarding", () => {
  it("welcomes the group when the configured bot is added", () => {
    const reply = telegramOnboardingReply(
      {
        ...message,
        newChatMembers: [
          {
            id: 99,
            isBot: true,
            firstName: "TaskGoblin",
            lastName: null,
            username: "taskgoblin_launch_bot",
            languageCode: null,
          },
        ],
      },
      context,
      "@TaskGoblin_Launch_Bot",
    );

    expect(reply).toContain("I’m TaskGoblin");
    expect(reply).toContain("Each team member should send hello");
    expect(reply).toContain("@taskgoblin_launch_bot");
    expect(reply).toContain("/help");
  });

  it("recognises the bot from its token when the username setting is absent", () => {
    const reply = telegramOnboardingReply(
      {
        ...message,
        newChatMembers: [
          {
            id: 99,
            isBot: true,
            firstName: "TaskGoblin",
            lastName: null,
            username: "taskgoblin_launch_bot",
            languageCode: null,
          },
        ],
      },
      context,
      undefined,
      "99:telegram-token",
    );

    expect(reply).toContain("I’m TaskGoblin");
    expect(reply).toContain("@taskgoblin_launch_bot");
  });

  it("acknowledges and identifies a member who says hello", () => {
    const reply = telegramOnboardingReply(
      { ...message, text: "hello" },
      context,
      "taskgoblin_launch_bot",
    );

    expect(reply).toContain("Hello, Alex Tan!");
    expect(reply).toContain("@alex");
    expect(reply).toContain("recognise you as a task owner");
  });

  it("accepts a greeting directed to TaskGoblin but ignores other chat", () => {
    expect(
      telegramOnboardingReply(
        { ...message, text: "Hi @taskgoblin_launch_bot!" },
        context,
        "taskgoblin_launch_bot",
      ),
    ).toContain("You are linked");
    expect(
      telegramOnboardingReply(
        { ...message, text: "hello @other_bot" },
        context,
        "taskgoblin_launch_bot",
      ),
    ).toBeNull();
    expect(
      telegramOnboardingReply(
        { ...message, text: "hello there" },
        context,
        "taskgoblin_launch_bot",
      ),
    ).toBeNull();
  });

  it("does not run group onboarding in private chats or for bots", () => {
    expect(
      telegramOnboardingReply(
        {
          ...message,
          chat: { ...message.chat, type: "private" },
          text: "hello",
        },
        context,
        "taskgoblin_launch_bot",
      ),
    ).toBeNull();
    expect(
      telegramOnboardingReply(
        {
          ...message,
          text: "hello",
          actor: message.actor ? { ...message.actor, isBot: true } : null,
        },
        context,
        "taskgoblin_launch_bot",
      ),
    ).toBeNull();
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processTelegramUpdate, type TelegramGateway } from "@/lib/telegram-handler";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const repository = vi.hoisted(() => ({
  claimTelegramUpdate: vi.fn(),
  completeTelegramUpdate: vi.fn(),
  ensureTelegramContext: vi.fn(),
  failTelegramUpdate: vi.fn(),
  listProjectTasks: vi.fn(),
  persistTelegramMessage: vi.fn(),
  reviewProjectEventCandidate: vi.fn(),
  reviewTaskCandidate: vi.fn(),
}));
const eventPipeline = vi.hoisted(() => ({
  detectAndPersistProjectEvent: vi.fn(),
}));

vi.mock("@/lib/telegram-repository", () => repository);
vi.mock("@/lib/telegram-event-pipeline", () => eventPipeline);

const baseMessage: TelegramInboundMessage = {
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

describe("processTelegramUpdate onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_USERNAME = "taskgoblin_launch_bot";
    repository.claimTelegramUpdate.mockResolvedValue(true);
    repository.ensureTelegramContext.mockResolvedValue({
      chatRecordId: "chat-1",
      userRecordId: "user-1",
      projectId: "project-1",
      displayName: "Alex Tan",
    });
    repository.persistTelegramMessage.mockResolvedValue({ id: "message-1" });
    repository.completeTelegramUpdate.mockResolvedValue(undefined);
    eventPipeline.detectAndPersistProjectEvent.mockResolvedValue(null);
  });

  it("sends the welcome before AI detection when TaskGoblin joins", async () => {
    const gateway = gatewayMock();
    const update: TelegramInboundMessage = {
      ...baseMessage,
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
    };

    const result = await processTelegramUpdate(
      {} as SupabaseClient,
      update,
      gateway,
    );

    expect(result).toEqual({ duplicate: false, replySent: true });
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining("Each team member should send hello"),
      { replyToMessageId: 2 },
    );
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
    expect(repository.completeTelegramUpdate).toHaveBeenCalledWith(
      expect.anything(),
      1,
    );
  });

  it("acknowledges a linked member greeting without invoking AI", async () => {
    const gateway = gatewayMock();

    await processTelegramUpdate(
      {} as SupabaseClient,
      { ...baseMessage, text: "hello" },
      gateway,
    );

    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining("You are linked to this project as @alex"),
      { replyToMessageId: 2 },
    );
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
  });
});

function gatewayMock(): TelegramGateway {
  return {
    sendMessage: vi.fn().mockResolvedValue({ sent: true }),
    answerCallback: vi.fn().mockResolvedValue({ sent: true }),
    clearKeyboard: vi.fn().mockResolvedValue({ sent: true }),
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createBulkAssignmentCandidate: vi.fn(),
  findProjectMemberByUsername: vi.fn(),
  getProjectMemberOwner: vi.fn(),
}));

vi.mock("@/lib/telegram-repository", () => repository);

import {
  handleExplicitTelegramProjectAction,
  parseBulkAssignmentIntent,
} from "@/lib/telegram-project-actions";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

describe("explicit Telegram project actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognises mentioned and self-service bulk assignments", () => {
    expect(
      parseBulkAssignmentIntent("assign all the tasks to @UltraRaptor"),
    ).toEqual({ target: "username", username: "UltraRaptor" });
    expect(
      parseBulkAssignmentIntent("okay i will take all the tasks"),
    ).toEqual({ target: "self" });
    expect(
      parseBulkAssignmentIntent(
        "assign all the tasks to @UltraRaptor\nokay i will take all the tasks",
      ),
    ).toEqual({ target: "self" });
    expect(parseBulkAssignmentIntent("assign the ERD to @UltraRaptor")).toBeNull();
  });

  it("resolves only a known project member and persists a review candidate", async () => {
    repository.findProjectMemberByUsername.mockResolvedValue({
      telegramUserRecordId: "user-1",
      displayName: "Hong Yu",
    });
    repository.createBulkAssignmentCandidate.mockResolvedValue({
      id: "123e4567-e89b-12d3-a456-426614174000",
      targetOwnerDisplayName: "Hong Yu",
      taskCount: 17,
    });

    const response = await handleExplicitTelegramProjectAction(
      {} as never,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-2",
        projectId: "project-1",
        displayName: "Joash",
      },
      { id: "message-record-1" },
      message("assign all the tasks to @UltraRaptor"),
    );

    expect(repository.findProjectMemberByUsername).toHaveBeenCalledWith(
      expect.anything(),
      "project-1",
      "UltraRaptor",
    );
    expect(repository.createBulkAssignmentCandidate).toHaveBeenCalledOnce();
    expect(response?.text).toContain("Assign all 17 active confirmed tasks");
    expect(response?.replyMarkup?.inline_keyboard[0][0].callback_data).toMatch(
      /^tg:a:confirm:/,
    );
  });

  it("explains when the requested username is not a project member", async () => {
    repository.findProjectMemberByUsername.mockResolvedValue(null);

    const response = await handleExplicitTelegramProjectAction(
      {} as never,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-2",
        projectId: "project-1",
        displayName: "Joash",
      },
      { id: "message-record-1" },
      message("assign all tasks to @outsider"),
    );

    expect(response?.text).toContain("not a known member");
    expect(repository.createBulkAssignmentCandidate).not.toHaveBeenCalled();
  });
});

function message(text: string): TelegramInboundMessage {
  return {
    kind: "message",
    updateId: 1,
    updateType: "message",
    messageId: 10,
    sentAt: "2026-07-28T15:00:00.000Z",
    editedAt: null,
    text,
    chat: {
      id: -100,
      type: "supergroup",
      title: "Project",
      username: null,
    },
    actor: {
      id: 2,
      isBot: false,
      firstName: "Joash",
      lastName: null,
      username: "joash",
      languageCode: "en",
    },
    newChatMembers: [],
    replyToMessageId: null,
    messageThreadId: null,
    raw: {},
  };
}

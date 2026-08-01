import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processTelegramUpdate, type TelegramGateway } from "@/lib/telegram-handler";
import type {
  TelegramInboundBotAdded,
  TelegramInboundCallback,
  TelegramInboundMessage,
} from "@/lib/taskgoblin-types";
import { taskActionCallbackData } from "@/lib/telegram-callbacks";

const repository = vi.hoisted(() => ({
  applyTelegramOwnerChoice: vi.fn(),
  claimTelegramUpdate: vi.fn(),
  completeTelegramUpdate: vi.fn(),
  consumeTelegramTitleEdit: vi.fn(),
  ensureTelegramContext: vi.fn(),
  failTelegramUpdate: vi.fn(),
  getTaskForTelegramContext: vi.fn(),
  getTelegramProject: vi.fn(),
  loadProjectSummaryKnowledge: vi.fn(),
  linkPersistedTelegramMessageToProject: vi.fn(),
  listProjectTasks: vi.fn(),
  listTelegramUserTasks: vi.fn(),
  persistTelegramProjectDocument: vi.fn(),
  persistTelegramMessage: vi.fn(),
  reviewAgentTaskCandidateBatch: vi.fn(),
  reviewBulkAssignmentCandidate: vi.fn(),
  reviewProjectNameCandidate: vi.fn(),
  reviewProjectEventCandidate: vi.fn(),
  reviewTaskCandidate: vi.fn(),
  resolvePrivateReminderReplyContext: vi.fn(),
  resolveRecentPrivateReminderContext: vi.fn(),
  snoozeTaskReminder: vi.fn(),
  startTelegramEditSession: vi.fn(),
  updateCandidateDeadlineFromTelegram: vi.fn(),
  updatePersistedTelegramMessageText: vi.fn(),
  updateTaskDeadlineFromTelegram: vi.fn(),
  updateTaskStatusFromTelegram: vi.fn(),
  undoLastTaskMutation: vi.fn(),
}));
const eventPipeline = vi.hoisted(() => ({
  detectAndPersistProjectEvent: vi.fn(),
}));
const projectAgentPipeline = vi.hoisted(() => ({
  answerTelegramProjectRequest: vi.fn(),
}));
const messageBatching = vi.hoisted(() => ({
  coalesceRapidTelegramMessages: vi.fn(),
}));
const telegramDocument = vi.hoisted(() => ({
  displayFilename: vi.fn(() => "assignment.txt"),
  documentMessageText: vi.fn(
    (_message: TelegramInboundMessage, extraction?: { text: string }) =>
      extraction
        ? `Telegram document: assignment.txt\n\nExtracted document content:\n${extraction.text}`
        : "Telegram document: assignment.txt",
  ),
  extractTelegramDocument: vi.fn(),
}));

vi.mock("@/lib/telegram-repository", () => repository);
vi.mock("@/lib/telegram-event-pipeline", () => eventPipeline);
vi.mock("@/lib/telegram-project-agent-pipeline", () => projectAgentPipeline);
vi.mock("@/lib/telegram-message-batching", () => messageBatching);
vi.mock("@/lib/telegram-document", () => telegramDocument);

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
    process.env.TASKGOBLIN_APP_URL = "https://taskgoblin.vercel.app";
    repository.claimTelegramUpdate.mockResolvedValue(true);
    repository.ensureTelegramContext.mockResolvedValue({
      chatRecordId: "chat-1",
      userRecordId: "user-1",
      projectId: "project-1",
      displayName: "Alex Tan",
    });
    repository.persistTelegramMessage.mockResolvedValue({ id: "message-1" });
    repository.consumeTelegramTitleEdit.mockResolvedValue(null);
    repository.persistTelegramProjectDocument.mockResolvedValue(undefined);
    repository.linkPersistedTelegramMessageToProject.mockResolvedValue(
      undefined,
    );
    repository.resolvePrivateReminderReplyContext.mockResolvedValue(null);
    repository.resolveRecentPrivateReminderContext.mockResolvedValue(null);
    repository.updatePersistedTelegramMessageText.mockResolvedValue(undefined);
    repository.completeTelegramUpdate.mockResolvedValue(undefined);
    repository.reviewProjectEventCandidate.mockResolvedValue({
      candidateId: "candidate-1",
      state: "confirmed",
      taskId: "task-1",
      eventType: "possible_task_completion",
      summary: "Finished the project UI",
      reminderScheduledFor: null,
    });
    repository.undoLastTaskMutation.mockResolvedValue(null);
    eventPipeline.detectAndPersistProjectEvent.mockResolvedValue(null);
    messageBatching.coalesceRapidTelegramMessages.mockImplementation(
      async (
        _supabase: SupabaseClient,
        _context: unknown,
        message: TelegramInboundMessage,
      ) => ({
        message,
        superseded: false,
        messageCount: 1,
      }),
    );
    projectAgentPipeline.answerTelegramProjectRequest.mockResolvedValue({
      provider: "openai",
      model: "test-agent",
      text: "The report and demonstration still need to be planned.",
      toolsUsed: ["get_project_documents", "get_project_tasks"],
      fallback: false,
      batchId: null,
      projectNameCandidateId: null,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "Open project dashboard",
              url: "https://taskgoblin.vercel.app/dashboard/projects/project-1",
            },
          ],
        ],
      },
    });
    telegramDocument.extractTelegramDocument.mockResolvedValue({
      filename: "assignment.txt",
      extension: "txt",
      text: "Build the API and submit it Friday.",
      wasTruncated: false,
    });
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
      expect.objectContaining({
        replyToMessageId: 2,
        replyMarkup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      }),
    );
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
    expect(repository.completeTelegramUpdate).toHaveBeenCalledWith(
      expect.anything(),
      1,
    );
  });

  it("welcomes a newly created group from my_chat_member", async () => {
    const gateway = gatewayMock();
    const update: TelegramInboundBotAdded = {
      kind: "bot_added",
      updateId: 4,
      updateType: "my_chat_member",
      sentAt: "2026-07-28T00:00:00.000Z",
      chat: baseMessage.chat,
      actor: baseMessage.actor!,
      bot: {
        id: 99,
        isBot: true,
        firstName: "TaskGoblin",
        lastName: null,
        username: "taskgoblin_launch_bot",
        languageCode: null,
      },
      raw: {},
    };

    const result = await processTelegramUpdate(
      {} as SupabaseClient,
      update,
      gateway,
    );

    expect(result).toEqual({ duplicate: false, replySent: true });
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining("Quick setup"),
      expect.objectContaining({ replyMarkup: expect.any(Object) }),
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining(
        "https://taskgoblin.vercel.app/dashboard/projects/project-1",
      ),
      expect.objectContaining({ replyMarkup: expect.any(Object) }),
    );
    expect(repository.persistTelegramMessage).not.toHaveBeenCalled();
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
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
      expect.objectContaining({
        replyToMessageId: 2,
        replyMarkup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      }),
    );
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
  });

  it("reads a Telegram document and adds its text to project context", async () => {
    const gateway = gatewayMock();
    const update: TelegramInboundMessage = {
      ...baseMessage,
      text: "Here is our assignment document",
      document: {
        fileId: "file-id",
        fileUniqueId: "file-unique-id",
        fileName: "assignment.txt",
        mimeType: "text/plain",
        fileSize: 35,
      },
    };

    await processTelegramUpdate(
      {} as SupabaseClient,
      update,
      gateway,
    );

    expect(telegramDocument.extractTelegramDocument).toHaveBeenCalledWith(
      update.document,
    );
    expect(repository.persistTelegramProjectDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      { id: "message-1" },
      update.document,
      expect.objectContaining({
        extraction: expect.objectContaining({
          filename: "assignment.txt",
        }),
      }),
    );
    expect(repository.updatePersistedTelegramMessageText).toHaveBeenCalledWith(
      expect.anything(),
      { id: "message-1" },
      expect.stringContaining("Build the API and submit it Friday."),
    );
    expect(eventPipeline.detectAndPersistProjectEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { id: "message-1" },
      expect.objectContaining({
        text: expect.stringContaining("Build the API and submit it Friday."),
      }),
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining("added it to this project's context"),
      { replyToMessageId: 2 },
    );
  });

  it("answers project planning requests through the bounded agent", async () => {
    const gateway = gatewayMock();
    const update = {
      ...baseMessage,
      text: "what else needs to be done?",
    };

    await processTelegramUpdate(
      {} as SupabaseClient,
      update,
      gateway,
    );

    expect(
      projectAgentPipeline.answerTelegramProjectRequest,
    ).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      { id: "message-1" },
      update,
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringContaining("report and demonstration"),
      expect.objectContaining({
        replyToMessageId: 2,
        replyMarkup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
  });

  it("lists the member's tasks across projects in a private chat", async () => {
    const gateway = gatewayMock();
    repository.listTelegramUserTasks.mockResolvedValue([
      {
        id: "task-1",
        project_id: "project-1",
        project_name: "Website Launch",
        title: "Implement endpoints",
        description: null,
        status: "doing",
        priority: "high",
        source_participant_name: "Alex Tan",
        due_label: "Friday",
        due_at: "2026-07-31T09:00:00.000Z",
        blocked_by: null,
        owner_telegram_user_id: "user-1",
        updated_at: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "task-2",
        project_id: "project-2",
        project_name: "Demo",
        title: "Prepare slides",
        description: null,
        status: "backlog",
        priority: "medium",
        source_participant_name: "Alex Tan",
        due_label: null,
        due_at: null,
        blocked_by: null,
        owner_telegram_user_id: "user-1",
        updated_at: "2026-07-28T00:00:00.000Z",
      },
    ]);

    await processTelegramUpdate(
      {} as SupabaseClient,
      {
        ...baseMessage,
        text: "/mytasks",
        chat: {
          id: 42,
          type: "private",
          title: null,
          username: "alex",
        },
      },
      gateway,
    );

    expect(repository.listTelegramUserTasks).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      42,
      expect.stringMatching(/Website Launch[\s\S]*Demo/),
      expect.objectContaining({
        replyMarkup: {
          inline_keyboard: expect.arrayContaining([
            [
              expect.objectContaining({
                callback_data: "tg:t:v:task-1",
              }),
            ],
          ]),
        },
      }),
    );
  });

  it("undoes the latest task mutation in a project group", async () => {
    const gateway = gatewayMock();
    repository.undoLastTaskMutation.mockResolvedValue({
      transactionId: 42,
      affectedTaskCount: 1,
      description: "Restored the previous owner for Build the API.",
    });

    await processTelegramUpdate(
      {} as SupabaseClient,
      { ...baseMessage, text: "/undo" },
      gateway,
    );

    expect(repository.undoLastTaskMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId: "project-1",
        userRecordId: "user-1",
      }),
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      "↩️ Restored the previous owner for Build the API.",
      expect.objectContaining({ replyToMessageId: 2 }),
    );
  });

  it("reacts to a high-confidence completion and records the completing member", async () => {
    const gateway = gatewayMock();
    eventPipeline.detectAndPersistProjectEvent.mockResolvedValue({
      id: "candidate-1",
      eventType: "possible_task_completion",
      summary: "Finished the project UI",
      confidence: 0.94,
      matchedTaskId: "task-1",
      duplicateOfTaskId: null,
      duplicateOfCandidateId: null,
      dueLabel: null,
    });

    await processTelegramUpdate(
      {} as SupabaseClient,
      { ...baseMessage, text: "I finished the project UI" },
      gateway,
    );

    expect(repository.reviewProjectEventCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userRecordId: "user-1" }),
      "candidate-1",
      "confirm",
    );
    expect(gateway.reactToMessage).toHaveBeenCalledWith(-10, 2, "✅");
    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("links a private reminder reply back to its project and asks the agent for advice", async () => {
    const gateway = gatewayMock();
    repository.ensureTelegramContext.mockResolvedValue({
      chatRecordId: "private-chat-1",
      userRecordId: "user-1",
      projectId: null,
      displayName: "Alex Tan",
    });
    repository.resolvePrivateReminderReplyContext.mockResolvedValue({
      projectId: "project-1",
      projectName: "Website Launch",
      taskId: "task-1",
      taskTitle: "Work on the website",
    });
    const update: TelegramInboundMessage = {
      ...baseMessage,
      text: "I am unable to move on, give me advice",
      replyToMessageId: 77,
      chat: {
        id: 42,
        type: "private",
        title: null,
        username: "alex",
      },
    };

    await processTelegramUpdate({} as SupabaseClient, update, gateway);

    expect(repository.resolvePrivateReminderReplyContext).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      42,
      77,
    );
    expect(repository.linkPersistedTelegramMessageToProject).toHaveBeenCalledWith(
      expect.anything(),
      { id: "message-1" },
      "project-1",
    );
    expect(projectAgentPipeline.answerTelegramProjectRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      { id: "message-1" },
      expect.objectContaining({
        text: expect.stringMatching(
          /Work on the website[\s\S]*unable to move on[\s\S]*practical advice/i,
        ),
      }),
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      42,
      expect.stringContaining("report and demonstration"),
      expect.objectContaining({
        replyMarkup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
  });

  it("uses a recent private reminder when the member sends a natural follow-up without Telegram Reply", async () => {
    const gateway = gatewayMock();
    repository.ensureTelegramContext.mockResolvedValue({
      chatRecordId: "private-chat-1",
      userRecordId: "user-1",
      projectId: null,
      displayName: "Alex Tan",
    });
    repository.resolveRecentPrivateReminderContext.mockResolvedValue({
      projectId: "project-1",
      projectName: "Website Launch",
      taskId: "task-1",
      taskTitle: "Document and validate the processed dataset",
    });
    const update: TelegramInboundMessage = {
      ...baseMessage,
      text: "wah idk what to do sia",
      replyToMessageId: null,
      chat: {
        id: 42,
        type: "private",
        title: null,
        username: "alex",
      },
    };

    await processTelegramUpdate({} as SupabaseClient, update, gateway);

    expect(repository.resolveRecentPrivateReminderContext).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      42,
      update.sentAt,
    );
    expect(repository.resolvePrivateReminderReplyContext).not.toHaveBeenCalled();
    expect(repository.linkPersistedTelegramMessageToProject).toHaveBeenCalledWith(
      expect.anything(),
      { id: "message-1" },
      "project-1",
    );
    expect(projectAgentPipeline.answerTelegramProjectRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      { id: "message-1" },
      expect.objectContaining({
        text: expect.stringMatching(
          /Document and validate the processed dataset[\s\S]*idk what to do[\s\S]*practical advice/i,
        ),
      }),
    );
  });

  it("consumes an active title edit without invoking batching or AI", async () => {
    const gateway = gatewayMock();
    repository.consumeTelegramTitleEdit.mockResolvedValueOnce({
      targetKind: "task",
      targetId: "task-1",
      title: "Prepare the final demo",
      cancelled: false,
    });

    await processTelegramUpdate(
      {} as SupabaseClient,
      { ...baseMessage, text: "Prepare the final demo" },
      gateway,
    );

    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      "✅ Updated title to: Prepare the final demo",
      { replyToMessageId: 2 },
    );
    expect(messageBatching.coalesceRapidTelegramMessages).not.toHaveBeenCalled();
    expect(eventPipeline.detectAndPersistProjectEvent).not.toHaveBeenCalled();
  });

  it("completes a selected task through a one-tap callback", async () => {
    const gateway = gatewayMock();
    const task = {
      id: "task-1",
      project_id: "project-1",
      project_name: "Launch",
      title: "Prepare the demo",
      description: null,
      status: "doing",
      priority: "high",
      source_participant_name: "Alex Tan",
      due_label: "Tomorrow",
      due_at: "2026-08-02T10:00:00.000Z",
      blocked_by: null,
      owner_telegram_user_id: "user-1",
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    repository.getTaskForTelegramContext.mockResolvedValue(task);
    repository.updateTaskStatusFromTelegram.mockResolvedValue({
      ...task,
      status: "done",
    });
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 30,
      updateType: "callback_query",
      callbackQueryId: "callback-30",
      data: taskActionCallbackData("complete", "task-1"),
      chat: baseMessage.chat,
      actor: baseMessage.actor!,
      messageId: 200,
      raw: {},
    };

    await processTelegramUpdate({} as SupabaseClient, update, gateway);

    expect(repository.updateTaskStatusFromTelegram).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      task,
      "done",
    );
    expect(gateway.answerCallback).toHaveBeenCalledWith(
      "callback-30",
      "Task completed",
    );
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      -10,
      expect.stringMatching(/Prepare the demo[\s\S]*Status: done/),
      expect.objectContaining({ replyMarkup: expect.any(Object) }),
    );
  });
});

function gatewayMock(): TelegramGateway {
  return {
    sendMessage: vi.fn().mockResolvedValue({ sent: true }),
    answerCallback: vi.fn().mockResolvedValue({ sent: true }),
    clearKeyboard: vi.fn().mockResolvedValue({ sent: true }),
    reactToMessage: vi.fn().mockResolvedValue({ sent: true }),
  };
}

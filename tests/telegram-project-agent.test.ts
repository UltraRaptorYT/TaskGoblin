import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import type { ProjectDetectionContext } from "@/lib/project-event-detection";
import {
  runTelegramProjectAgent,
  shouldInvokeTelegramProjectAgent,
} from "@/lib/telegram-project-agent";
import type { TelegramProjectRow } from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const message: TelegramInboundMessage = {
  kind: "message",
  updateId: 1,
  updateType: "message",
  messageId: 10,
  sentAt: "2026-07-28T12:00:00.000Z",
  editedAt: null,
  text: "what else needs to be done?",
  chat: { id: -100, type: "group", title: "Launch", username: null },
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

const project: TelegramProjectRow = {
  id: "project-1",
  name: "TaskGoblin",
  description: "Turn Telegram conversations into project work.",
  health_score: 75,
  health_label: "Healthy",
  timezone: "Asia/Singapore",
};

const context: ProjectDetectionContext = {
  projectId: "project-1",
  timezone: "Asia/Singapore",
  members: [
    {
      telegramUserRecordId: "member-1",
      username: "UltraRaptor",
      displayName: "Hong Yu",
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Build the backend",
      status: "doing",
      ownerTelegramUserRecordId: "member-1",
      dueLabel: "Friday",
    },
  ],
  recentCandidates: [],
  recentMessages: [],
  documents: [
    {
      filename: "assignment.pdf",
      extractedText: "Deliver a working application, report, and demonstration.",
    },
  ],
};

describe("Telegram project agent intent routing", () => {
  it("routes project planning questions to the agent", () => {
    expect(
      shouldInvokeTelegramProjectAgent(message, "taskgoblin_launch_bot"),
    ).toBe(true);
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: "can u help me come out with some tasks that we need to do",
        },
        "taskgoblin_launch_bot",
      ),
    ).toBe(true);
  });

  it("routes bot mentions but leaves ambient commitments alone", () => {
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: "@taskgoblin_launch_bot please review our progress",
        },
        "taskgoblin_launch_bot",
      ),
    ).toBe(true);
    expect(
      shouldInvokeTelegramProjectAgent(
        { ...message, text: "I will build the frontend tomorrow" },
        "taskgoblin_launch_bot",
      ),
    ).toBe(false);
  });
});

describe("runTelegramProjectAgent", () => {
  it("executes read-only project tools and returns the final grounded answer", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output: [
          {
            id: "fc-1",
            call_id: "call-1",
            type: "function_call",
            name: "get_project_documents",
            arguments: "{}",
            status: "completed",
          },
          {
            id: "fc-2",
            call_id: "call-2",
            type: "function_call",
            name: "get_project_tasks",
            arguments: "{}",
            status: "completed",
          },
        ],
        output_text: "",
      })
      .mockResolvedValueOnce({
        output: [
          {
            id: "message-1",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [],
          },
        ],
        output_text:
          "The report and demonstration are not covered yet.\n\n1. Write the project report\n2. Prepare the final demonstration",
      });
    const client = {
      responses: { create },
    } as unknown as OpenAI;

    const result = await runTelegramProjectAgent(message, project, context, {
      mode: "openai",
      client,
      model: "test-agent-model",
    });

    expect(result).toMatchObject({
      provider: "openai",
      model: "test-agent-model",
      fallback: false,
      toolsUsed: ["get_project_documents", "get_project_tasks"],
    });
    expect(result.text).toContain("Write the project report");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "function_call_output",
          call_id: "call-1",
          output: expect.stringContaining("assignment.pdf"),
        }),
        expect.objectContaining({
          type: "function_call_output",
          call_id: "call-2",
          output: expect.stringContaining("Build the backend"),
        }),
      ]),
    );
  });

  it("uses deterministic project context when provider access is unavailable", async () => {
    const result = await runTelegramProjectAgent(message, project, context, {
      mode: "mock",
    });

    expect(result.provider).toBe("mock");
    expect(result.text).toContain("1 active confirmed task");
    expect(result.text).toContain("Build the backend");
  });
});

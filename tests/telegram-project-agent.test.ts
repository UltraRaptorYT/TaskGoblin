import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import type { ProjectDetectionContext } from "@/lib/project-event-detection";
import {
  isGenericProjectName,
  runTelegramProjectAgent,
  shouldInvokeTelegramProjectAgent,
  validateAgentProjectNameProposal,
  validateAgentTaskProposals,
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
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: "since i am blocked, what else should i work on?",
        },
        "taskgoblin_launch_bot",
      ),
    ).toBe(true);
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: "so what are the other tasks that we need to work on",
        },
        "taskgoblin_launch_bot",
      ),
    ).toBe(true);
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: "remember this context?",
        },
        "taskgoblin_launch_bot",
      ),
    ).toBe(true);
    expect(
      shouldInvokeTelegramProjectAgent(
        {
          ...message,
          text: [
            "okay i think need to work on the AI Agent",
            "need to break it down into small tasks bah",
            "like do some research first",
            "then move on to some experiment",
          ].join("\n"),
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
  it("returns a strict task batch from one grounded model call", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [
        {
          id: "fc-1",
          call_id: "call-1",
          type: "function_call",
          name: "respond_to_project_request",
          arguments: JSON.stringify({
            responseText: "I found two uncovered deliverables.",
            proposals: [
              {
                title: "Write the project report",
                description: "Document the implementation and findings.",
                ownerUsername: null,
                deadlineText: null,
                confidence: 0.92,
                rationale: "The assignment requires a report.",
              },
              {
                title: "Prepare the final demonstration",
                description: null,
                ownerUsername: "UltraRaptor",
                deadlineText: null,
                confidence: 0.88,
                rationale: "The assignment requires a demonstration.",
              },
            ],
            proposedProjectName: null,
            projectNameEvidence: null,
            projectNameConfidence: null,
          }),
          status: "completed",
        },
      ],
      output_text: "",
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
      toolsUsed: ["respond_to_project_request"],
    });
    expect(result.plan.proposals).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      parallel_tool_calls: false,
      tool_choice: {
        type: "function",
        name: "respond_to_project_request",
      },
    });
    expect(create.mock.calls[0][0].input).toContain("assignment.pdf");
    expect(create.mock.calls[0][0].input).toContain("Build the backend");
  });

  it("includes more than twelve persisted chat messages in agent memory", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [
        {
          id: "fc-memory",
          call_id: "call-memory",
          type: "function_call",
          name: "respond_to_project_request",
          arguments: JSON.stringify({
            responseText: "I remember the earlier project discussion.",
            proposals: [],
            proposedProjectName: null,
            projectNameEvidence: null,
            projectNameConfidence: null,
          }),
          status: "completed",
        },
      ],
      output_text: "",
    });
    const client = {
      responses: { create },
    } as unknown as OpenAI;
    const longContext = {
      ...context,
      recentMessages: Array.from({ length: 20 }, (_, index) => ({
        telegramMessageId: index + 1,
        sentAt: `2026-07-27T${String(index).padStart(2, "0")}:00:00.000Z`,
        senderUsername: "UltraRaptor",
        senderDisplayName: "Hong Yu",
        text: `Persisted project context ${index + 1}`,
        replyToTelegramMessageId: null,
      })),
    };

    await runTelegramProjectAgent(message, project, longContext, {
      mode: "openai",
      client,
      model: "test-agent-model",
    });

    expect(create.mock.calls[0][0].input).toContain(
      "Persisted project context 1",
    );
    expect(create.mock.calls[0][0].input).toContain(
      "Persisted project context 20",
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

describe("Telegram project agent safeguards", () => {
  it("filters duplicate tasks and resolves owners only from known members", () => {
    const validated = validateAgentTaskProposals(
      {
        responseText: "Suggested work",
        proposals: [
          {
            title: "Build the backend",
            description: null,
            ownerUsername: "made_up_user",
            deadlineText: null,
            confidence: 0.95,
            rationale: "Already covered.",
          },
          {
            title: "Prepare the final demonstration",
            description: null,
            ownerUsername: "UltraRaptor",
            deadlineText: null,
            confidence: 0.9,
            rationale: "Required by the assignment.",
          },
        ],
        projectNameProposal: null,
      },
      message,
      context,
    );

    expect(validated.duplicateCount).toBe(1);
    expect(validated.accepted).toEqual([
      expect.objectContaining({
        title: "Prepare the final demonstration",
        ownerTelegramUserRecordId: "member-1",
      }),
    ]);
  });

  it("only accepts strongly evidenced names for generic projects", () => {
    const genericProject = { ...project, name: "DEMO" };
    const namedContext = {
      ...context,
      documents: [
        {
          filename: "brief.pdf",
          extractedText: "Project name: Taxi Data Analytics",
        },
      ],
    };

    expect(isGenericProjectName("DEMO")).toBe(true);
    expect(isGenericProjectName("Taskgoblin *chat data")).toBe(true);
    expect(
      validateAgentProjectNameProposal(
        {
          name: "Taxi Data Analytics",
          evidence: "Project name: Taxi Data Analytics",
          confidence: 0.96,
        },
        genericProject,
        message,
        namedContext,
      ),
    ).toEqual(
      expect.objectContaining({ name: "Taxi Data Analytics" }),
    );
    expect(
      validateAgentProjectNameProposal(
        {
          name: "Invented Project",
          evidence: "Project name: Taxi Data Analytics",
          confidence: 0.99,
        },
        genericProject,
        message,
        namedContext,
      ),
    ).toBeNull();
  });
});

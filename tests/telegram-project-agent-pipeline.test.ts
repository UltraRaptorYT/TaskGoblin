import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { answerTelegramProjectRequest } from "@/lib/telegram-project-agent-pipeline";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const agent = vi.hoisted(() => ({
  runTelegramProjectAgent: vi.fn(),
  validateAgentTaskProposals: vi.fn(),
  validateAgentProjectNameProposal: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  createAgentTaskCandidateBatch: vi.fn(),
  createProjectNameCandidate: vi.fn(),
  getTelegramProject: vi.fn(),
  loadProjectDetectionContext: vi.fn(),
  queueAgentTaskCandidateBatch: vi.fn(),
  queueProjectNameCandidate: vi.fn(),
}));

vi.mock("@/lib/telegram-project-agent", () => agent);
vi.mock("@/lib/telegram-repository", () => repository);

const sourceMessageId = "123e4567-e89b-12d3-a456-426614174000";
const nameCandidateId = "223e4567-e89b-12d3-a456-426614174000";
const message: TelegramInboundMessage = {
  kind: "message",
  updateId: 1,
  updateType: "message",
  messageId: 10,
  sentAt: "2026-07-28T12:00:00.000Z",
  editedAt: null,
  text: "@taskgoblin_launch_bot give @UltraRaptor work to do",
  chat: { id: -100, type: "group", title: "DEMO", username: null },
  actor: {
    id: 42,
    isBot: false,
    firstName: "Kaleb",
    lastName: null,
    username: "kalebix",
    languageCode: "en",
  },
  document: null,
  newChatMembers: [],
  replyToMessageId: null,
  messageThreadId: null,
  raw: {},
};

describe("Telegram project agent pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TASKGOBLIN_APP_URL = "https://taskgoblin.vercel.app";
    repository.getTelegramProject.mockResolvedValue({
      id: "project-1",
      name: "DEMO",
      description: null,
      health_score: 0,
      health_label: "Unknown",
      timezone: "Asia/Singapore",
    });
    repository.loadProjectDetectionContext.mockResolvedValue({
      projectId: "project-1",
      timezone: "Asia/Singapore",
      members: [],
      tasks: [],
      recentCandidates: [],
      recentMessages: [],
      documents: [],
    });
    agent.runTelegramProjectAgent.mockResolvedValue({
      provider: "openai",
      model: "test-agent",
      text: "I found two uncovered deliverables.",
      toolsUsed: ["respond_to_project_request"],
      fallback: false,
      plan: {
        responseText: "I found two uncovered deliverables.",
        proposals: [],
        projectNameProposal: null,
      },
    });
    agent.validateAgentTaskProposals.mockReturnValue({
      accepted: [
        {
          title: "Write the SQL queries",
          description: null,
          ownerUsername: "UltraRaptor",
          ownerTelegramUserRecordId: "member-1",
          deadlineText: null,
          dueAt: null,
          confidence: 0.95,
          rationale: "Assignment requirement.",
        },
        {
          title: "Build the ETL pipeline",
          description: null,
          ownerUsername: "UltraRaptor",
          ownerTelegramUserRecordId: "member-1",
          deadlineText: null,
          dueAt: null,
          confidence: 0.93,
          rationale: "Assignment requirement.",
        },
      ],
      duplicateCount: 1,
    });
    agent.validateAgentProjectNameProposal.mockReturnValue({
      name: "Taxi Data Analytics",
      evidence: "Project name: Taxi Data Analytics",
      confidence: 0.96,
    });
    repository.createAgentTaskCandidateBatch.mockResolvedValue({
      batchId: sourceMessageId,
      candidates: [
        { id: "candidate-1", title: "Write the SQL queries" },
        { id: "candidate-2", title: "Build the ETL pipeline" },
      ],
    });
    repository.createProjectNameCandidate.mockResolvedValue({
      id: nameCandidateId,
      proposedName: "Taxi Data Analytics",
    });
  });

  it("persists every proposal before returning review controls and a dashboard link", async () => {
    const response = await answerTelegramProjectRequest(
      {} as SupabaseClient,
      {
        chatRecordId: "chat-1",
        userRecordId: "member-2",
        projectId: "project-1",
        displayName: "Kaleb",
      },
      { id: sourceMessageId },
      message,
    );

    expect(repository.createAgentTaskCandidateBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "project-1" }),
      { id: sourceMessageId },
      expect.arrayContaining([
        expect.objectContaining({ title: "Write the SQL queries" }),
        expect.objectContaining({ title: "Build the ETL pipeline" }),
      ]),
    );
    expect(repository.loadProjectDetectionContext).toHaveBeenCalledWith(
      expect.anything(),
      "project-1",
      expect.objectContaining({
        recentMessageLimit: 40,
        maxLookbackMinutes: null,
      }),
    );
    expect(repository.queueAgentTaskCandidateBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      sourceMessageId,
    );
    expect(repository.queueProjectNameCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      nameCandidateId,
    );
    expect(response?.text).toMatch(
      /Proposed 2 separate tasks[\s\S]*Taxi Data Analytics[\s\S]*taskgoblin\.vercel\.app/,
    );
    expect(response?.replyMarkup?.inline_keyboard).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({
            callback_data: `tg:b:confirm:${sourceMessageId}`,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            callback_data: `tg:n:confirm:${nameCandidateId}`,
          }),
        ]),
        [
          expect.objectContaining({
            url: "https://taskgoblin.vercel.app/dashboard/projects/project-1",
          }),
        ],
      ]),
    );
  });
});

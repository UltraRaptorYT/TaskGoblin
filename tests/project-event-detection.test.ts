import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";

import fixtures from "@/tests/fixtures/telegram-event-detection-held-out.json";
import {
  detectMockProjectEvent,
  detectProjectEvent,
  resolveDeadline,
  validateProjectEvent,
  type ProjectDetectionContext,
} from "@/lib/project-event-detection";
import {
  modelProjectEventResponseSchema,
  type ProjectEventType,
} from "@/lib/project-event-schemas";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

type FixtureCase = {
  id: string;
  category: string;
  text: string;
  senderUsername: string;
  expectedEventType: ProjectEventType | "none";
  expectedDuplicate?: boolean;
  expectedMatchedTaskId?: string;
  expectResolvedDeadline?: boolean;
  recentCandidates?: ProjectDetectionContext["recentCandidates"];
};

const baseContext: ProjectDetectionContext = {
  projectId: "project-1",
  timezone: "Asia/Singapore",
  members: fixtures.members,
  tasks: fixtures.tasks as ProjectDetectionContext["tasks"],
  recentCandidates: [],
};

function messageFor(testCase: FixtureCase): TelegramInboundMessage {
  return {
    kind: "message",
    updateId: 1,
    updateType: "message",
    messageId: 9001,
    sentAt: "2026-07-27T04:00:00.000Z",
    editedAt: null,
    text: testCase.text,
    chat: { id: -100, type: "supergroup", title: "Project", username: null },
    actor: {
      id: testCase.senderUsername === "alice" ? 1 : 2,
      isBot: false,
      firstName: testCase.senderUsername === "alice" ? "Alice" : "Bob",
      lastName: null,
      username: testCase.senderUsername,
      languageCode: "en",
    },
    replyToMessageId: null,
    messageThreadId: null,
    raw: {},
  };
}

describe("project event Structured Outputs schema", () => {
  it("produces a strict root object schema for the Responses API", () => {
    const format = zodTextFormat(
      modelProjectEventResponseSchema,
      "taskgoblin_project_event",
    );
    expect(format).toMatchObject({
      type: "json_schema",
      strict: true,
      name: "taskgoblin_project_event",
      schema: {
        type: "object",
        additionalProperties: false,
      },
    });
  });
});

describe("project event post-validation", () => {
  it("preserves the trusted Telegram source id and resolves only known usernames", () => {
    const message = messageFor({
      id: "known-owner",
      category: "assignment",
      text: "@alice please prepare the budget",
      senderUsername: "bob",
      expectedEventType: "explicit_task_assignment",
    });
    const event = validateProjectEvent(
      {
        eventType: "explicit_task_assignment",
        title: "Prepare the budget",
        ownerUsername: "@alice",
        deadlineText: null,
        confidence: 0.92,
        rationale: "Explicit assignment.",
      },
      message,
      baseContext,
    );
    expect(event).toMatchObject({
      sourceTelegramMessageId: 9001,
      ownerTelegramUserRecordId: "user-alice",
    });

    expect(
      validateProjectEvent(
        {
          eventType: "explicit_task_assignment",
          title: "Prepare the budget",
          ownerUsername: "charlie",
          deadlineText: null,
          confidence: 0.92,
          rationale: "Explicit assignment.",
        },
        message,
        baseContext,
      ),
    ).toBeNull();
  });

  it("rejects invented deadlines and invalid task matches", () => {
    const message = messageFor({
      id: "invalid-output",
      category: "validation",
      text: "I finished the project UI",
      senderUsername: "alice",
      expectedEventType: "possible_task_completion",
    });
    expect(
      validateProjectEvent(
        {
          eventType: "deadline_update",
          summary: "Move the UI deadline",
          matchedTaskId: "task-ui",
          deadlineText: "next month",
          confidence: 0.95,
          rationale: "Deadline update.",
        },
        message,
        baseContext,
      ),
    ).toBeNull();
    expect(
      validateProjectEvent(
        {
          eventType: "possible_task_completion",
          summary: "Project UI finished",
          matchedTaskId: "invented-task",
          confidence: 0.95,
          rationale: "Completion claim.",
        },
        message,
        baseContext,
      ),
    ).toBeNull();
  });

  it("resolves relative deadlines from the message timestamp and project timezone", () => {
    expect(
      resolveDeadline(
        "tomorrow",
        "2026-07-27T04:00:00.000Z",
        "Asia/Singapore",
      ),
    ).toBe("2026-07-28T15:59:00.000Z");
    expect(
      resolveDeadline(
        "next Tuesday",
        "2026-07-27T04:00:00.000Z",
        "Asia/Singapore",
      ),
    ).toBe("2026-08-04T15:59:00.000Z");
  });

  it("uses deterministic mock mode without a provider key", async () => {
    const testCase = (fixtures.cases as FixtureCase[]).find(
      (candidate) => candidate.id === "decision-1",
    )!;
    const result = await detectProjectEvent(
      messageFor(testCase),
      baseContext,
      { mode: "mock" },
    );
    expect(result).toMatchObject({
      provider: "mock",
      model: "deterministic-v1",
      event: { eventType: "decision", sourceTelegramMessageId: 9001 },
    });
  });
});

describe("held-out deterministic event fixtures", () => {
  it("measures exact-type precision and recall", () => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;

    for (const testCase of fixtures.cases as FixtureCase[]) {
      const context = {
        ...baseContext,
        recentCandidates: testCase.recentCandidates ?? [],
      };
      const output = detectMockProjectEvent(messageFor(testCase), context);
      const event = validateProjectEvent(output, messageFor(testCase), context);
      const predicted = event?.eventType ?? "none";

      if (predicted === testCase.expectedEventType) {
        if (predicted !== "none") truePositive += 1;
      } else {
        if (predicted !== "none") falsePositive += 1;
        if (testCase.expectedEventType !== "none") falseNegative += 1;
      }

      expect(predicted, testCase.id).toBe(testCase.expectedEventType);
      if (testCase.expectedMatchedTaskId) {
        expect(event?.matchedTaskId, testCase.id).toBe(
          testCase.expectedMatchedTaskId,
        );
      }
      if (testCase.expectedDuplicate) {
        expect(
          Boolean(event?.duplicateOfTaskId || event?.duplicateOfCandidateId),
          testCase.id,
        ).toBe(true);
      }
      if (testCase.expectResolvedDeadline) {
        expect(event?.dueAt, testCase.id).toBeTruthy();
      }
    }

    const precision = truePositive / (truePositive + falsePositive);
    const recall = truePositive / (truePositive + falseNegative);
    process.stdout.write(
      `Held-out event fixture metrics: precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}\n`,
    );
    expect(precision).toBeGreaterThanOrEqual(0.9);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });
});

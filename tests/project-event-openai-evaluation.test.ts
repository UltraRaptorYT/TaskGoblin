import { loadEnvConfig } from "@next/env";
import { describe, expect, it } from "vitest";

import {
  detectProjectEvent,
  type ProjectDetectionContext,
} from "@/lib/project-event-detection";
import type { ProjectEventType } from "@/lib/project-event-schemas";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";
import fixtures from "@/tests/fixtures/telegram-event-detection-held-out.json";

loadEnvConfig(process.cwd());

type FixtureCase = {
  id: string;
  text: string;
  senderUsername: string;
  expectedEventType: ProjectEventType | "none";
  recentCandidates?: ProjectDetectionContext["recentCandidates"];
  recentMessages?: ProjectDetectionContext["recentMessages"];
  replyToMessageId?: number | null;
};

const context: ProjectDetectionContext = {
  projectId: "held-out-project",
  timezone: "Asia/Singapore",
  members: fixtures.members,
  tasks: fixtures.tasks as ProjectDetectionContext["tasks"],
  recentCandidates: [],
  recentMessages: [],
};

describe.runIf(process.env.RUN_OPENAI_EVAL === "1")(
  "held-out OpenAI event evaluation",
  () => {
    it(
      "measures exact-type precision and recall",
      async () => {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY is required for the live evaluation.");
        }
        let truePositive = 0;
        let falsePositive = 0;
        let falseNegative = 0;
        const mismatches: string[] = [];

        const configuredLimit = Number(process.env.OPENAI_EVAL_LIMIT);
        const cases =
          Number.isInteger(configuredLimit) && configuredLimit > 0
            ? (fixtures.cases as FixtureCase[]).slice(0, configuredLimit)
            : (fixtures.cases as FixtureCase[]);
        const evaluated: Array<{
          testCase: FixtureCase;
          predicted: ProjectEventType | "none";
        }> = [];
        for (let index = 0; index < cases.length; index += 5) {
          const batch = cases.slice(index, index + 5);
          evaluated.push(
            ...(await Promise.all(
              batch.map(async (testCase) => {
                const result = await detectProjectEvent(
                  messageFor(testCase),
                  {
                    ...context,
                    recentCandidates: testCase.recentCandidates ?? [],
                    recentMessages: testCase.recentMessages ?? [],
                  },
                  { mode: "openai" },
                );
                return {
                  testCase,
                  predicted: result.event?.eventType ?? "none",
                };
              }),
            )),
          );
        }

        for (const { testCase, predicted } of evaluated) {
          if (predicted === testCase.expectedEventType) {
            if (predicted !== "none") truePositive += 1;
          } else {
            if (predicted !== "none") falsePositive += 1;
            if (testCase.expectedEventType !== "none") falseNegative += 1;
            mismatches.push(
              `${testCase.id}: expected=${testCase.expectedEventType} predicted=${predicted}`,
            );
          }
        }

        const precision = truePositive / (truePositive + falsePositive);
        const recall = truePositive / (truePositive + falseNegative);
        process.stdout.write(
          [
            `OpenAI held-out metrics: precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}`,
            ...mismatches,
            "",
          ].join("\n"),
        );
        expect(precision).toBeGreaterThanOrEqual(0.75);
        expect(recall).toBeGreaterThanOrEqual(0.75);
      },
      180_000,
    );
  },
);

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
    newChatMembers: [],
    replyToMessageId: testCase.replyToMessageId ?? null,
    messageThreadId: null,
    raw: {},
  };
}

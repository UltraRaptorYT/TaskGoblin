import { describe, expect, it } from "vitest";

import {
  detectDeterministicTaskCandidate,
  transitionTaskCandidateState,
} from "@/lib/task-candidates";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

const baseMessage: TelegramInboundMessage = {
  kind: "message",
  updateId: 1,
  updateType: "message",
  messageId: 2,
  sentAt: null,
  editedAt: null,
  text: "",
  chat: { id: -10, type: "group", title: "Project", username: null },
  actor: {
    id: 42,
    isBot: false,
    firstName: "Alex",
    lastName: null,
    username: "alex",
    languageCode: "en",
  },
  newChatMembers: [],
  replyToMessageId: null,
  messageThreadId: null,
  raw: {},
};

describe("deterministic task candidates", () => {
  it("detects explicit commitments and assigns them to the sender", () => {
    expect(
      detectDeterministicTaskCandidate({
        ...baseMessage,
        text: "I will prepare the demo by Friday",
      }),
    ).toMatchObject({
      title: "I will prepare the demo by Friday",
      assignToSender: true,
    });
  });

  it("detects explicit requests but ignores vague ideas and commands", () => {
    expect(
      detectDeterministicTaskCandidate({
        ...baseMessage,
        text: "Alex, please prepare the demo",
      }),
    ).toMatchObject({ assignToSender: false });
    expect(
      detectDeterministicTaskCandidate({
        ...baseMessage,
        text: "Maybe we should make a demo",
      }),
    ).toBeNull();
    expect(
      detectDeterministicTaskCandidate({
        ...baseMessage,
        text: "/tasks please",
      }),
    ).toBeNull();
  });
});

describe("task candidate state machine", () => {
  it("supports every valid Phase 1 transition", () => {
    expect(transitionTaskCandidateState("detected", "queue")).toBe(
      "awaiting_confirmation",
    );
    expect(
      transitionTaskCandidateState("awaiting_confirmation", "confirm"),
    ).toBe("confirmed");
    expect(
      transitionTaskCandidateState("awaiting_confirmation", "edit"),
    ).toBe("edited");
    expect(
      transitionTaskCandidateState("awaiting_confirmation", "ignore"),
    ).toBe("ignored");
  });

  it("rejects invalid and repeated terminal transitions", () => {
    expect(() =>
      transitionTaskCandidateState("detected", "confirm"),
    ).toThrow(/Invalid task candidate transition/);
    expect(() =>
      transitionTaskCandidateState("confirmed", "ignore"),
    ).toThrow(/Invalid task candidate transition/);
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  candidateCallbackData,
  parseCandidateCallbackData,
  parseProjectEventCandidateCallbackData,
  projectEventCandidateCallbackData,
} from "@/lib/telegram-callbacks";
import {
  handleCandidateCallback,
  handleProjectEventCandidateCallback,
} from "@/lib/telegram-handler";
import type { TelegramInboundCallback } from "@/lib/taskgoblin-types";

const candidateId = "123e4567-e89b-12d3-a456-426614174000";

describe("candidate callbacks", () => {
  it("round-trips valid callback data and rejects malformed values", () => {
    const value = candidateCallbackData("confirm", candidateId);
    expect(value.length).toBeLessThanOrEqual(64);
    expect(parseCandidateCallbackData(value)).toEqual({
      action: "confirm",
      candidateId,
    });
    expect(parseCandidateCallbackData("tg:c:delete:bad")).toBeNull();
  });

  it("round-trips project event callback data independently from legacy task candidates", () => {
    const value = projectEventCandidateCallbackData("confirm", candidateId);
    expect(value.length).toBeLessThanOrEqual(64);
    expect(parseProjectEventCandidateCallbackData(value)).toEqual({
      action: "confirm",
      candidateId,
    });
    expect(parseCandidateCallbackData(value)).toBeNull();
  });

  it("reviews the candidate, acknowledges Telegram, and clears the keyboard", async () => {
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 10,
      updateType: "callback_query",
      callbackQueryId: "callback-10",
      data: candidateCallbackData("confirm", candidateId),
      chat: { id: -100, type: "supergroup", title: "Project", username: null },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 99,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const clearKeyboard = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const reviewCandidate = vi.fn().mockResolvedValue({
      candidateId,
      state: "confirmed",
      taskId: "task-1",
      title: "Prepare the demo",
    });

    const result = await handleCandidateCallback(
      update,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-1",
        projectId: "project-1",
        displayName: "Alex",
      },
      { answerCallback, clearKeyboard, sendMessage, reviewCandidate },
    );

    expect(reviewCandidate).toHaveBeenCalledWith(candidateId, "confirm");
    expect(answerCallback).toHaveBeenCalledWith(
      "callback-10",
      "Task confirmed.",
    );
    expect(clearKeyboard).toHaveBeenCalledWith(-100, 99);
    expect(sendMessage).toHaveBeenCalledWith(
      -100,
      "Task created: Prepare the demo",
    );
    expect(result).toMatchObject({ handled: true, replySent: true });
  });

  it("applies a reviewed project event only after a callback", async () => {
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 11,
      updateType: "callback_query",
      callbackQueryId: "callback-11",
      data: projectEventCandidateCallbackData("confirm", candidateId),
      chat: { id: -100, type: "supergroup", title: "Project", username: null },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 100,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const clearKeyboard = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const reviewCandidate = vi.fn().mockResolvedValue({
      candidateId,
      state: "confirmed",
      taskId: "task-1",
      eventType: "possible_task_completion",
      summary: "Project UI finished",
    });

    const result = await handleProjectEventCandidateCallback(
      update,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-1",
        projectId: "project-1",
        displayName: "Alex",
      },
      { answerCallback, clearKeyboard, sendMessage, reviewCandidate },
    );

    expect(reviewCandidate).toHaveBeenCalledWith(candidateId, "confirm");
    expect(answerCallback).toHaveBeenCalledWith(
      "callback-11",
      "Project event confirmed.",
    );
    expect(sendMessage).toHaveBeenCalledWith(
      -100,
      "Project event recorded: Project UI finished",
    );
    expect(result).toMatchObject({ handled: true, replySent: true });
  });
});

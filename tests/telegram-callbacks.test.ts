import { describe, expect, it, vi } from "vitest";

import {
  bulkAssignmentCallbackData,
  candidateBatchCallbackData,
  candidateCallbackData,
  parseBulkAssignmentCallbackData,
  parseCandidateBatchCallbackData,
  parseCandidateCallbackData,
  parseCandidateDeadlineCallbackData,
  parseCandidateEditCallbackData,
  parseEditSessionChoiceCallbackData,
  parseProjectHomeCallbackData,
  parseProjectEventCandidateCallbackData,
  parseProjectNameCallbackData,
  parseTaskViewCallbackData,
  parseTaskActionCallbackData,
  parseTaskDeadlineCallbackData,
  parseTaskSnoozeCallbackData,
  candidateDeadlineCallbackData,
  candidateEditCallbackData,
  editSessionChoiceCallbackData,
  projectHomeCallbackData,
  projectEventCandidateCallbackData,
  projectNameCallbackData,
  taskViewCallbackData,
  taskActionCallbackData,
  taskDeadlineCallbackData,
  taskSnoozeCallbackData,
} from "@/lib/telegram-callbacks";
import {
  handleBulkAssignmentCallback,
  handleCandidateBatchCallback,
  handleCandidateCallback,
  handleProjectEventCandidateCallback,
  handleProjectNameCallback,
  handleTaskViewCallback,
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

  it("round-trips task selection callback data", () => {
    const value = taskViewCallbackData("task-1");
    expect(parseTaskViewCallbackData(value)).toEqual({ taskId: "task-1" });
    expect(parseTaskViewCallbackData("tg:t:v:bad task")).toBeNull();
  });

  it("round-trips task actions, deadline presets, and snooze controls", () => {
    expect(
      parseTaskActionCallbackData(taskActionCallbackData("complete", "task-1")),
    ).toEqual({ action: "complete", taskId: "task-1" });
    expect(
      parseTaskDeadlineCallbackData(taskDeadlineCallbackData("tomorrow", "task-1")),
    ).toEqual({ preset: "tomorrow", taskId: "task-1" });
    expect(
      parseTaskSnoozeCallbackData(taskSnoozeCallbackData("one_hour", "task-1")),
    ).toEqual({ preset: "one_hour", taskId: "task-1" });
  });

  it("round-trips project home and candidate edit controls", () => {
    expect(parseProjectHomeCallbackData(projectHomeCallbackData("due_today"))).toEqual({
      action: "due_today",
    });
    expect(
      parseCandidateEditCallbackData(candidateEditCallbackData("owner", candidateId)),
    ).toEqual({ field: "owner", candidateId });
    expect(
      parseCandidateDeadlineCallbackData(
        candidateDeadlineCallbackData("next_week", candidateId),
      ),
    ).toEqual({ preset: "next_week", candidateId });
    expect(
      parseEditSessionChoiceCallbackData(
        editSessionChoiceCallbackData(candidateId, 3),
      ),
    ).toEqual({ optionIndex: 3, sessionId: candidateId });
  });

  it("round-trips batch and project-name review callbacks", () => {
    const batch = candidateBatchCallbackData("confirm", candidateId);
    const projectName = projectNameCallbackData("ignore", candidateId);

    expect(parseCandidateBatchCallbackData(batch)).toEqual({
      action: "confirm",
      batchId: candidateId,
    });
    expect(parseProjectNameCallbackData(projectName)).toEqual({
      action: "ignore",
      candidateId,
    });
    expect(parseCandidateCallbackData(batch)).toBeNull();
  });

  it("round-trips and applies a bulk assignment confirmation", async () => {
    const data = bulkAssignmentCallbackData("confirm", candidateId);
    expect(parseBulkAssignmentCallbackData(data)).toEqual({
      action: "confirm",
      candidateId,
    });
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 15,
      updateType: "callback_query",
      callbackQueryId: "callback-15",
      data,
      chat: { id: -100, type: "supergroup", title: "Project", username: null },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 105,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const clearKeyboard = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const reviewCandidate = vi.fn().mockResolvedValue({
      candidateId,
      state: "confirmed",
      targetOwnerDisplayName: "Hong Yu",
      assignedTaskCount: 17,
    });

    const result = await handleBulkAssignmentCallback(
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
      "callback-15",
      "17 tasks assigned.",
    );
    expect(sendMessage).toHaveBeenCalledWith(
      -100,
      "Assigned 17 active tasks to Hong Yu.",
    );
    expect(result).toMatchObject({ handled: true, replySent: true });
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

  it("loads an authorised selected task and sends its details", async () => {
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 12,
      updateType: "callback_query",
      callbackQueryId: "callback-12",
      data: taskViewCallbackData("task-1"),
      chat: { id: 42, type: "private", title: null, username: "alex" },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 101,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const loadTask = vi.fn().mockResolvedValue({
      id: "task-1",
      project_id: "project-1",
      project_name: "Website Launch",
      title: "Implement endpoints",
      description: "Build the JSON API schema.",
      status: "doing",
      priority: "high",
      source_participant_name: "Alex",
      due_label: "Friday",
      due_at: "2026-07-31T09:00:00.000Z",
      blocked_by: null,
      owner_telegram_user_id: "user-1",
      updated_at: "2026-07-28T00:00:00.000Z",
    });

    const result = await handleTaskViewCallback(
      update,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-1",
        projectId: null,
        displayName: "Alex",
      },
      { answerCallback, sendMessage, loadTask },
    );

    expect(loadTask).toHaveBeenCalledWith("task-1");
    expect(answerCallback).toHaveBeenCalledWith(
      "callback-12",
      "Task details",
    );
    expect(sendMessage).toHaveBeenCalledWith(
      42,
      expect.stringMatching(/Website Launch[\s\S]*Status: doing/),
    );
    expect(result).toMatchObject({ handled: true, replySent: true });
  });

  it("creates every task in a confirmed agent batch", async () => {
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 13,
      updateType: "callback_query",
      callbackQueryId: "callback-13",
      data: candidateBatchCallbackData("confirm", candidateId),
      chat: { id: -100, type: "supergroup", title: "Project", username: null },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 102,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const clearKeyboard = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const reviewBatch = vi.fn().mockResolvedValue({
      batchId: candidateId,
      state: "confirmed",
      taskIds: ["task-1", "task-2"],
      titles: ["Write the report", "Prepare the demo"],
    });

    const result = await handleCandidateBatchCallback(
      update,
      {
        chatRecordId: "chat-1",
        userRecordId: "user-1",
        projectId: "project-1",
        displayName: "Alex",
      },
      { answerCallback, clearKeyboard, sendMessage, reviewBatch },
    );

    expect(reviewBatch).toHaveBeenCalledWith(candidateId, "confirm");
    expect(sendMessage).toHaveBeenCalledWith(
      -100,
      expect.stringMatching(/Created 2 separate tasks[\s\S]*Prepare the demo/),
    );
    expect(result).toMatchObject({ handled: true, replySent: true });
  });

  it("renames a project only after a confirmation callback", async () => {
    const update: TelegramInboundCallback = {
      kind: "callback_query",
      updateId: 14,
      updateType: "callback_query",
      callbackQueryId: "callback-14",
      data: projectNameCallbackData("confirm", candidateId),
      chat: { id: -100, type: "supergroup", title: "Project", username: null },
      actor: {
        id: 42,
        isBot: false,
        firstName: "Alex",
        lastName: null,
        username: "alex",
        languageCode: null,
      },
      messageId: 103,
      raw: {},
    };
    const answerCallback = vi.fn().mockResolvedValue({ sent: true });
    const clearKeyboard = vi.fn().mockResolvedValue({ sent: true });
    const sendMessage = vi.fn().mockResolvedValue({ sent: true });
    const reviewCandidate = vi.fn().mockResolvedValue({
      candidateId,
      state: "confirmed",
      projectName: "Taxi Data Analytics",
    });

    await handleProjectNameCallback(
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
    expect(sendMessage).toHaveBeenCalledWith(
      -100,
      "Project renamed to Taxi Data Analytics. The website now uses this name.",
    );
  });
});

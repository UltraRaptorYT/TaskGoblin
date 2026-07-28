import type { TaskCandidateState } from "@/lib/taskgoblin-types";

export type CandidateCallbackAction = "confirm" | "edit" | "ignore";

export type CandidateCallback = {
  action: CandidateCallbackAction;
  candidateId: string;
};

export type TaskViewCallback = {
  taskId: string;
};

const CALLBACK_PATTERN =
  /^tg:c:(confirm|edit|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const PROJECT_EVENT_CALLBACK_PATTERN =
  /^tg:e:(confirm|edit|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const TASK_VIEW_CALLBACK_PATTERN = /^tg:t:v:([a-z0-9][a-z0-9_-]{0,49})$/i;

export function candidateCallbackData(
  action: CandidateCallbackAction,
  candidateId: string,
) {
  return `tg:c:${action}:${candidateId}`;
}

export function parseCandidateCallbackData(
  value: string | null,
): CandidateCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(CALLBACK_PATTERN);
  if (!match) return null;
  return {
    action: match[1].toLowerCase() as CandidateCallbackAction,
    candidateId: match[2].toLowerCase(),
  };
}

export function projectEventCandidateCallbackData(
  action: CandidateCallbackAction,
  candidateId: string,
) {
  return `tg:e:${action}:${candidateId}`;
}

export function parseProjectEventCandidateCallbackData(
  value: string | null,
): CandidateCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(PROJECT_EVENT_CALLBACK_PATTERN);
  if (!match) return null;
  return {
    action: match[1].toLowerCase() as CandidateCallbackAction,
    candidateId: match[2].toLowerCase(),
  };
}

export function taskViewCallbackData(taskId: string) {
  const value = `tg:t:v:${taskId}`;
  if (!TASK_VIEW_CALLBACK_PATTERN.test(value) || value.length > 64) {
    throw new Error("Task ID cannot be used in Telegram callback data.");
  }
  return value;
}

export function parseTaskViewCallbackData(
  value: string | null,
): TaskViewCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(TASK_VIEW_CALLBACK_PATTERN);
  if (!match) return null;
  return { taskId: match[1] };
}

export function callbackResultState(
  action: CandidateCallbackAction,
): TaskCandidateState {
  if (action === "confirm") return "confirmed";
  if (action === "edit") return "edited";
  return "ignored";
}

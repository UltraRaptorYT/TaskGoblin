import type { TaskCandidateState } from "@/lib/taskgoblin-types";

export type CandidateCallbackAction = "confirm" | "edit" | "ignore";

export type CandidateCallback = {
  action: CandidateCallbackAction;
  candidateId: string;
};

export type TaskViewCallback = {
  taskId: string;
};

export type CandidateBatchCallback = {
  action: "confirm" | "ignore";
  batchId: string;
};

export type ProjectNameCallback = {
  action: "confirm" | "ignore";
  candidateId: string;
};

export type BulkAssignmentCallback = {
  action: "confirm" | "ignore";
  candidateId: string;
};

const CALLBACK_PATTERN =
  /^tg:c:(confirm|edit|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const PROJECT_EVENT_CALLBACK_PATTERN =
  /^tg:e:(confirm|edit|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const TASK_VIEW_CALLBACK_PATTERN = /^tg:t:v:([a-z0-9][a-z0-9_-]{0,49})$/i;
const CANDIDATE_BATCH_CALLBACK_PATTERN =
  /^tg:b:(confirm|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const PROJECT_NAME_CALLBACK_PATTERN =
  /^tg:n:(confirm|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const BULK_ASSIGNMENT_CALLBACK_PATTERN =
  /^tg:a:(confirm|ignore):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

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

export function candidateBatchCallbackData(
  action: CandidateBatchCallback["action"],
  batchId: string,
) {
  return `tg:b:${action}:${batchId}`;
}

export function parseCandidateBatchCallbackData(
  value: string | null,
): CandidateBatchCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(CANDIDATE_BATCH_CALLBACK_PATTERN);
  if (!match) return null;
  return {
    action: match[1].toLowerCase() as CandidateBatchCallback["action"],
    batchId: match[2].toLowerCase(),
  };
}

export function projectNameCallbackData(
  action: ProjectNameCallback["action"],
  candidateId: string,
) {
  return `tg:n:${action}:${candidateId}`;
}

export function parseProjectNameCallbackData(
  value: string | null,
): ProjectNameCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(PROJECT_NAME_CALLBACK_PATTERN);
  if (!match) return null;
  return {
    action: match[1].toLowerCase() as ProjectNameCallback["action"],
    candidateId: match[2].toLowerCase(),
  };
}

export function bulkAssignmentCallbackData(
  action: BulkAssignmentCallback["action"],
  candidateId: string,
) {
  return `tg:a:${action}:${candidateId}`;
}

export function parseBulkAssignmentCallbackData(
  value: string | null,
): BulkAssignmentCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(BULK_ASSIGNMENT_CALLBACK_PATTERN);
  if (!match) return null;
  return {
    action: match[1].toLowerCase() as BulkAssignmentCallback["action"],
    candidateId: match[2].toLowerCase(),
  };
}

export function callbackResultState(
  action: CandidateCallbackAction,
): TaskCandidateState {
  if (action === "confirm") return "confirmed";
  if (action === "edit") return "edited";
  return "ignored";
}

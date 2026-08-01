import type { TaskCandidateState } from "@/lib/taskgoblin-types";

export type CandidateCallbackAction = "confirm" | "edit" | "ignore";

export type CandidateCallback = {
  action: CandidateCallbackAction;
  candidateId: string;
};

export type TaskViewCallback = {
  taskId: string;
};

export type TaskAction =
  | "view"
  | "complete"
  | "reopen"
  | "edit_title"
  | "edit_owner"
  | "edit_deadline"
  | "snooze";

export type TaskActionCallback = {
  action: TaskAction;
  taskId: string;
};

export type DeadlinePreset = "today" | "tomorrow" | "next_week" | "clear";
export type SnoozePreset = "one_hour" | "tomorrow_morning";
export type ProjectHomeAction =
  | "home"
  | "tasks"
  | "due_today"
  | "calendar"
  | "dashboard"
  | "settings";
export type CandidateEditField = "title" | "owner" | "deadline";

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
const TASK_ACTION_CALLBACK_PATTERN =
  /^tg:t:([vcrnods]):([a-z0-9][a-z0-9_-]{0,44})$/i;
const TASK_DEADLINE_CALLBACK_PATTERN =
  /^tg:d:([tmwc]):([a-z0-9][a-z0-9_-]{0,44})$/i;
const TASK_SNOOZE_CALLBACK_PATTERN =
  /^tg:s:([ht]):([a-z0-9][a-z0-9_-]{0,44})$/i;
const PROJECT_HOME_CALLBACK_PATTERN = /^tg:h:([htdcws])$/i;
const CANDIDATE_EDIT_CALLBACK_PATTERN =
  /^tg:ce:([tod]):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const CANDIDATE_DEADLINE_CALLBACK_PATTERN =
  /^tg:cd:([tmwc]):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const EDIT_SESSION_CHOICE_CALLBACK_PATTERN =
  /^tg:x:([0-9]{1,2}):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
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

const TASK_ACTION_CODES: Record<string, TaskAction> = {
  v: "view",
  c: "complete",
  r: "reopen",
  n: "edit_title",
  o: "edit_owner",
  d: "edit_deadline",
  s: "snooze",
};

const TASK_ACTION_VALUES: Record<TaskAction, string> = {
  view: "v",
  complete: "c",
  reopen: "r",
  edit_title: "n",
  edit_owner: "o",
  edit_deadline: "d",
  snooze: "s",
};

export function taskActionCallbackData(action: TaskAction, taskId: string) {
  const value = `tg:t:${TASK_ACTION_VALUES[action]}:${taskId}`;
  if (!TASK_ACTION_CALLBACK_PATTERN.test(value) || value.length > 64) {
    throw new Error("Task ID cannot be used in Telegram callback data.");
  }
  return value;
}

export function parseTaskActionCallbackData(
  value: string | null,
): TaskActionCallback | null {
  if (!value || value.length > 64) return null;
  const match = value.match(TASK_ACTION_CALLBACK_PATTERN);
  if (!match) return null;
  return { action: TASK_ACTION_CODES[match[1].toLowerCase()], taskId: match[2] };
}

const DEADLINE_CODES: Record<string, DeadlinePreset> = {
  t: "today",
  m: "tomorrow",
  w: "next_week",
  c: "clear",
};

const DEADLINE_VALUES: Record<DeadlinePreset, string> = {
  today: "t",
  tomorrow: "m",
  next_week: "w",
  clear: "c",
};

export function taskDeadlineCallbackData(
  preset: DeadlinePreset,
  taskId: string,
) {
  return `tg:d:${DEADLINE_VALUES[preset]}:${taskId}`;
}

export function parseTaskDeadlineCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(TASK_DEADLINE_CALLBACK_PATTERN);
  return match
    ? { preset: DEADLINE_CODES[match[1].toLowerCase()], taskId: match[2] }
    : null;
}

export function taskSnoozeCallbackData(preset: SnoozePreset, taskId: string) {
  return `tg:s:${preset === "one_hour" ? "h" : "t"}:${taskId}`;
}

export function parseTaskSnoozeCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(TASK_SNOOZE_CALLBACK_PATTERN);
  return match
    ? {
        preset: (match[1].toLowerCase() === "h"
          ? "one_hour"
          : "tomorrow_morning") as SnoozePreset,
        taskId: match[2],
      }
    : null;
}

const HOME_CODES: Record<string, ProjectHomeAction> = {
  h: "home",
  t: "tasks",
  d: "due_today",
  c: "calendar",
  w: "dashboard",
  s: "settings",
};

const HOME_VALUES: Record<ProjectHomeAction, string> = {
  home: "h",
  tasks: "t",
  due_today: "d",
  calendar: "c",
  dashboard: "w",
  settings: "s",
};

export function projectHomeCallbackData(action: ProjectHomeAction) {
  return `tg:h:${HOME_VALUES[action]}`;
}

export function parseProjectHomeCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(PROJECT_HOME_CALLBACK_PATTERN);
  return match ? { action: HOME_CODES[match[1].toLowerCase()] } : null;
}

const CANDIDATE_EDIT_CODES: Record<string, CandidateEditField> = {
  t: "title",
  o: "owner",
  d: "deadline",
};

const CANDIDATE_EDIT_VALUES: Record<CandidateEditField, string> = {
  title: "t",
  owner: "o",
  deadline: "d",
};

export function candidateEditCallbackData(
  field: CandidateEditField,
  candidateId: string,
) {
  return `tg:ce:${CANDIDATE_EDIT_VALUES[field]}:${candidateId}`;
}

export function parseCandidateEditCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(CANDIDATE_EDIT_CALLBACK_PATTERN);
  return match
    ? {
        field: CANDIDATE_EDIT_CODES[match[1].toLowerCase()],
        candidateId: match[2].toLowerCase(),
      }
    : null;
}

export function candidateDeadlineCallbackData(
  preset: DeadlinePreset,
  candidateId: string,
) {
  return `tg:cd:${DEADLINE_VALUES[preset]}:${candidateId}`;
}

export function parseCandidateDeadlineCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(CANDIDATE_DEADLINE_CALLBACK_PATTERN);
  return match
    ? {
        preset: DEADLINE_CODES[match[1].toLowerCase()],
        candidateId: match[2].toLowerCase(),
      }
    : null;
}

export function editSessionChoiceCallbackData(
  sessionId: string,
  optionIndex: number,
) {
  const value = `tg:x:${optionIndex}:${sessionId}`;
  if (!EDIT_SESSION_CHOICE_CALLBACK_PATTERN.test(value) || value.length > 64) {
    throw new Error("Edit-session choice cannot be used in Telegram callback data.");
  }
  return value;
}

export function parseEditSessionChoiceCallbackData(value: string | null) {
  if (!value || value.length > 64) return null;
  const match = value.match(EDIT_SESSION_CHOICE_CALLBACK_PATTERN);
  return match
    ? { optionIndex: Number(match[1]), sessionId: match[2].toLowerCase() }
    : null;
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

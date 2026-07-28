import { taskViewCallbackData } from "@/lib/telegram-callbacks";
import type { TelegramInlineKeyboard } from "@/lib/telegram-bot";
import type {
  TelegramProjectRow,
  TelegramTaskRow,
  TelegramUserTaskRow,
} from "@/lib/telegram-repository";

export type TelegramCommandResponse = {
  text: string;
  replyMarkup?: TelegramInlineKeyboard;
};

export function summaryResponse(
  project: TelegramProjectRow,
  tasks: TelegramTaskRow[],
  now = new Date(),
): TelegramCommandResponse {
  const done = tasks.filter((task) => task.status === "done");
  const active = tasks.filter((task) => task.status !== "done");
  const progress = tasks.length
    ? Math.round((done.length / tasks.length) * 100)
    : 0;
  const inProgress = active.filter((task) => task.status === "doing");
  const blockers = active.filter((task) => task.status === "blocked");
  const overdue = active.filter((task) => isOverdue(task, now));
  const upcoming = active
    .filter(
      (task) =>
        task.status !== "doing" &&
        task.status !== "blocked" &&
        !isOverdue(task, now),
    )
    .sort(compareDueDates);

  return {
    text: [
      `📌 ${project.name} Summary`,
      "",
      "Progress:",
      `${progress}% completed (${done.length}/${tasks.length} confirmed tasks)`,
      "",
      "Completed:",
      ...taskLines(done, "✅"),
      "",
      "In progress:",
      ...taskLines(inProgress, "🟡"),
      "",
      "Overdue:",
      ...taskLines(overdue, "🔴"),
      "",
      "Upcoming:",
      ...taskLines(upcoming, "🔴"),
      "",
      "Current blockers:",
      ...(blockers.length
        ? blockers.slice(0, 5).map((task) =>
            task.blocked_by
              ? `⛔ ${task.title} — ${task.blocked_by}`
              : `⛔ ${task.title}`,
          )
        : ["None"]),
    ].join("\n"),
    replyMarkup: taskMenu(active),
  };
}

export function projectResponse(
  project: TelegramProjectRow,
  tasks: TelegramTaskRow[],
): TelegramCommandResponse {
  const active = tasks.filter((task) => task.status !== "done");
  const done = tasks.length - active.length;
  const priorities = [...active].sort(comparePriorityThenDue).slice(0, 5);

  return {
    text: [
      `📁 Project: ${project.name}`,
      "",
      "Goal:",
      project.description?.trim() || "Not configured yet.",
      "",
      "Current phase:",
      "Not configured yet.",
      "",
      "Current state:",
      `${active.length} active · ${done} completed · ${active.filter((task) => task.status === "blocked").length} blocked`,
      "",
      "Main priorities:",
      ...(priorities.length
        ? priorities.map(
            (task, index) =>
              `${index + 1}. [${task.priority}] ${task.title}${dueSuffix(task)}`,
          )
        : ["No active confirmed tasks."]),
    ].join("\n"),
    replyMarkup: taskMenu(priorities),
  };
}

export function kpiResponse(
  project: TelegramProjectRow,
  tasks: TelegramTaskRow[],
  now = new Date(),
): TelegramCommandResponse {
  const completed = tasks.filter((task) => task.status === "done").length;
  const open = tasks.length - completed;
  const rate = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const overdue = tasks.filter(
    (task) => task.status !== "done" && isOverdue(task, now),
  ).length;
  const blockers = tasks.filter((task) => task.status === "blocked").length;
  const unassigned = tasks.filter(
    (task) =>
      task.status !== "done" &&
      !task.owner_telegram_user_id &&
      !task.source_participant_name,
  ).length;

  return {
    text: [
      `📊 ${project.name} KPIs`,
      "",
      `Open tasks: ${open}`,
      `Completed tasks: ${completed}`,
      `Completion rate: ${rate}%`,
      `Overdue tasks: ${overdue}`,
      `Active blockers: ${blockers}`,
      `Tasks without owners: ${unassigned}`,
      "",
      "Calculated only from confirmed stored tasks.",
    ].join("\n"),
  };
}

export function tasksResponse(
  project: TelegramProjectRow,
  tasks: TelegramTaskRow[],
): TelegramCommandResponse {
  const active = tasks
    .filter((task) => task.status !== "done")
    .sort(comparePriorityThenDue);
  if (!active.length) {
    return { text: `📋 ${project.name}\n\nNo active confirmed tasks.` };
  }
  return {
    text: [
      `📋 ${project.name} tasks`,
      "",
      ...active.slice(0, 20).map((task) => formattedTaskLine(task)),
      ...(active.length > 20 ? [`…and ${active.length - 20} more.`] : []),
      "",
      "Select a task below for details.",
    ].join("\n"),
    replyMarkup: taskMenu(active),
  };
}

export function groupMyTasksResponse(
  project: TelegramProjectRow,
  tasks: TelegramTaskRow[],
  telegramUserRecordId: string | null,
): TelegramCommandResponse {
  if (!telegramUserRecordId) {
    return { text: "I could not identify your Telegram account." };
  }
  const mine = tasks.filter(
    (task) => task.owner_telegram_user_id === telegramUserRecordId,
  );
  if (!mine.length) {
    return {
      text: `📋 ${project.name}\n\nNo confirmed tasks are assigned to you.`,
    };
  }
  return {
    text: [
      `🧭 My tasks · ${project.name}`,
      "",
      ...mine.map((task) => formattedTaskLine(task)),
      "",
      "Select a task below for details.",
    ].join("\n"),
    replyMarkup: taskMenu(mine),
  };
}

export function privateMyTasksResponse(
  tasks: TelegramUserTaskRow[],
): TelegramCommandResponse {
  if (!tasks.length) {
    return { text: "No confirmed tasks are assigned to you in any project." };
  }
  const projects = new Map<string, TelegramUserTaskRow[]>();
  for (const task of tasks) {
    const group = projects.get(task.project_id) ?? [];
    group.push(task);
    projects.set(task.project_id, group);
  }

  const lines = [
    "🧭 My TaskGoblin tasks",
    `${tasks.length} task${tasks.length === 1 ? "" : "s"} across ${projects.size} project${projects.size === 1 ? "" : "s"}`,
  ];
  for (const projectTasks of projects.values()) {
    lines.push("", `📁 ${projectTasks[0].project_name}`);
    lines.push(
      ...projectTasks
        .sort(comparePriorityThenDue)
        .map((task) => formattedTaskLine(task)),
    );
  }
  lines.push("", "Select a task below for details.");
  return {
    text: lines.join("\n"),
    replyMarkup: taskMenu(tasks, true),
  };
}

export function taskDetailMessage(task: TelegramUserTaskRow) {
  return [
    `📝 ${task.title}`,
    "",
    `Project: ${task.project_name}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Owner: ${task.source_participant_name ?? "Unassigned"}`,
    `Deadline: ${task.due_label ?? task.due_at ?? "None"}`,
    ...(task.description ? [`Description: ${task.description}`] : []),
    ...(task.blocked_by ? [`Blocker: ${task.blocked_by}`] : []),
  ].join("\n");
}

function taskMenu(
  tasks: Array<TelegramTaskRow | TelegramUserTaskRow>,
  includeProject = false,
): TelegramInlineKeyboard | undefined {
  const buttons = tasks.slice(0, 12).flatMap((task) => {
    try {
      const project =
        includeProject && "project_name" in task
          ? `${task.project_name} · `
          : "";
      return [
        [
          {
            text: truncate(
              `${statusEmoji(task.status)} ${project}${task.title}`,
              52,
            ),
            callback_data: taskViewCallbackData(task.id),
          },
        ],
      ];
    } catch {
      return [];
    }
  });
  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

function taskLines(tasks: TelegramTaskRow[], emoji: string) {
  return tasks.length
    ? tasks
        .slice(0, 5)
        .map((task) => `${emoji} ${task.title}${ownerAndDue(task)}`)
    : ["None"];
}

function formattedTaskLine(task: TelegramTaskRow) {
  return `${statusEmoji(task.status)} [${task.status}] ${task.title}${ownerAndDue(task)}`;
}

function ownerAndDue(task: TelegramTaskRow) {
  const owner = task.source_participant_name
    ? `\nOwner: ${task.source_participant_name}`
    : "";
  const due = task.due_label || task.due_at;
  return `${owner}${due ? `\nDeadline: ${due}` : ""}`;
}

function dueSuffix(task: TelegramTaskRow) {
  return task.due_label || task.due_at
    ? ` · due ${task.due_label ?? task.due_at}`
    : "";
}

function isOverdue(task: TelegramTaskRow, now: Date) {
  if (task.status === "overdue") return true;
  if (!task.due_at) return false;
  const due = new Date(task.due_at);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

function comparePriorityThenDue(a: TelegramTaskRow, b: TelegramTaskRow) {
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  const priority =
    (rank[a.priority as keyof typeof rank] ?? 4) -
    (rank[b.priority as keyof typeof rank] ?? 4);
  return priority || compareDueDates(a, b);
}

function compareDueDates(a: TelegramTaskRow, b: TelegramTaskRow) {
  const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_VALUE;
  const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_VALUE;
  return aTime - bTime;
}

function statusEmoji(status: string) {
  if (status === "done") return "✅";
  if (status === "blocked" || status === "overdue") return "🔴";
  if (status === "doing") return "🟡";
  return "⚪";
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}…`
    : value;
}

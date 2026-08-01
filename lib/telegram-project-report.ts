import { telegramProjectDashboardUrl } from "@/lib/telegram-links";
import type {
  TelegramProjectRow,
  TelegramTaskRow,
} from "@/lib/telegram-repository";

const DAY_MS = 24 * 60 * 60 * 1000;

export function singaporeReportDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dailyProjectReport(
  project: Pick<TelegramProjectRow, "id" | "name">,
  tasks: TelegramTaskRow[],
  now = new Date(),
) {
  const done = tasks.filter((task) => task.status === "done");
  const active = tasks.filter((task) => task.status !== "done");
  const blocked = active.filter((task) => task.status === "blocked");
  const overdue = active.filter((task) => isOverdue(task, now));
  const urgent = active
    .filter(
      (task) =>
        task.priority === "urgent" ||
        task.priority === "high" ||
        isOverdue(task, now) ||
        isDueWithin(task, now, 1),
    )
    .sort((left, right) => urgencyScore(right, now) - urgencyScore(left, now));
  const dueThisWeek = active
    .filter((task) => isDueWithin(task, now, 7) && !isOverdue(task, now))
    .sort(compareDueAt);
  const progress = tasks.length
    ? Math.round((done.length / tasks.length) * 100)
    : 0;
  const assignments = new Map<string, TelegramTaskRow[]>();
  for (const task of active) {
    const owner = task.source_participant_name?.trim() || "Unassigned";
    const ownerTasks = assignments.get(owner) ?? [];
    ownerTasks.push(task);
    assignments.set(owner, ownerTasks);
  }

  const lines = [
    `🌙 8pm project report · ${project.name}`,
    `Progress: ${progress}% (${done.length}/${tasks.length} tasks complete)`,
    `Active: ${active.length} · Blocked: ${blocked.length} · Overdue: ${overdue.length}`,
    "",
    "🚨 Urgent now",
    ...(urgent.length
      ? urgent.slice(0, 6).map((task) => taskLine(task, now))
      : ["Nothing urgent right now."]),
    "",
    "👥 Who needs to do what",
  ];

  if (assignments.size === 0) {
    lines.push("No active assignments.");
  } else {
    for (const [owner, ownerTasks] of [...assignments.entries()].slice(0, 8)) {
      lines.push(`${owner}:`);
      lines.push(
        ...ownerTasks
          .sort((left, right) => urgencyScore(right, now) - urgencyScore(left, now))
          .slice(0, 4)
          .map((task) => `• ${task.title}${dueSuffix(task)}`),
      );
      if (ownerTasks.length > 4) {
        lines.push(`• …and ${ownerTasks.length - 4} more`);
      }
    }
  }

  lines.push(
    "",
    "📅 Next 7 days",
    ...(dueThisWeek.length
      ? dueThisWeek.slice(0, 6).map((task) => taskLine(task, now))
      : ["No dated tasks due in the next seven days."]),
    "",
    "⛔ Blockers",
    ...(blocked.length
      ? blocked
          .slice(0, 5)
          .map((task) => `• ${task.title}${task.blocked_by ? ` — ${task.blocked_by}` : ""}`)
      : ["None recorded."]),
  );

  const dashboardUrl = telegramProjectDashboardUrl(project.id);
  if (dashboardUrl) lines.push("", `Open the project: ${dashboardUrl}`);
  lines.push("Use /undo immediately if the latest task update was wrong.");
  return lines.join("\n").slice(0, 4096);
}

function taskLine(task: TelegramTaskRow, now: Date) {
  const marker = isOverdue(task, now)
    ? "OVERDUE"
    : task.priority.toUpperCase();
  return `• [${marker}] ${task.title} — ${task.source_participant_name?.trim() || "Unassigned"}${dueSuffix(task)}`;
}

function dueSuffix(task: TelegramTaskRow) {
  return task.due_label || task.due_at
    ? ` · due ${task.due_label ?? formatSingapore(task.due_at!)}`
    : "";
}

function isOverdue(task: TelegramTaskRow, now: Date) {
  const dueAt = timestamp(task.due_at);
  return task.status === "overdue" || (dueAt !== null && dueAt < now.getTime());
}

function isDueWithin(task: TelegramTaskRow, now: Date, days: number) {
  const dueAt = timestamp(task.due_at);
  return (
    dueAt !== null && dueAt >= now.getTime() && dueAt <= now.getTime() + days * DAY_MS
  );
}

function urgencyScore(task: TelegramTaskRow, now: Date) {
  if (isOverdue(task, now)) return 100;
  if (isDueWithin(task, now, 1)) return 80;
  if (task.priority === "urgent") return 70;
  if (task.priority === "high") return 50;
  return 0;
}

function compareDueAt(left: TelegramTaskRow, right: TelegramTaskRow) {
  return (timestamp(left.due_at) ?? Number.MAX_SAFE_INTEGER) -
    (timestamp(right.due_at) ?? Number.MAX_SAFE_INTEGER);
}

function timestamp(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatSingapore(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

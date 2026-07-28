import { beforeEach, describe, expect, it } from "vitest";

import {
  kpiResponse,
  privateMyTasksResponse,
  projectResponse,
  summaryResponse,
  tasksResponse,
} from "@/lib/telegram-command-responses";
import type {
  TelegramProjectRow,
  TelegramTaskRow,
  TelegramUserTaskRow,
} from "@/lib/telegram-repository";

const project: TelegramProjectRow = {
  id: "project-1",
  name: "Website Launch",
  description: "Ship the TaskGoblin website.",
  health_score: 0,
  health_label: "Unknown",
  timezone: "Asia/Singapore",
};

const tasks: TelegramTaskRow[] = [
  task("task-1", "UI design", "done", "medium", "Bob"),
  task("task-2", "Frontend implementation", "doing", "high", "Bob"),
  task("task-3", "Testing checklist", "backlog", "urgent", "Charlie", {
    due_label: "Friday",
    due_at: "2026-07-31T09:00:00.000Z",
  }),
  task("task-4", "Resolve API access", "blocked", "high", "Alex", {
    blocked_by: "Waiting for credentials",
  }),
  task("task-5", "Publish notes", "overdue", "low", null),
];

describe("Telegram project command responses", () => {
  beforeEach(() => {
    process.env.TASKGOBLIN_APP_URL = "https://taskgoblin.vercel.app";
  });

  it("builds a factual rich summary with a task menu", () => {
    const response = summaryResponse(
      project,
      tasks,
      new Date("2026-07-28T00:00:00.000Z"),
    );

    expect(response.text).toContain("📌 Website Launch Summary");
    expect(response.text).toContain("20% completed (1/5 confirmed tasks)");
    expect(response.text).toContain("Frontend implementation");
    expect(response.text).toContain("Waiting for credentials");
    expect(response.text).toContain(
      "Manage the Kanban board, calendar, deadlines, and task details:",
    );
    expect(response.text).toContain(
      "https://taskgoblin.vercel.app/dashboard/projects/project-1",
    );
    expect(response.replyMarkup?.inline_keyboard).toHaveLength(5);
    expect(response.replyMarkup?.inline_keyboard.at(-1)?.[0]).toMatchObject({
      text: "🌐 Open Website Launch",
      url: "https://taskgoblin.vercel.app/dashboard/projects/project-1",
    });
  });

  it("derives project priorities and exact KPIs from stored tasks", () => {
    const overview = projectResponse(project, tasks);
    const kpis = kpiResponse(
      project,
      tasks,
      new Date("2026-07-28T00:00:00.000Z"),
    );

    expect(overview.text).toContain("Goal:\nShip the TaskGoblin website.");
    expect(overview.text).toContain("1. [urgent] Testing checklist");
    expect(kpis.text).toContain("Open tasks: 4");
    expect(kpis.text).toContain("Completed tasks: 1");
    expect(kpis.text).toContain("Completion rate: 20%");
    expect(kpis.text).toContain("Overdue tasks: 1");
    expect(kpis.text).toContain("Active blockers: 1");
    expect(kpis.text).toContain("Tasks without owners: 1");
    expect(overview.replyMarkup?.inline_keyboard.at(-1)?.[0].url).toContain(
      "/dashboard/projects/project-1",
    );
    expect(kpis.replyMarkup?.inline_keyboard.at(-1)?.[0].url).toContain(
      "/dashboard/projects/project-1",
    );
  });

  it("adds task selection buttons to the active task list", () => {
    const response = tasksResponse(project, tasks);

    expect(response.text).not.toContain("UI design");
    expect(response.text).toContain("Select a task below");
    expect(response.replyMarkup?.inline_keyboard[0][0].callback_data).toMatch(
      /^tg:t:v:task-/,
    );
    expect(response.replyMarkup?.inline_keyboard.at(-1)?.[0].url).toContain(
      "/dashboard/projects/project-1",
    );
  });

  it("groups private-chat assignments by project", () => {
    const userTasks: TelegramUserTaskRow[] = [
      { ...tasks[1], project_name: "Website Launch" },
      {
        ...task("task-6", "Prepare demo", "backlog", "medium", "Bob"),
        project_id: "project-2",
        project_name: "Demo Day",
      },
    ];
    const response = privateMyTasksResponse(userTasks);

    expect(response.text).toContain("2 tasks across 2 projects");
    expect(response.text).toMatch(/Website Launch[\s\S]*Demo Day/);
    expect(response.replyMarkup?.inline_keyboard).toHaveLength(4);
    expect(
      response.replyMarkup?.inline_keyboard
        .slice(-2)
        .map((row) => row[0].url),
    ).toEqual([
      "https://taskgoblin.vercel.app/dashboard/projects/project-1",
      "https://taskgoblin.vercel.app/dashboard/projects/project-2",
    ]);
  });
});

function task(
  id: string,
  title: string,
  status: string,
  priority: string,
  owner: string | null,
  overrides: Partial<TelegramTaskRow> = {},
): TelegramTaskRow {
  return {
    id,
    project_id: "project-1",
    title,
    description: null,
    status,
    priority,
    source_participant_name: owner,
    due_label: null,
    due_at: null,
    blocked_by: null,
    owner_telegram_user_id: owner ? `user-${owner.toLowerCase()}` : null,
    updated_at: "2026-07-28T00:00:00.000Z",
    ...overrides,
  };
}

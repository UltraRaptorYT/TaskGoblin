import { afterEach, describe, expect, it } from "vitest";

import {
  dailyProjectReport,
  singaporeReportDate,
} from "@/lib/telegram-project-report";
import type { TelegramTaskRow } from "@/lib/telegram-repository";

describe("daily Telegram project reports", () => {
  afterEach(() => {
    delete process.env.TASKGOBLIN_APP_URL;
  });

  it("summarises progress, urgency, owners, blockers and the next seven days", () => {
    process.env.TASKGOBLIN_APP_URL = "https://taskgoblin.test";
    const now = new Date("2026-08-01T12:00:00.000Z");
    const report = dailyProjectReport(
      { id: "project-1", name: "Launchpad" },
      [
        task({
          id: "done",
          title: "Create storyboard",
          status: "done",
          source_participant_name: "Alex",
        }),
        task({
          id: "urgent",
          title: "Fix deployment",
          priority: "urgent",
          due_at: "2026-08-01T11:00:00.000Z",
          source_participant_name: "Zi Bing",
        }),
        task({
          id: "blocked",
          title: "Run user study",
          status: "blocked",
          blocked_by: "Waiting for participants",
          due_at: "2026-08-04T12:00:00.000Z",
          source_participant_name: "Hong Yu",
        }),
      ],
      now,
    );

    expect(report).toContain("Progress: 33% (1/3 tasks complete)");
    expect(report).toContain("[OVERDUE] Fix deployment — Zi Bing");
    expect(report).toContain("Hong Yu:\n• Run user study");
    expect(report).toContain("Waiting for participants");
    expect(report).toContain(
      "https://taskgoblin.test/dashboard/projects/project-1",
    );
  });

  it("uses the Singapore calendar date for report deduplication", () => {
    expect(singaporeReportDate(new Date("2026-07-31T16:30:00.000Z"))).toBe(
      "2026-08-01",
    );
  });
});

function task(overrides: Partial<TelegramTaskRow>): TelegramTaskRow {
  return {
    id: "task",
    project_id: "project-1",
    title: "Task",
    description: null,
    status: "backlog",
    priority: "medium",
    source_participant_name: null,
    due_label: null,
    due_at: null,
    blocked_by: null,
    owner_telegram_user_id: null,
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

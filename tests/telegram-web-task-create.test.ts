import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const permissions = vi.hoisted(() => ({
  getTelegramProjectAdminAccess: vi.fn(),
}));

vi.mock("@/lib/telegram-web-permissions", () => ({
  getTelegramProjectAdminAccess:
    permissions.getTelegramProjectAdminAccess,
}));

import { POST } from "@/app/api/dashboard/projects/[projectId]/tasks/route";

describe("Telegram web task creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creation by a non-admin project member", async () => {
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Only Telegram group owners and administrators can edit tasks.",
    });

    const response = await POST(
      taskRequest({ title: "Prepare launch checklist" }),
      routeContext(),
    );

    expect(response.status).toBe(403);
  });

  it("creates a project-scoped task and records an audit event", async () => {
    const task = {
      id: "task-1",
      title: "Prepare launch checklist",
      description: "Cover the production rollout.",
      status: "backlog",
      priority: "high",
      due_at: "2026-07-31T09:00:00.000Z",
      due_label: null,
      owner_telegram_user_id: null,
      source_participant_name: null,
    };
    const taskSingle = vi.fn().mockResolvedValue({
      data: task,
      error: null,
    });
    const taskSelect = vi.fn(() => ({ single: taskSingle }));
    const taskInsert = vi.fn(() => ({ select: taskSelect }));
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "taskgoblin_tasks") return { insert: taskInsert };
        if (table === "taskgoblin_project_events") {
          return { insert: eventInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: true,
      admin,
      identity: {
        telegramUserRecordId: "79c37da8-8d8d-4822-b73e-77f32bd082d2",
      },
    });

    const response = await POST(
      taskRequest({
        title: "Prepare launch checklist",
        description: "Cover the production rollout.",
        priority: "high",
        dueAt: "2026-07-31T09:00:00.000Z",
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.task).toMatchObject({
      title: "Prepare launch checklist",
      status: "backlog",
      priority: "high",
    });
    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        title: "Prepare launch checklist",
        confidence: 1,
        source_message_ids: [],
      }),
    );
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        event_type: "web_task_created",
        metadata: expect.objectContaining({
          source: "web_dashboard",
        }),
      }),
    );
  });
});

function taskRequest(body: unknown) {
  return new Request(
    "https://taskgoblin.test/api/dashboard/projects/project-1/tasks",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://taskgoblin.test",
      },
      body: JSON.stringify(body),
    },
  );
}

function routeContext() {
  return {
    params: Promise.resolve({ projectId: "project-1" }),
  } as RouteContext<"/api/dashboard/projects/[projectId]/tasks">;
}

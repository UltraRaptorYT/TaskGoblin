import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const permissions = vi.hoisted(() => ({
  getTelegramProjectAdminAccess: vi.fn(),
}));

vi.mock("@/lib/telegram-web-permissions", () => ({
  getTelegramProjectAdminAccess:
    permissions.getTelegramProjectAdminAccess,
}));

import { PATCH } from "@/app/api/dashboard/projects/[projectId]/tasks/[taskId]/route";

describe("Telegram web task updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects writes from non-admin project members", async () => {
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Only Telegram group owners and administrators can edit tasks.",
    });

    const response = await PATCH(
      taskRequest({ status: "doing" }),
      routeContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only Telegram group owners and administrators can edit tasks.",
    });
  });

  it("updates a project-scoped task and records an audit event", async () => {
    const task = {
      id: "task-1",
      title: "Build the dashboard",
      description: null,
      status: "doing",
      priority: "high",
      due_at: "2026-07-31T09:00:00.000Z",
      due_label: null,
      owner_telegram_user_id: null,
      source_participant_name: null,
    };
    const taskMaybeSingle = vi.fn().mockResolvedValue({
      data: task,
      error: null,
    });
    const taskSelect = vi.fn(() => ({ maybeSingle: taskMaybeSingle }));
    const taskProjectEq = vi.fn(() => ({ select: taskSelect }));
    const taskIdEq = vi.fn(() => ({ eq: taskProjectEq }));
    const taskUpdate = vi.fn(() => ({ eq: taskIdEq }));
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "taskgoblin_tasks") return { update: taskUpdate };
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

    const response = await PATCH(
      taskRequest({
        status: "doing",
        priority: "high",
        dueAt: "2026-07-31T09:00:00.000Z",
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task).toMatchObject({
      id: "task-1",
      status: "doing",
      priority: "high",
    });
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "doing",
        priority: "high",
        due_at: "2026-07-31T09:00:00.000Z",
        due_label: null,
      }),
    );
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        event_type: "web_task_updated",
        metadata: expect.objectContaining({
          taskId: "task-1",
          source: "web_dashboard",
        }),
      }),
    );
  });
});

function taskRequest(body: unknown) {
  return new Request(
    "https://taskgoblin.test/api/dashboard/projects/project-1/tasks/task-1",
    {
      method: "PATCH",
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
    params: Promise.resolve({ projectId: "project-1", taskId: "task-1" }),
  } as RouteContext<
    "/api/dashboard/projects/[projectId]/tasks/[taskId]"
  >;
}

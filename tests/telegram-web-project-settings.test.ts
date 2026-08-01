import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const permissions = vi.hoisted(() => ({
  getTelegramProjectAdminAccess: vi.fn(),
}));

vi.mock("@/lib/telegram-web-permissions", () => ({
  getTelegramProjectAdminAccess:
    permissions.getTelegramProjectAdminAccess,
}));

import { PATCH } from "@/app/api/dashboard/projects/[projectId]/settings/route";

describe("Telegram web project report settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects project members who are not Telegram group administrators", async () => {
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Only Telegram group owners and administrators can edit tasks.",
    });

    const response = await PATCH(settingsRequest(validSettings()), routeContext());

    expect(response.status).toBe(403);
  });

  it("updates a project schedule and records an audit event", async () => {
    const saved = {
      report_enabled: true,
      report_frequency: "weekly",
      report_local_time: "18:30:00",
      report_weekday: 5,
      timezone: "Asia/Singapore",
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: saved, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "taskgoblin_projects") return { update };
        if (table === "taskgoblin_project_events") {
          return { insert: eventInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: true,
      admin,
      identity: { telegramUserRecordId: "telegram-user-record-1" },
    });

    const response = await PATCH(settingsRequest(validSettings()), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        reportEnabled: true,
        reportFrequency: "weekly",
        reportLocalTime: "18:30",
        reportWeekday: 5,
        timezone: "Asia/Singapore",
      },
      auditPersisted: true,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        report_enabled: true,
        report_frequency: "weekly",
        report_local_time: "18:30:00",
        report_weekday: 5,
        timezone: "Asia/Singapore",
      }),
    );
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        event_type: "web_report_settings_updated",
      }),
    );
  });

  it("rejects invalid timezones before writing", async () => {
    const admin = { from: vi.fn() };
    permissions.getTelegramProjectAdminAccess.mockResolvedValue({
      ok: true,
      admin,
      identity: { telegramUserRecordId: "telegram-user-record-1" },
    });

    const response = await PATCH(
      settingsRequest({ ...validSettings(), timezone: "Singapore-ish" }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
  });
});

function validSettings() {
  return {
    reportEnabled: true,
    reportFrequency: "weekly",
    reportLocalTime: "18:30",
    reportWeekday: 5,
    timezone: "Asia/Singapore",
  };
}

function settingsRequest(body: unknown) {
  return new Request(
    "https://taskgoblin.test/api/dashboard/projects/project-1/settings",
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
    params: Promise.resolve({ projectId: "project-1" }),
  } as RouteContext<"/api/dashboard/projects/[projectId]/settings">;
}

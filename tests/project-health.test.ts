import { describe, expect, it } from "vitest";

import { calculateProjectHealth } from "@/lib/project-health";

const now = new Date("2026-07-28T12:00:00.000Z");

describe("project health", () => {
  it("uses a useful getting-started state when there are no tasks", () => {
    expect(calculateProjectHealth([], now)).toMatchObject({
      score: 0,
      label: "Getting started",
    });
  });

  it("marks assigned active work with no risks as on track", () => {
    expect(
      calculateProjectHealth(
        [
          {
            status: "doing",
            dueAt: "2026-07-31T12:00:00.000Z",
            ownerTelegramUserId: "member-1",
          },
        ],
        now,
      ),
    ).toMatchObject({
      score: 100,
      label: "On track",
    });
  });

  it("calls out unassigned work", () => {
    const health = calculateProjectHealth(
      [{ status: "backlog", ownerTelegramUserId: null }],
      now,
    );

    expect(health.label).toBe("Needs attention");
    expect(health.reason).toContain("1 unassigned task");
  });

  it("marks overdue work as at risk", () => {
    const health = calculateProjectHealth(
      [
        {
          status: "doing",
          dueAt: "2026-07-27T12:00:00.000Z",
          ownerTelegramUserId: "member-1",
        },
      ],
      now,
    );

    expect(health.label).toBe("At risk");
    expect(health.reason).toContain("1 overdue task");
  });

  it("marks a project complete when every task is done", () => {
    expect(
      calculateProjectHealth(
        [
          { status: "done", ownerTelegramUserId: "member-1" },
          { status: "done", ownerTelegramUserId: "member-2" },
        ],
        now,
      ),
    ).toMatchObject({
      score: 100,
      label: "Complete",
    });
  });
});

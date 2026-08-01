import { describe, expect, it } from "vitest";

import {
  deadlineFromPreset,
  snoozeFromPreset,
} from "@/lib/telegram-interaction-time";

describe("Telegram interaction time presets", () => {
  const now = new Date("2026-08-01T12:30:00.000Z"); // 8:30 PM SGT

  it("sets deterministic Singapore deadlines", () => {
    expect(deadlineFromPreset("today", now)).toEqual({
      dueLabel: "Today, 11:59 PM",
      dueAt: "2026-08-01T15:59:00.000Z",
    });
    expect(deadlineFromPreset("tomorrow", now).dueAt).toBe(
      "2026-08-02T10:00:00.000Z",
    );
    expect(deadlineFromPreset("clear", now)).toEqual({
      dueLabel: null,
      dueAt: null,
    });
  });

  it("snoozes for one hour or until the next Singapore morning", () => {
    expect(snoozeFromPreset("one_hour", now)).toBe(
      "2026-08-01T13:30:00.000Z",
    );
    expect(snoozeFromPreset("tomorrow_morning", now)).toBe(
      "2026-08-02T01:00:00.000Z",
    );
  });
});

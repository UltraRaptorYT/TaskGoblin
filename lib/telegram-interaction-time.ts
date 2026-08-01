import type {
  DeadlinePreset,
  SnoozePreset,
} from "@/lib/telegram-callbacks";

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function deadlineFromPreset(preset: DeadlinePreset, now = new Date()) {
  if (preset === "clear") return { dueLabel: null, dueAt: null };
  const localNow = new Date(now.getTime() + SINGAPORE_OFFSET_MS);
  const days = preset === "today" ? 0 : preset === "tomorrow" ? 1 : 7;
  const hour = preset === "today" ? 23 : 18;
  const localDeadline = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + days,
    hour,
    preset === "today" ? 59 : 0,
  );
  const dueAt = new Date(localDeadline - SINGAPORE_OFFSET_MS);
  const dueLabel =
    preset === "today"
      ? "Today, 11:59 PM"
      : preset === "tomorrow"
        ? "Tomorrow, 6:00 PM"
        : "Next week, 6:00 PM";
  return { dueLabel, dueAt: dueAt.toISOString() };
}

export function snoozeFromPreset(preset: SnoozePreset, now = new Date()) {
  if (preset === "one_hour") {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  const localNow = new Date(now.getTime() + SINGAPORE_OFFSET_MS);
  const nextMorningLocal = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + 1,
    9,
  );
  return new Date(nextMorningLocal - SINGAPORE_OFFSET_MS).toISOString();
}

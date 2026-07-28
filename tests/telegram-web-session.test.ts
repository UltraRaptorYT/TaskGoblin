import { describe, expect, it } from "vitest";

import {
  createTelegramWebSession,
  TELEGRAM_SESSION_MAX_AGE_SECONDS,
  verifyTelegramWebSession,
  type TelegramWebIdentity,
} from "@/lib/telegram-web-session";

const secret = "taskgoblin-test-session-secret-more-than-32-bytes";
const identity: TelegramWebIdentity = {
  telegramUserRecordId: "4fc02ca2-555b-48a6-98fb-073478ce6b43",
  telegramUserId: "987654321",
  username: "task_goblin_tester",
  displayName: "Task Goblin",
  photoUrl: "https://example.test/avatar.jpg",
};

describe("Telegram web session", () => {
  it("round-trips a verified Telegram identity", async () => {
    const now = new Date("2026-07-28T02:00:00.000Z");
    const token = await createTelegramWebSession(identity, secret, now);

    await expect(
      verifyTelegramWebSession(token, secret, new Date(now.getTime() + 60_000)),
    ).resolves.toEqual(identity);
  });

  it("rejects tampered and incorrectly signed sessions", async () => {
    const token = await createTelegramWebSession(identity, secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifyTelegramWebSession(tampered, secret)).resolves.toBeNull();
    await expect(
      verifyTelegramWebSession(
        token,
        "a-different-session-secret-that-is-also-long-enough",
      ),
    ).resolves.toBeNull();
  });

  it("expires sessions after the configured lifetime", async () => {
    const now = new Date("2026-07-28T02:00:00.000Z");
    const token = await createTelegramWebSession(identity, secret, now);
    const afterExpiry = new Date(
      now.getTime() + (TELEGRAM_SESSION_MAX_AGE_SECONDS + 1) * 1_000,
    );

    await expect(
      verifyTelegramWebSession(token, secret, afterExpiry),
    ).resolves.toBeNull();
  });

  it("requires a strong server-side signing secret", async () => {
    await expect(
      createTelegramWebSession(identity, "too-short"),
    ).rejects.toThrow(/at least 32 bytes/i);
  });
});

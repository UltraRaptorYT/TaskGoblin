import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getTelegramAdministratorIds,
  telegramProjectRole,
} from "@/lib/telegram-membership";

describe("Telegram project role mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("maps Telegram owners and administrators to the web admin role", () => {
    const administrators = new Set([11, 22]);
    expect(telegramProjectRole(administrators, 11)).toBe("admin");
    expect(telegramProjectRole(administrators, 22)).toBe("admin");
    expect(telegramProjectRole(administrators, 33)).toBe("member");
  });

  it("loads only creator and administrator user ids from Telegram", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: [
            { status: "creator", user: { id: 11 } },
            { status: "administrator", user: { id: 22 } },
            { status: "member", user: { id: 33 } },
          ],
        }),
      }),
    );

    const result = await getTelegramAdministratorIds(-100123);

    expect(result).toEqual(new Set([11, 22]));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/getChatAdministrators"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: -100123,
          return_bots: false,
        }),
      }),
    );
  });

  it("preserves the stored role when Telegram is unavailable", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(getTelegramAdministratorIds(-100123)).resolves.toBeNull();
  });
});

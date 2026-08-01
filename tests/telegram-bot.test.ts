import { afterEach, describe, expect, it, vi } from "vitest";

import { setTelegramMessageReaction } from "@/lib/telegram-bot";

describe("Telegram bot reactions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("uses setMessageReaction with one standard emoji reaction", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, result: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await setTelegramMessageReaction(-100, 77, "🎉");

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/setMessageReaction",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: -100,
        message_id: 77,
        reaction: [{ type: "emoji", emoji: "🎉" }],
        is_big: true,
      }),
      }),
    );
  });
});

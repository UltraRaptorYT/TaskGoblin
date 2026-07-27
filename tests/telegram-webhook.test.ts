import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTelegramWebhookSecret } from "@/lib/telegram-update";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));
vi.mock("@/lib/telegram-handler", () => ({
  processTelegramUpdate: vi.fn(),
}));

import { POST } from "@/app/api/telegram/webhook/route";

describe("validateTelegramWebhookSecret", () => {
  it("accepts only an exact configured secret", () => {
    expect(validateTelegramWebhookSecret("secret", "secret")).toBe(true);
    expect(validateTelegramWebhookSecret("secret", "wrong")).toBe(false);
    expect(validateTelegramWebhookSecret("secret", null)).toBe(false);
  });

  it("fails closed when the expected secret is missing", () => {
    expect(validateTelegramWebhookSecret(undefined, "anything")).toBe(false);
  });
});

describe("Telegram webhook route validation", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("returns 503 when the server secret is not configured", async () => {
    const response = await POST(
      new Request("https://taskgoblin.test/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ update_id: 1 }),
      }),
    );
    expect(response.status).toBe(503);
  });

  it("rejects a mismatched Telegram secret before parsing the payload", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected";
    const response = await POST(
      new Request("https://taskgoblin.test/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": "wrong",
        },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects malformed updates after authenticating the request", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected";
    const response = await POST(
      new Request("https://taskgoblin.test/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": "expected",
        },
        body: JSON.stringify({ message: {} }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

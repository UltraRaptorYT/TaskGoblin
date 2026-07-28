import { describe, expect, it } from "vitest";

import {
  buildTelegramAuthorizationUrl,
  createTelegramPkce,
  telegramIdentityFromClaims,
} from "@/lib/telegram-oidc";

describe("Telegram OIDC", () => {
  it("builds an authorization request with state, nonce, and PKCE", async () => {
    const pkce = await createTelegramPkce();
    const url = buildTelegramAuthorizationUrl({
      clientId: "123456",
      redirectUri: "https://taskgoblin.test/api/auth/telegram/callback",
      state: "state-value",
      nonce: "nonce-value",
      codeChallenge: pkce.challenge,
    });

    expect(url.origin + url.pathname).toBe("https://oauth.telegram.org/auth");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("nonce")).toBe("nonce-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([
      "openid",
      "profile",
      "telegram:bot_access",
    ]);
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.verifier).not.toBe(pkce.challenge);
  });

  it("normalises only verified Telegram identity claims", () => {
    expect(
      telegramIdentityFromClaims(
        {
          sub: "987654321",
          nonce: "expected",
          name: "Zi Bing",
          given_name: "Zi",
          family_name: "Bing",
          preferred_username: "Zibing_a",
          picture: "https://example.test/zi.jpg",
          locale: "en-SG",
        },
        "expected",
      ),
    ).toEqual({
      telegramUserId: "987654321",
      username: "Zibing_a",
      firstName: "Zi",
      lastName: "Bing",
      displayName: "Zi Bing",
      photoUrl: "https://example.test/zi.jpg",
      languageCode: "en-SG",
    });
  });

  it("rejects a mismatched nonce or a non-numeric Telegram id", () => {
    expect(() =>
      telegramIdentityFromClaims(
        { sub: "987654321", nonce: "unexpected" },
        "expected",
      ),
    ).toThrow(/nonce/i);
    expect(() =>
      telegramIdentityFromClaims(
        { sub: "not-a-telegram-id", nonce: "expected" },
        "expected",
      ),
    ).toThrow(/user id/i);
  });
});

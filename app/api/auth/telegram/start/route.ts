import { NextResponse } from "next/server";

import {
  getTelegramWebConfig,
  secureCookie,
  TELEGRAM_OAUTH_NONCE_COOKIE,
  TELEGRAM_OAUTH_STATE_COOKIE,
  TELEGRAM_OAUTH_VERIFIER_COOKIE,
  telegramCallbackUrl,
} from "@/lib/telegram-web-auth";
import {
  buildTelegramAuthorizationUrl,
  createTelegramOAuthNonce,
  createTelegramPkce,
} from "@/lib/telegram-oidc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getTelegramWebConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  const state = createTelegramOAuthNonce();
  const nonce = createTelegramOAuthNonce();
  const pkce = await createTelegramPkce();
  const authorizationUrl = buildTelegramAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: telegramCallbackUrl(request.url),
    state,
    nonce,
    codeChallenge: pkce.challenge,
  });
  const response = NextResponse.redirect(authorizationUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: secureCookie(request.url),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  response.cookies.set(TELEGRAM_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(TELEGRAM_OAUTH_NONCE_COOKIE, nonce, cookieOptions);
  response.cookies.set(TELEGRAM_OAUTH_VERIFIER_COOKIE, pkce.verifier, cookieOptions);
  return response;
}

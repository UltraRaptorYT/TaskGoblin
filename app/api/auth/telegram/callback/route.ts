import { NextRequest, NextResponse } from "next/server";

import {
  getTaskGoblinOrigin,
  getTelegramWebConfig,
  secureCookie,
  TELEGRAM_OAUTH_NONCE_COOKIE,
  TELEGRAM_OAUTH_STATE_COOKIE,
  TELEGRAM_OAUTH_VERIFIER_COOKIE,
  telegramCallbackUrl,
} from "@/lib/telegram-web-auth";
import {
  exchangeTelegramAuthorizationCode,
  verifyTelegramIdToken,
} from "@/lib/telegram-oidc";
import {
  createTelegramWebSession,
  TELEGRAM_SESSION_COOKIE,
  TELEGRAM_SESSION_MAX_AGE_SECONDS,
} from "@/lib/telegram-web-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function loginError(request: Request, error: string) {
  return NextResponse.redirect(
    `${getTaskGoblinOrigin(request.url)}/login?error=${encodeURIComponent(error)}`,
  );
}

function clearTransientCookies(response: NextResponse, requestUrl: string) {
  const options = {
    httpOnly: true,
    secure: secureCookie(requestUrl),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set(TELEGRAM_OAUTH_STATE_COOKIE, "", options);
  response.cookies.set(TELEGRAM_OAUTH_NONCE_COOKIE, "", options);
  response.cookies.set(TELEGRAM_OAUTH_VERIFIER_COOKIE, "", options);
}

export async function GET(request: NextRequest) {
  const config = getTelegramWebConfig();
  const admin = getSupabaseAdmin();
  if (!config || !admin) return loginError(request, "not_configured");

  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const expectedState = request.cookies.get(TELEGRAM_OAUTH_STATE_COOKIE)?.value;
  const nonce = request.cookies.get(TELEGRAM_OAUTH_NONCE_COOKIE)?.value;
  const verifier = request.cookies.get(TELEGRAM_OAUTH_VERIFIER_COOKIE)?.value;

  if (providerError) return loginError(request, "cancelled");
  if (
    !code ||
    !returnedState ||
    !expectedState ||
    returnedState !== expectedState ||
    !nonce ||
    !verifier
  ) {
    return loginError(request, "invalid_state");
  }

  try {
    const idToken = await exchangeTelegramAuthorizationCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: telegramCallbackUrl(request.url),
      codeVerifier: verifier,
    });
    const telegramIdentity = await verifyTelegramIdToken({
      idToken,
      clientId: config.clientId,
      nonce,
    });
    const now = new Date().toISOString();
    const { data: telegramUser, error: telegramUserError } = await admin
      .from("taskgoblin_telegram_users")
      .upsert(
        {
          telegram_user_id: telegramIdentity.telegramUserId,
          username: telegramIdentity.username,
          first_name: telegramIdentity.firstName,
          last_name: telegramIdentity.lastName,
          language_code: telegramIdentity.languageCode,
          is_bot: false,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "telegram_user_id" },
      )
      .select("id")
      .single();

    if (telegramUserError || !telegramUser) {
      throw telegramUserError ?? new Error("Could not link Telegram user.");
    }

    const session = await createTelegramWebSession(
      {
        telegramUserRecordId: telegramUser.id,
        telegramUserId: telegramIdentity.telegramUserId,
        username: telegramIdentity.username,
        displayName: telegramIdentity.displayName,
        photoUrl: telegramIdentity.photoUrl,
      },
      config.sessionSecret,
    );
    const response = NextResponse.redirect(
      `${getTaskGoblinOrigin(request.url)}/dashboard`,
    );
    response.cookies.set(TELEGRAM_SESSION_COOKIE, session, {
      httpOnly: true,
      secure: secureCookie(request.url),
      sameSite: "lax",
      path: "/",
      maxAge: TELEGRAM_SESSION_MAX_AGE_SECONDS,
    });
    clearTransientCookies(response, request.url);
    return response;
  } catch (error) {
    console.error("Telegram web login failed", error);
    const response = loginError(request, "login_failed");
    clearTransientCookies(response, request.url);
    return response;
  }
}

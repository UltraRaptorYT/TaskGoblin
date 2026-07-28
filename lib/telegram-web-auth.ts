import "server-only";

import { cookies } from "next/headers";

import {
  TELEGRAM_SESSION_COOKIE,
  verifyTelegramWebSession,
} from "@/lib/telegram-web-session";

export const TELEGRAM_OAUTH_STATE_COOKIE = "taskgoblin_tg_oauth_state";
export const TELEGRAM_OAUTH_NONCE_COOKIE = "taskgoblin_tg_oauth_nonce";
export const TELEGRAM_OAUTH_VERIFIER_COOKIE = "taskgoblin_tg_oauth_verifier";

export function getTelegramWebConfig() {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.TELEGRAM_WEB_SESSION_SECRET?.trim();

  if (
    !clientId ||
    !clientSecret ||
    !sessionSecret ||
    new TextEncoder().encode(sessionSecret).byteLength < 32
  ) {
    return null;
  }

  return { clientId, clientSecret, sessionSecret };
}

export function getTaskGoblinOrigin(requestUrl: string) {
  const configured = process.env.TASKGOBLIN_APP_URL?.trim().replace(/\/$/, "");
  return configured || new URL(requestUrl).origin;
}

export function telegramCallbackUrl(requestUrl: string) {
  return `${getTaskGoblinOrigin(requestUrl)}/api/auth/telegram/callback`;
}

export function secureCookie(requestUrl: string) {
  return (
    process.env.NODE_ENV === "production" ||
    getTaskGoblinOrigin(requestUrl).startsWith("https://")
  );
}

export async function getTelegramWebIdentity() {
  const sessionSecret = process.env.TELEGRAM_WEB_SESSION_SECRET?.trim();
  if (!sessionSecret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(TELEGRAM_SESSION_COOKIE)?.value;
  if (!token) return null;

  return verifyTelegramWebSession(token, sessionSecret);
}

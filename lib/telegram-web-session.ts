import { jwtVerify, SignJWT } from "jose";

export const TELEGRAM_SESSION_COOKIE = "taskgoblin_telegram_session";
export const TELEGRAM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const SESSION_ISSUER = "taskgoblin";
const SESSION_AUDIENCE = "taskgoblin-web";

export type TelegramWebIdentity = {
  telegramUserRecordId: string;
  telegramUserId: string;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
};

function sessionKey(secret: string) {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("TELEGRAM_WEB_SESSION_SECRET must be at least 32 bytes.");
  }

  return new TextEncoder().encode(secret);
}

export async function createTelegramWebSession(
  identity: TelegramWebIdentity,
  secret: string,
  now = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({
    telegram_user_id: identity.telegramUserId,
    username: identity.username,
    display_name: identity.displayName,
    photo_url: identity.photoUrl,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(identity.telegramUserRecordId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TELEGRAM_SESSION_MAX_AGE_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(sessionKey(secret));
}

export async function verifyTelegramWebSession(
  token: string,
  secret: string,
  currentDate = new Date(),
): Promise<TelegramWebIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(secret), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      currentDate,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.telegram_user_id !== "string" ||
      typeof payload.display_name !== "string"
    ) {
      return null;
    }

    return {
      telegramUserRecordId: payload.sub,
      telegramUserId: payload.telegram_user_id,
      username:
        typeof payload.username === "string" ? payload.username : null,
      displayName: payload.display_name,
      photoUrl: typeof payload.photo_url === "string" ? payload.photo_url : null,
    };
  } catch {
    return null;
  }
}

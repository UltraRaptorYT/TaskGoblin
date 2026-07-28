import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const TELEGRAM_OIDC_ISSUER = "https://oauth.telegram.org";
export const TELEGRAM_OIDC_AUTHORIZATION_ENDPOINT =
  "https://oauth.telegram.org/auth";
export const TELEGRAM_OIDC_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
export const TELEGRAM_OIDC_JWKS_ENDPOINT =
  "https://oauth.telegram.org/.well-known/jwks.json";

export type TelegramOidcIdentity = {
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  displayName: string;
  photoUrl: string | null;
  languageCode: string | null;
};

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export async function createTelegramPkce() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );

  return {
    verifier,
    challenge: base64Url(new Uint8Array(digest)),
  };
}

export function createTelegramOAuthNonce() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function buildTelegramAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const url = new URL(TELEGRAM_OIDC_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile telegram:bot_access");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeTelegramAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  const response = await fetch(TELEGRAM_OIDC_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | { id_token?: unknown; error?: unknown; error_description?: unknown }
    | null;

  if (!response.ok || typeof body?.id_token !== "string") {
    const reason =
      typeof body?.error_description === "string"
        ? body.error_description
        : typeof body?.error === "string"
          ? body.error
          : "Telegram did not return an ID token.";
    throw new Error(reason);
  }

  return body.id_token;
}

export function telegramIdentityFromClaims(
  payload: JWTPayload,
  expectedNonce: string,
): TelegramOidcIdentity {
  if (payload.nonce !== expectedNonce) {
    throw new Error("Telegram login nonce did not match.");
  }

  const rawId = payload.id ?? payload.sub;
  const telegramUserId =
    typeof rawId === "number" && Number.isSafeInteger(rawId)
      ? String(rawId)
      : typeof rawId === "string" && /^\d+$/.test(rawId)
        ? rawId
        : null;

  if (!telegramUserId) {
    throw new Error("Telegram login did not contain a valid user id.");
  }

  const username =
    typeof payload.preferred_username === "string"
      ? payload.preferred_username
      : typeof payload.username === "string"
        ? payload.username
        : null;
  const firstName =
    typeof payload.given_name === "string" && payload.given_name.trim()
      ? payload.given_name.trim()
      : typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : username
          ? `@${username}`
          : "Telegram user";
  const lastName =
    typeof payload.family_name === "string" && payload.family_name.trim()
      ? payload.family_name.trim()
      : null;
  const displayName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : [firstName, lastName].filter(Boolean).join(" ");

  return {
    telegramUserId,
    username,
    firstName,
    lastName,
    displayName,
    photoUrl: typeof payload.picture === "string" ? payload.picture : null,
    languageCode:
      typeof payload.locale === "string" ? payload.locale.slice(0, 16) : null,
  };
}

export async function verifyTelegramIdToken(input: {
  idToken: string;
  clientId: string;
  nonce: string;
}) {
  const jwks = createRemoteJWKSet(new URL(TELEGRAM_OIDC_JWKS_ENDPOINT));
  const { payload } = await jwtVerify(input.idToken, jwks, {
    algorithms: ["RS256"],
    issuer: TELEGRAM_OIDC_ISSUER,
    audience: input.clientId,
  });

  return telegramIdentityFromClaims(payload, input.nonce);
}

import { NextResponse } from "next/server";

import {
  getTaskGoblinOrigin,
  secureCookie,
} from "@/lib/telegram-web-auth";
import { TELEGRAM_SESSION_COOKIE } from "@/lib/telegram-web-session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    `${getTaskGoblinOrigin(request.url)}/login`,
    { status: 303 },
  );
  response.cookies.set(TELEGRAM_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: secureCookie(request.url),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

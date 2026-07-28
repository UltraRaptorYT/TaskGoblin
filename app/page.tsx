import { redirect } from "next/navigation";

import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getTelegramWebIdentity();
  redirect(identity ? "/dashboard" : "/login");
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncTelegramProjectMemberRole } from "@/lib/telegram-membership";
import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";
import type { TelegramWebIdentity } from "@/lib/telegram-web-session";

type ProjectAdminAccess =
  | {
      ok: true;
      admin: SupabaseClient;
      identity: TelegramWebIdentity;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      error: string;
    };

export async function getTelegramProjectAdminAccess(
  projectId: string,
): Promise<ProjectAdminAccess> {
  const identity = await getTelegramWebIdentity();
  if (!identity) {
    return { ok: false, status: 401, error: "Sign in with Telegram first." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Supabase server credentials are not configured.",
    };
  }

  await syncTelegramProjectMemberRole(
    admin,
    projectId,
    identity.telegramUserRecordId,
    identity.telegramUserId,
  );

  const { data: membership, error } = await admin
    .from("taskgoblin_project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("telegram_user_id", identity.telegramUserRecordId)
    .maybeSingle();

  if (error || !membership) {
    return {
      ok: false,
      status: 403,
      error: "You are not a member of this Telegram project.",
    };
  }
  if (membership.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Only Telegram group owners and administrators can edit tasks.",
    };
  }

  return { ok: true, admin, identity };
}

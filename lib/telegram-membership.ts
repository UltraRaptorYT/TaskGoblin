import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TelegramProjectRole = "admin" | "member";

type TelegramAdministratorsResponse = {
  ok?: boolean;
  result?: Array<{
    status?: string;
    user?: { id?: number };
  }>;
};

export function telegramProjectRole(
  administratorIds: ReadonlySet<number>,
  telegramUserId: number,
): TelegramProjectRole {
  return administratorIds.has(telegramUserId) ? "admin" : "member";
}

export async function getTelegramAdministratorIds(
  telegramChatId: number,
): Promise<Set<number> | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getChatAdministrators`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          return_bots: false,
        }),
        signal: AbortSignal.timeout(4_000),
        cache: "no-store",
      },
    );
    const payload =
      (await response.json().catch(() => ({}))) as TelegramAdministratorsResponse;
    if (!response.ok || !payload.ok || !Array.isArray(payload.result)) {
      return null;
    }

    return new Set(
      payload.result.flatMap((member) =>
        (member.status === "creator" || member.status === "administrator") &&
        typeof member.user?.id === "number"
          ? [member.user.id]
          : [],
      ),
    );
  } catch {
    return null;
  }
}

export async function syncTelegramProjectMemberRole(
  admin: SupabaseClient,
  projectId: string,
  telegramUserRecordId: string,
  telegramUserId: string | number,
): Promise<TelegramProjectRole | null> {
  const { data: chat, error: chatError } = await admin
    .from("taskgoblin_telegram_chats")
    .select("telegram_chat_id, chat_type")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();

  if (
    chatError ||
    !chat ||
    !["group", "supergroup", "channel"].includes(chat.chat_type)
  ) {
    return null;
  }

  const administratorIds = await getTelegramAdministratorIds(
    Number(chat.telegram_chat_id),
  );
  if (!administratorIds) return null;

  const numericTelegramUserId = Number(telegramUserId);
  if (!Number.isSafeInteger(numericTelegramUserId)) return null;

  const role = telegramProjectRole(administratorIds, numericTelegramUserId);
  const { error: updateError } = await admin
    .from("taskgoblin_project_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("telegram_user_id", telegramUserRecordId);

  return updateError ? null : role;
}

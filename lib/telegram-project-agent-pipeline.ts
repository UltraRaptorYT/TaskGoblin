import type { SupabaseClient } from "@supabase/supabase-js";

import {
  runTelegramProjectAgent,
  type TelegramProjectAgentResult,
} from "@/lib/telegram-project-agent";
import {
  getTelegramProject,
  loadProjectDetectionContext,
  type TelegramContext,
} from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

export async function answerTelegramProjectRequest(
  supabase: SupabaseClient,
  telegramContext: TelegramContext,
  message: TelegramInboundMessage,
): Promise<TelegramProjectAgentResult | null> {
  if (!telegramContext.projectId || !telegramContext.chatRecordId) return null;

  const [project, projectContext] = await Promise.all([
    getTelegramProject(supabase, telegramContext.projectId),
    loadProjectDetectionContext(supabase, telegramContext.projectId, {
      telegramChatRecordId: telegramContext.chatRecordId,
      beforeTelegramMessageId: message.messageId,
      messageThreadId: message.messageThreadId,
      sentAt: message.sentAt,
    }),
  ]);

  return runTelegramProjectAgent(message, project, projectContext);
}

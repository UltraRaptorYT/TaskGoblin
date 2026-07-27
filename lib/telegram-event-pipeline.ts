import type { SupabaseClient } from "@supabase/supabase-js";

import {
  detectProjectEvent,
  PROJECT_EVENT_PROMPT_VERSION,
  projectEventDetectorConfig,
} from "@/lib/project-event-detection";
import {
  completeAiDetectionRun,
  createProjectEventCandidate,
  failAiDetectionRun,
  findProjectEventCandidateBySource,
  loadProjectDetectionContext,
  queueProjectEventCandidate,
  startAiDetectionRun,
  type PersistedProjectEventCandidate,
  type PersistedTelegramMessage,
  type TelegramContext,
} from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

export async function detectAndPersistProjectEvent(
  supabase: SupabaseClient,
  telegramContext: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  message: TelegramInboundMessage,
): Promise<PersistedProjectEventCandidate | null> {
  if (!telegramContext.projectId) return null;

  const existing = await findProjectEventCandidateBySource(
    supabase,
    sourceMessage,
  );
  if (existing) return existing;

  const detectionContext = await loadProjectDetectionContext(
    supabase,
    telegramContext.projectId,
    {
      telegramChatRecordId: telegramContext.chatRecordId!,
      beforeTelegramMessageId: message.messageId,
      messageThreadId: message.messageThreadId,
      sentAt: message.sentAt,
    },
  );
  const config = projectEventDetectorConfig();
  const run = await startAiDetectionRun(
    supabase,
    telegramContext.projectId,
    sourceMessage,
    config.provider,
    config.model,
    PROJECT_EVENT_PROMPT_VERSION,
  );

  try {
    const result = await detectProjectEvent(message, detectionContext, {
      mode: config.provider,
      model: config.model,
    });
    await completeAiDetectionRun(supabase, run.id, result);
    if (!result.event) return null;

    const candidate = await createProjectEventCandidate(
      supabase,
      telegramContext,
      sourceMessage,
      run,
      result.event,
    );
    await queueProjectEventCandidate(supabase, telegramContext, candidate.id);
    return candidate;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Project event detection failed.";
    await failAiDetectionRun(supabase, run.id, message);
    throw error;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TelegramInlineKeyboard } from "@/lib/telegram-bot";
import {
  candidateBatchCallbackData,
  projectNameCallbackData,
} from "@/lib/telegram-callbacks";
import { telegramProjectDashboardUrl } from "@/lib/telegram-links";
import {
  runTelegramProjectAgent,
  validateAgentProjectNameProposal,
  validateAgentTaskProposals,
  type TelegramProjectAgentResult,
} from "@/lib/telegram-project-agent";
import {
  createAgentTaskCandidateBatch,
  createProjectNameCandidate,
  getTelegramProject,
  loadProjectDetectionContext,
  queueAgentTaskCandidateBatch,
  queueProjectNameCandidate,
  type PersistedTelegramMessage,
  type TelegramContext,
} from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

export type TelegramProjectAgentResponse = TelegramProjectAgentResult & {
  replyMarkup?: TelegramInlineKeyboard;
  batchId: string | null;
  projectNameCandidateId: string | null;
};

export async function answerTelegramProjectRequest(
  supabase: SupabaseClient,
  telegramContext: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  message: TelegramInboundMessage,
): Promise<TelegramProjectAgentResponse | null> {
  if (!telegramContext.projectId || !telegramContext.chatRecordId) return null;

  const [project, projectContext] = await Promise.all([
    getTelegramProject(supabase, telegramContext.projectId),
    loadProjectDetectionContext(supabase, telegramContext.projectId, {
      telegramChatRecordId: telegramContext.chatRecordId,
      beforeTelegramMessageId: message.messageId,
      messageThreadId: message.messageThreadId,
      sentAt: message.sentAt,
      recentMessageLimit: 40,
      maxLookbackMinutes: null,
    }),
  ]);
  const result = await runTelegramProjectAgent(
    message,
    project,
    projectContext,
  );
  const validatedTasks = validateAgentTaskProposals(
    result.plan,
    message,
    projectContext,
  );
  const validatedName = validateAgentProjectNameProposal(
    result.plan.projectNameProposal,
    project,
    message,
    projectContext,
  );

  const keyboard: TelegramInlineKeyboard["inline_keyboard"] = [];
  const lines: string[] = [];
  let batchId: string | null = null;
  let projectNameCandidateId: string | null = null;

  if (validatedTasks.accepted.length) {
    const batch = await createAgentTaskCandidateBatch(
      supabase,
      telegramContext,
      sourceMessage,
      validatedTasks.accepted.map((proposal) => ({
        title: proposal.title,
        description: proposal.description,
        ownerTelegramUserRecordId: proposal.ownerTelegramUserRecordId,
        dueLabel: proposal.deadlineText,
        dueAt: proposal.dueAt,
        confidence: proposal.confidence,
      })),
    );
    await queueAgentTaskCandidateBatch(supabase, telegramContext, batch.batchId);
    batchId = batch.batchId;
    lines.push(
      `Proposed ${batch.candidates.length} separate task${batch.candidates.length === 1 ? "" : "s"} for review:`,
      "",
      ...batch.candidates.map(
        (candidate, index) => `${index + 1}. ${candidate.title}`,
      ),
      "",
      "Tap Create all to add every task. Nothing is created until someone confirms.",
    );
    if (validatedTasks.duplicateCount) {
      lines.push(
        `${validatedTasks.duplicateCount} likely duplicate${validatedTasks.duplicateCount === 1 ? " was" : "s were"} left out.`,
      );
    }
    keyboard.push([
      {
        text: `Create all (${batch.candidates.length})`,
        callback_data: candidateBatchCallbackData("confirm", batch.batchId),
      },
      {
        text: "Ignore all",
        callback_data: candidateBatchCallbackData("ignore", batch.batchId),
      },
    ]);
  } else {
    lines.push(result.text);
    if (validatedTasks.duplicateCount) {
      lines.push(
        "",
        "I did not propose new tasks because they already appear to be covered.",
      );
    }
  }

  if (validatedName) {
    const nameCandidate = await createProjectNameCandidate(
      supabase,
      telegramContext,
      sourceMessage,
      {
        originalName: project.name,
        proposedName: validatedName.name,
        evidence: validatedName.evidence,
        confidence: validatedName.confidence,
      },
    );
    await queueProjectNameCandidate(
      supabase,
      telegramContext,
      nameCandidate.id,
    );
    projectNameCandidateId = nameCandidate.id;
    lines.push(
      "",
      `I found a more specific project name: ${nameCandidate.proposedName}`,
      "Confirm it before I update the project shown on the website.",
    );
    keyboard.push([
      {
        text: `Use ${truncate(nameCandidate.proposedName, 36)}`,
        callback_data: projectNameCallbackData("confirm", nameCandidate.id),
      },
      {
        text: "Keep current name",
        callback_data: projectNameCallbackData("ignore", nameCandidate.id),
      },
    ]);
  }

  const dashboardUrl = telegramProjectDashboardUrl(project.id);
  if (dashboardUrl) {
    lines.push("", `Track this project on TaskGoblin:\n${dashboardUrl}`);
    keyboard.push([{ text: "Open project dashboard", url: dashboardUrl }]);
  }

  return {
    ...result,
    text: lines.join("\n").trim(),
    replyMarkup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
    batchId,
    projectNameCandidateId,
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}…`
    : value;
}

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
  sendTelegramMessage,
  type TelegramDelivery,
  type TelegramSendOptions,
} from "@/lib/telegram-bot";
import {
  parseCandidateCallbackData,
  parseProjectEventCandidateCallbackData,
  projectEventCandidateCallbackData,
  type CandidateCallbackAction,
} from "@/lib/telegram-callbacks";
import {
  helpMessage,
  isTelegramCommandLike,
  parseTelegramCommand,
  type TelegramCommandName,
} from "@/lib/telegram-commands";
import {
  claimTelegramUpdate,
  completeTelegramUpdate,
  ensureTelegramContext,
  failTelegramUpdate,
  listProjectTasks,
  persistTelegramMessage,
  reviewProjectEventCandidate,
  reviewTaskCandidate,
  type CandidateReviewResult,
  type PersistedProjectEventCandidate,
  type ProjectEventCandidateReviewResult,
  type TelegramContext,
  type TelegramTaskRow,
} from "@/lib/telegram-repository";
import { detectAndPersistProjectEvent } from "@/lib/telegram-event-pipeline";
import { telegramOnboardingReply } from "@/lib/telegram-onboarding";
import type {
  TelegramInboundCallback,
  TelegramInboundUpdate,
} from "@/lib/taskgoblin-types";

export type TelegramGateway = {
  sendMessage: (
    chatId: string | number,
    text: string,
    options?: TelegramSendOptions,
  ) => Promise<TelegramDelivery>;
  answerCallback: (
    callbackQueryId: string,
    text?: string,
  ) => Promise<TelegramDelivery>;
  clearKeyboard: (
    chatId: string | number,
    messageId: number,
  ) => Promise<TelegramDelivery>;
};

const defaultGateway: TelegramGateway = {
  sendMessage: sendTelegramMessage,
  answerCallback: answerTelegramCallbackQuery,
  clearKeyboard: clearTelegramInlineKeyboard,
};

export async function processTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramInboundUpdate,
  gateway: TelegramGateway = defaultGateway,
) {
  const claimed = await claimTelegramUpdate(supabase, update);
  if (!claimed) return { duplicate: true, replySent: false };

  try {
    const context = await ensureTelegramContext(supabase, update);
    let replySent = false;

    if (update.kind === "message") {
      const persistedMessage = await persistTelegramMessage(
        supabase,
        update,
        context,
      );
      const command = parseTelegramCommand(
        update.text,
        process.env.TELEGRAM_BOT_USERNAME,
      );
      const onboardingReply = telegramOnboardingReply(
        update,
        context,
        process.env.TELEGRAM_BOT_USERNAME,
      );

      if (onboardingReply) {
        const delivery = await gateway.sendMessage(
          update.chat.id,
          onboardingReply,
          {
            replyToMessageId: update.messageId,
          },
        );
        replySent = delivery.sent;
      } else if (command) {
        const response = await routeTelegramCommand(
          supabase,
          command.name,
          context,
        );
        const delivery = await gateway.sendMessage(update.chat.id, response, {
          replyToMessageId: update.messageId,
        });
        replySent = delivery.sent;
      } else if (!isTelegramCommandLike(update.text) && context.projectId) {
        const candidate = await detectAndPersistProjectEvent(
          supabase,
          context,
          persistedMessage,
          update,
        );
        if (candidate) {
          const delivery = await gateway.sendMessage(
            update.chat.id,
            projectEventCandidateMessage(candidate),
            {
              replyToMessageId: update.messageId,
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: projectEventConfirmLabel(candidate.eventType),
                      callback_data: projectEventCandidateCallbackData(
                        "confirm",
                        candidate.id,
                      ),
                    },
                    {
                      text: "Edit",
                      callback_data: projectEventCandidateCallbackData(
                        "edit",
                        candidate.id,
                      ),
                    },
                    {
                      text: "Ignore",
                      callback_data: projectEventCandidateCallbackData(
                        "ignore",
                        candidate.id,
                      ),
                    },
                  ],
                ],
              },
            },
          );
          replySent = delivery.sent;
        }
      }
    } else {
      const isProjectEvent = Boolean(
        parseProjectEventCandidateCallbackData(update.data),
      );
      const result = isProjectEvent
        ? await handleProjectEventCandidateCallback(update, context, {
            answerCallback: gateway.answerCallback,
            clearKeyboard: gateway.clearKeyboard,
            sendMessage: gateway.sendMessage,
            reviewCandidate: (candidateId, action) =>
              reviewProjectEventCandidate(
                supabase,
                context,
                candidateId,
                action,
              ),
          })
        : await handleCandidateCallback(update, context, {
            answerCallback: gateway.answerCallback,
            clearKeyboard: gateway.clearKeyboard,
            sendMessage: gateway.sendMessage,
            reviewCandidate: (candidateId, action) =>
              reviewTaskCandidate(supabase, context, candidateId, action),
          });
      replySent = result.replySent;
    }

    await completeTelegramUpdate(supabase, update.updateId);
    return { duplicate: false, replySent };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram update processing failed.";
    await failTelegramUpdate(supabase, update.updateId, message);
    throw error;
  }
}

export type ProjectEventCandidateCallbackDependencies = {
  answerCallback: (
    callbackQueryId: string,
    text?: string,
  ) => Promise<TelegramDelivery>;
  clearKeyboard: (
    chatId: string | number,
    messageId: number,
  ) => Promise<TelegramDelivery>;
  sendMessage: (
    chatId: string | number,
    text: string,
  ) => Promise<TelegramDelivery>;
  reviewCandidate: (
    candidateId: string,
    action: CandidateCallbackAction,
  ) => Promise<ProjectEventCandidateReviewResult>;
};

export async function handleProjectEventCandidateCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: ProjectEventCandidateCallbackDependencies,
) {
  const callback = parseProjectEventCandidateCallbackData(update.data);
  if (!callback || !update.chat || !context.projectId) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This TaskGoblin action is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const reviewed = await dependencies.reviewCandidate(
    callback.candidateId,
    callback.action,
  );
  await dependencies.answerCallback(
    update.callbackQueryId,
    projectEventCallbackAnswer(reviewed),
  );
  if (update.messageId) {
    await dependencies.clearKeyboard(update.chat.id, update.messageId);
  }
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    projectEventCallbackMessage(reviewed),
  );
  return { handled: true, replySent: delivery.sent, review: reviewed };
}

export type CandidateCallbackDependencies = {
  answerCallback: (
    callbackQueryId: string,
    text?: string,
  ) => Promise<TelegramDelivery>;
  clearKeyboard: (
    chatId: string | number,
    messageId: number,
  ) => Promise<TelegramDelivery>;
  sendMessage: (
    chatId: string | number,
    text: string,
  ) => Promise<TelegramDelivery>;
  reviewCandidate: (
    candidateId: string,
    action: CandidateCallbackAction,
  ) => Promise<CandidateReviewResult>;
};

export async function handleCandidateCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: CandidateCallbackDependencies,
) {
  const callback = parseCandidateCallbackData(update.data);
  if (!callback || !update.chat || !context.projectId) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This TaskGoblin action is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const reviewed = await dependencies.reviewCandidate(
    callback.candidateId,
    callback.action,
  );
  await dependencies.answerCallback(
    update.callbackQueryId,
    callbackAnswer(reviewed.state),
  );
  if (update.messageId) {
    await dependencies.clearKeyboard(update.chat.id, update.messageId);
  }
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    callbackMessage(reviewed),
  );
  return { handled: true, replySent: delivery.sent, review: reviewed };
}

async function routeTelegramCommand(
  supabase: SupabaseClient,
  command: TelegramCommandName,
  context: TelegramContext,
) {
  if (command === "help") return helpMessage();
  if (!context.projectId) {
    return "This chat is not linked to a TaskGoblin project. Add TaskGoblin to a project group first.";
  }

  const tasks = await listProjectTasks(supabase, context.projectId);
  if (command === "summary") return summaryMessage(tasks);
  if (command === "tasks") return tasksMessage(tasks);
  return myTasksMessage(tasks, context.userRecordId);
}

function summaryMessage(tasks: TelegramTaskRow[]) {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const overdue = tasks.filter((task) => task.status === "overdue").length;
  const active = tasks.length - done;
  const unassigned = tasks.filter(
    (task) =>
      task.status !== "done" &&
      !task.owner_telegram_user_id &&
      !task.source_participant_name,
  ).length;
  return [
    "Project summary",
    `Active: ${active}`,
    `Done: ${done}`,
    `Blocked: ${blocked}`,
    `Overdue: ${overdue}`,
    `Unassigned: ${unassigned}`,
  ].join("\n");
}

function tasksMessage(tasks: TelegramTaskRow[]) {
  const active = tasks.filter((task) => task.status !== "done");
  if (!active.length) return "No active confirmed tasks.";
  return [
    "Active tasks",
    ...active.slice(0, 20).map((task, index) => formatTask(task, index)),
    ...(active.length > 20 ? [`…and ${active.length - 20} more.`] : []),
  ].join("\n");
}

function myTasksMessage(
  tasks: TelegramTaskRow[],
  telegramUserRecordId: string | null,
) {
  if (!telegramUserRecordId) return "I could not identify your Telegram account.";
  const mine = tasks.filter(
    (task) => task.owner_telegram_user_id === telegramUserRecordId,
  );
  if (!mine.length) return "No confirmed tasks are assigned to you.";
  return [
    "My tasks",
    ...mine.slice(0, 20).map((task, index) => formatTask(task, index)),
    ...(mine.length > 20 ? [`…and ${mine.length - 20} more.`] : []),
  ].join("\n");
}

function formatTask(task: TelegramTaskRow, index: number) {
  const due = task.due_label ? ` · due ${task.due_label}` : "";
  return `${index + 1}. [${task.status}] ${task.title}${due}`;
}

function callbackAnswer(state: CandidateReviewResult["state"]) {
  if (state === "confirmed") return "Task confirmed.";
  if (state === "edited") return "Candidate marked for editing.";
  return "Candidate ignored.";
}

function callbackMessage(review: CandidateReviewResult) {
  if (review.state === "confirmed") return `Task created: ${review.title}`;
  if (review.state === "edited") {
    return `Candidate marked for editing: ${review.title}\nInteractive edit capture is not available yet.`;
  }
  return `Candidate ignored: ${review.title}`;
}

function projectEventCandidateMessage(
  candidate: PersistedProjectEventCandidate,
) {
  const duplicate = candidate.duplicateOfTaskId
    ? `Possible duplicate of task ${candidate.duplicateOfTaskId}.`
    : candidate.duplicateOfCandidateId
      ? "Possible duplicate of a recent candidate."
      : null;
  const lines = [
    `Possible ${projectEventLabel(candidate.eventType)} detected:`,
    "",
    candidate.summary,
  ];
  if (candidate.dueLabel) {
    lines.push("", `Deadline: ${candidate.dueLabel}`);
    lines.push("A private reminder will be queued one hour before.");
  }
  if (duplicate) lines.push("", duplicate);
  lines.push(
    "",
    "Review this before TaskGoblin changes project state.",
  );
  return lines.join("\n");
}

function projectEventLabel(
  eventType: PersistedProjectEventCandidate["eventType"],
) {
  return eventType.replaceAll("_", " ");
}

function projectEventConfirmLabel(
  eventType: PersistedProjectEventCandidate["eventType"],
) {
  if (eventType === "possible_task_completion") return "Mark complete";
  if (eventType === "deadline_update") return "Update deadline";
  if (eventType === "task_progress_update") return "Add update";
  if (eventType === "blocker") return "Record blocker";
  if (eventType === "decision") return "Record decision";
  return "Create task";
}

function projectEventCallbackAnswer(
  review: ProjectEventCandidateReviewResult,
) {
  if (review.state === "confirmed") return "Project event confirmed.";
  if (review.state === "edited") return "Candidate marked for editing.";
  return "Candidate ignored.";
}

function projectEventCallbackMessage(
  review: ProjectEventCandidateReviewResult,
) {
  if (review.state === "confirmed") {
    if (
      review.eventType === "task_proposal" ||
      review.eventType === "explicit_task_assignment"
    ) {
      return confirmedProjectEventMessage(
        `Task created: ${review.summary}`,
        review.reminderScheduledFor,
      );
    }
    return confirmedProjectEventMessage(
      `Project event recorded: ${review.summary}`,
      review.reminderScheduledFor,
    );
  }
  if (review.state === "edited") {
    return `Candidate marked for editing: ${review.summary}\nInteractive edit capture is not available yet.`;
  }
  return `Candidate ignored: ${review.summary}`;
}

function confirmedProjectEventMessage(
  message: string,
  reminderScheduledFor: string | null,
) {
  return reminderScheduledFor
    ? `${message}\nPrivate reminder queued for ${formatReminderTime(reminderScheduledFor)}.`
    : message;
}

function formatReminderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

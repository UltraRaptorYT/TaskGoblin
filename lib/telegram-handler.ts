import type { SupabaseClient } from "@supabase/supabase-js";

import {
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
  sendTelegramMessage,
  type TelegramDelivery,
  type TelegramSendOptions,
} from "@/lib/telegram-bot";
import {
  parseBulkAssignmentCallbackData,
  parseCandidateBatchCallbackData,
  parseCandidateCallbackData,
  parseProjectEventCandidateCallbackData,
  parseProjectNameCallbackData,
  parseTaskViewCallbackData,
  projectEventCandidateCallbackData,
  type CandidateCallbackAction,
} from "@/lib/telegram-callbacks";
import {
  groupMyTasksResponse,
  kpiResponse,
  privateMyTasksResponse,
  projectResponse,
  summaryResponse,
  taskDetailMessage,
  tasksResponse,
  type TelegramCommandResponse,
} from "@/lib/telegram-command-responses";
import {
  helpMessage,
  isTelegramCommandLike,
  parseTelegramCommand,
  type TelegramCommandName,
} from "@/lib/telegram-commands";
import { coalesceRapidTelegramMessages } from "@/lib/telegram-message-batching";
import {
  claimTelegramUpdate,
  completeTelegramUpdate,
  ensureTelegramContext,
  failTelegramUpdate,
  getTaskForTelegramContext,
  getTelegramProject,
  loadProjectSummaryKnowledge,
  linkPersistedTelegramMessageToProject,
  listProjectTasks,
  listTelegramUserTasks,
  persistTelegramProjectDocument,
  persistTelegramMessage,
  reviewAgentTaskCandidateBatch,
  reviewBulkAssignmentCandidate,
  reviewProjectNameCandidate,
  reviewProjectEventCandidate,
  reviewTaskCandidate,
  resolvePrivateReminderReplyContext,
  resolveRecentPrivateReminderContext,
  updatePersistedTelegramMessageText,
  type CandidateBatchReviewResult,
  type BulkAssignmentReviewResult,
  type CandidateReviewResult,
  type PersistedProjectEventCandidate,
  type ProjectEventCandidateReviewResult,
  type ProjectNameCandidateReviewResult,
  type TelegramContext,
  type TelegramPrivateReplyContext,
  type TelegramUserTaskRow,
} from "@/lib/telegram-repository";
import {
  displayFilename,
  documentMessageText,
  extractTelegramDocument,
} from "@/lib/telegram-document";
import { detectAndPersistProjectEvent } from "@/lib/telegram-event-pipeline";
import { shouldInvokeTelegramProjectAgent } from "@/lib/telegram-project-agent";
import { answerTelegramProjectRequest } from "@/lib/telegram-project-agent-pipeline";
import { handleExplicitTelegramProjectAction } from "@/lib/telegram-project-actions";
import {
  telegramBotAddedReply,
  telegramOnboardingReply,
} from "@/lib/telegram-onboarding";
import type {
  TelegramInboundCallback,
  TelegramInboundMessage,
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

    if (update.kind === "bot_added") {
      const delivery = await gateway.sendMessage(
        update.chat.id,
        telegramBotAddedReply(
          update.bot,
          process.env.TELEGRAM_BOT_USERNAME,
          context.projectId,
        ),
      );
      replySent = delivery.sent;
    } else if (update.kind === "message") {
      let detectionMessage = update.document
        ? { ...update, text: documentMessageText(update) }
        : update;
      const persistedMessage = await persistTelegramMessage(
        supabase,
        detectionMessage,
        context,
      );
      let documentFailed = false;
      if (update.document) {
        if (!context.projectId) {
          const delivery = await gateway.sendMessage(
            update.chat.id,
            "Send this document in a TaskGoblin project group so I can add it to that project's context.",
            { replyToMessageId: update.messageId },
          );
          replySent = delivery.sent;
          documentFailed = true;
        } else {
          try {
            const extraction = await extractTelegramDocument(update.document);
            detectionMessage = {
              ...update,
              text: documentMessageText(update, extraction),
            };
            await Promise.all([
              updatePersistedTelegramMessageText(
                supabase,
                persistedMessage,
                detectionMessage.text,
              ),
              persistTelegramProjectDocument(
                supabase,
                context,
                persistedMessage,
                update.document,
                { extraction },
              ),
            ]);
            const delivery = await gateway.sendMessage(
              update.chat.id,
              [
                `📄 Read ${extraction.filename} and added it to this project's context.`,
                extraction.wasTruncated
                  ? "The document was long, so only the first 120,000 characters were retained."
                  : "I can now use it to understand later task discussions in this group.",
              ].join("\n"),
              { replyToMessageId: update.messageId },
            );
            replySent = delivery.sent;
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "TaskGoblin could not read this document.";
            await persistTelegramProjectDocument(
              supabase,
              context,
              persistedMessage,
              update.document,
              { error: message },
            );
            const delivery = await gateway.sendMessage(
              update.chat.id,
              `I couldn't read ${displayFilename(update.document)}. ${message}`,
              { replyToMessageId: update.messageId },
            );
            replySent = delivery.sent;
            documentFailed = true;
          }
        }
      }
      const command = parseTelegramCommand(
        detectionMessage.text,
        process.env.TELEGRAM_BOT_USERNAME,
      );
      const onboardingReply = update.document
        ? null
        : telegramOnboardingReply(
            update,
            context,
            process.env.TELEGRAM_BOT_USERNAME,
            process.env.TELEGRAM_BOT_TOKEN,
          );
      let effectiveContext = context;
      let supersededByRapidMessage = false;

      if (
        !command &&
        !onboardingReply &&
        !documentFailed &&
        update.chat.type === "private" &&
        context.userRecordId
      ) {
        const replyContext = update.replyToMessageId
          ? await resolvePrivateReminderReplyContext(
              supabase,
              context.userRecordId,
              update.chat.id,
              update.replyToMessageId,
            )
          : await resolveRecentPrivateReminderContext(
              supabase,
              context.userRecordId,
              update.chat.id,
              update.sentAt,
            );
        if (replyContext) {
          effectiveContext = {
            ...context,
            projectId: replyContext.projectId,
          };
          await linkPersistedTelegramMessageToProject(
            supabase,
            persistedMessage,
            replyContext.projectId,
          );
          detectionMessage = privateReminderReplyMessage(
            detectionMessage,
            replyContext,
          );
        }
      }

      if (!command && !onboardingReply && !documentFailed) {
        const batch = await coalesceRapidTelegramMessages(
          supabase,
          effectiveContext,
          detectionMessage,
        );
        detectionMessage = batch.message;
        supersededByRapidMessage = batch.superseded;
      }

      const explicitProjectAction =
        !command &&
        !onboardingReply &&
        !documentFailed &&
        !supersededByRapidMessage &&
        effectiveContext.projectId
          ? await handleExplicitTelegramProjectAction(
              supabase,
              effectiveContext,
              persistedMessage,
              detectionMessage,
            )
          : null;

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
          update.chat.type === "private",
        );
        const delivery = await gateway.sendMessage(
          update.chat.id,
          response.text,
          {
            replyToMessageId: update.messageId,
            replyMarkup: response.replyMarkup,
          },
        );
        replySent = delivery.sent;
      } else if (supersededByRapidMessage) {
        // The newest message in this burst will process the combined text.
      } else if (explicitProjectAction) {
        const delivery = await gateway.sendMessage(
          update.chat.id,
          explicitProjectAction.text,
          {
            replyToMessageId: update.messageId,
            replyMarkup: explicitProjectAction.replyMarkup,
          },
        );
        replySent = delivery.sent;
      } else if (
        effectiveContext.projectId &&
        shouldInvokeTelegramProjectAgent(
          detectionMessage,
          process.env.TELEGRAM_BOT_USERNAME,
        )
      ) {
        const response = await answerTelegramProjectRequest(
          supabase,
          effectiveContext,
          persistedMessage,
          detectionMessage,
        );
        if (response) {
          const delivery = await gateway.sendMessage(
            update.chat.id,
            response.text,
            {
              replyToMessageId: update.messageId,
              replyMarkup: response.replyMarkup,
            },
          );
          replySent = delivery.sent;
        }
      } else if (
        !documentFailed &&
        !isTelegramCommandLike(detectionMessage.text) &&
        effectiveContext.projectId
      ) {
        const candidate = await detectAndPersistProjectEvent(
          supabase,
          effectiveContext,
          persistedMessage,
          detectionMessage,
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
          replySent = delivery.sent || replySent;
        }
      }
    } else {
      const taskView = parseTaskViewCallbackData(update.data);
      const bulkAssignment = parseBulkAssignmentCallbackData(update.data);
      const taskBatch = parseCandidateBatchCallbackData(update.data);
      const projectName = parseProjectNameCallbackData(update.data);
      const isProjectEvent = Boolean(
        parseProjectEventCandidateCallbackData(update.data),
      );
      const result = taskView
        ? await handleTaskViewCallback(update, context, {
            answerCallback: gateway.answerCallback,
            sendMessage: gateway.sendMessage,
            loadTask: (taskId) =>
              getTaskForTelegramContext(supabase, context, taskId),
          })
        : bulkAssignment
          ? await handleBulkAssignmentCallback(update, context, {
              answerCallback: gateway.answerCallback,
              clearKeyboard: gateway.clearKeyboard,
              sendMessage: gateway.sendMessage,
              reviewCandidate: (candidateId, action) =>
                reviewBulkAssignmentCandidate(
                  supabase,
                  context,
                  candidateId,
                  action,
                ),
            })
        : taskBatch
          ? await handleCandidateBatchCallback(update, context, {
              answerCallback: gateway.answerCallback,
              clearKeyboard: gateway.clearKeyboard,
              sendMessage: gateway.sendMessage,
              reviewBatch: (batchId, action) =>
                reviewAgentTaskCandidateBatch(
                  supabase,
                  context,
                  batchId,
                  action,
                ),
            })
          : projectName
            ? await handleProjectNameCallback(update, context, {
                answerCallback: gateway.answerCallback,
                clearKeyboard: gateway.clearKeyboard,
                sendMessage: gateway.sendMessage,
                reviewCandidate: (candidateId, action) =>
                  reviewProjectNameCandidate(
                    supabase,
                    context,
                    candidateId,
                    action,
                  ),
              })
            : isProjectEvent
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

export type BulkAssignmentCallbackDependencies = {
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
    action: "confirm" | "ignore",
  ) => Promise<BulkAssignmentReviewResult>;
};

export async function handleBulkAssignmentCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: BulkAssignmentCallbackDependencies,
) {
  const callback = parseBulkAssignmentCallbackData(update.data);
  if (!callback || !update.chat || !context.projectId) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This bulk assignment is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const reviewed = await dependencies.reviewCandidate(
    callback.candidateId,
    callback.action,
  );
  await dependencies.answerCallback(
    update.callbackQueryId,
    reviewed.state === "confirmed"
      ? `${reviewed.assignedTaskCount} tasks assigned.`
      : "Bulk assignment cancelled.",
  );
  if (update.messageId) {
    await dependencies.clearKeyboard(update.chat.id, update.messageId);
  }
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    reviewed.state === "confirmed"
      ? `Assigned ${reviewed.assignedTaskCount} active tasks to ${reviewed.targetOwnerDisplayName}.`
      : `Cancelled assigning all tasks to ${reviewed.targetOwnerDisplayName}.`,
  );
  return { handled: true, replySent: delivery.sent, review: reviewed };
}

export type CandidateBatchCallbackDependencies = {
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
  reviewBatch: (
    batchId: string,
    action: "confirm" | "ignore",
  ) => Promise<CandidateBatchReviewResult>;
};

export async function handleCandidateBatchCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: CandidateBatchCallbackDependencies,
) {
  const callback = parseCandidateBatchCallbackData(update.data);
  if (!callback || !update.chat || !context.projectId) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This task batch is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const reviewed = await dependencies.reviewBatch(
    callback.batchId,
    callback.action,
  );
  await dependencies.answerCallback(
    update.callbackQueryId,
    reviewed.state === "confirmed"
      ? `${reviewed.titles.length} tasks created.`
      : `${reviewed.titles.length} proposals ignored.`,
  );
  if (update.messageId) {
    await dependencies.clearKeyboard(update.chat.id, update.messageId);
  }
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    reviewed.state === "confirmed"
      ? [
          `Created ${reviewed.titles.length} separate tasks:`,
          ...reviewed.titles.map(
            (title, index) => `${index + 1}. ${title}`,
          ),
        ].join("\n")
      : `Ignored ${reviewed.titles.length} task proposals.`,
  );
  return { handled: true, replySent: delivery.sent, review: reviewed };
}

export type ProjectNameCallbackDependencies = {
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
    action: "confirm" | "ignore",
  ) => Promise<ProjectNameCandidateReviewResult>;
};

export async function handleProjectNameCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: ProjectNameCallbackDependencies,
) {
  const callback = parseProjectNameCallbackData(update.data);
  if (!callback || !update.chat || !context.projectId) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This project-name suggestion is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const reviewed = await dependencies.reviewCandidate(
    callback.candidateId,
    callback.action,
  );
  await dependencies.answerCallback(
    update.callbackQueryId,
    reviewed.state === "confirmed"
      ? "Project name updated."
      : "Project name kept.",
  );
  if (update.messageId) {
    await dependencies.clearKeyboard(update.chat.id, update.messageId);
  }
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    reviewed.state === "confirmed"
      ? `Project renamed to ${reviewed.projectName}. The website now uses this name.`
      : `Kept the current project name instead of ${reviewed.projectName}.`,
  );
  return { handled: true, replySent: delivery.sent, review: reviewed };
}

export type TaskViewCallbackDependencies = {
  answerCallback: (
    callbackQueryId: string,
    text?: string,
  ) => Promise<TelegramDelivery>;
  sendMessage: (
    chatId: string | number,
    text: string,
  ) => Promise<TelegramDelivery>;
  loadTask: (taskId: string) => Promise<TelegramUserTaskRow | null>;
};

export async function handleTaskViewCallback(
  update: TelegramInboundCallback,
  context: TelegramContext,
  dependencies: TaskViewCallbackDependencies,
) {
  const callback = parseTaskViewCallbackData(update.data);
  if (
    !callback ||
    !update.chat ||
    (!context.projectId && !context.userRecordId)
  ) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "This task selection is invalid or expired.",
    );
    return { handled: false, replySent: false };
  }

  const task = await dependencies.loadTask(callback.taskId);
  if (!task) {
    await dependencies.answerCallback(
      update.callbackQueryId,
      "Task not found or unavailable in this chat.",
    );
    return { handled: true, replySent: false };
  }

  await dependencies.answerCallback(update.callbackQueryId, "Task details");
  const delivery = await dependencies.sendMessage(
    update.chat.id,
    taskDetailMessage(task),
  );
  return { handled: true, replySent: delivery.sent, task };
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
  isPrivateChat: boolean,
): Promise<TelegramCommandResponse> {
  if (command === "start") {
    return {
      text: isPrivateChat
        ? [
            "👋 Welcome to your TaskGoblin workspace.",
            "",
            "Use /mytasks to browse your assigned tasks across every project.",
            "Open a project group to use /summary, /project, /kpi, and /tasks.",
          ].join("\n")
        : helpMessage(),
    };
  }
  if (command === "help") return { text: helpMessage() };
  if (command === "mytasks" && isPrivateChat) {
    if (!context.userRecordId) {
      return { text: "I could not identify your Telegram account." };
    }
    const tasks = await listTelegramUserTasks(supabase, context.userRecordId);
    return privateMyTasksResponse(tasks);
  }
  if (!context.projectId) {
    return {
      text: "This command needs a TaskGoblin project group. Use /mytasks here to browse your assignments across all projects.",
    };
  }

  const [project, tasks] = await Promise.all([
    getTelegramProject(supabase, context.projectId),
    listProjectTasks(supabase, context.projectId),
  ]);
  if (command === "summary") {
    const knowledge = await loadProjectSummaryKnowledge(
      supabase,
      context.projectId,
    );
    return summaryResponse(project, tasks, knowledge);
  }
  if (command === "project") return projectResponse(project, tasks);
  if (command === "kpi") return kpiResponse(project, tasks);
  if (command === "tasks") return tasksResponse(project, tasks);
  return groupMyTasksResponse(project, tasks, context.userRecordId);
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

function privateReminderReplyMessage(
  message: TelegramInboundMessage,
  context: TelegramPrivateReplyContext,
): TelegramInboundMessage {
  return {
    ...message,
    text: [
      `Private project follow-up for "${context.taskTitle}" in ${context.projectName}.`,
      `The member replied: ${message.text}`,
      "Give grounded, practical advice using the current task and project context.",
    ].join("\n"),
  };
}

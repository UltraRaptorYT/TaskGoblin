import type { SupabaseClient } from "@supabase/supabase-js";

import {
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
  sendTelegramMessage,
  setTelegramMessageReaction,
  type TelegramDelivery,
  type TelegramSendOptions,
} from "@/lib/telegram-bot";
import {
  candidateDeadlineCallbackData,
  candidateEditCallbackData,
  editSessionChoiceCallbackData,
  parseBulkAssignmentCallbackData,
  parseCandidateBatchCallbackData,
  parseCandidateCallbackData,
  parseCandidateDeadlineCallbackData,
  parseCandidateEditCallbackData,
  parseEditSessionChoiceCallbackData,
  parseProjectHomeCallbackData,
  parseProjectEventCandidateCallbackData,
  parseProjectNameCallbackData,
  parseTaskActionCallbackData,
  parseTaskDeadlineCallbackData,
  parseTaskSnoozeCallbackData,
  parseTaskViewCallbackData,
  projectEventCandidateCallbackData,
  taskDeadlineCallbackData,
  taskSnoozeCallbackData,
  type CandidateCallbackAction,
} from "@/lib/telegram-callbacks";
import {
  dueTodayResponse,
  groupMyTasksResponse,
  kpiResponse,
  privateMyTasksResponse,
  projectHomeMenu,
  projectHomeResponse,
  projectResponse,
  settingsResponse,
  summaryResponse,
  taskDetailResponse,
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
  applyTelegramOwnerChoice,
  claimTelegramUpdate,
  completeTelegramUpdate,
  consumeTelegramTitleEdit,
  ensureTelegramContext,
  failTelegramUpdate,
  getTaskForTelegramContext,
  getTelegramProject,
  loadProjectSummaryKnowledge,
  linkPersistedTelegramMessageToProject,
  listProjectTasks,
  listTelegramUserTasks,
  snoozeTaskReminder,
  startTelegramEditSession,
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
  updateCandidateDeadlineFromTelegram,
  updateTaskDeadlineFromTelegram,
  updateTaskStatusFromTelegram,
  undoLastTaskMutation,
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
  deadlineFromPreset,
  snoozeFromPreset,
} from "@/lib/telegram-interaction-time";
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
  reactToMessage?: (
    chatId: string | number,
    messageId: number,
    emoji?: string,
  ) => Promise<TelegramDelivery>;
};

const defaultGateway: TelegramGateway = {
  sendMessage: sendTelegramMessage,
  answerCallback: answerTelegramCallbackQuery,
  clearKeyboard: clearTelegramInlineKeyboard,
  reactToMessage: setTelegramMessageReaction,
};

const AUTO_COMPLETION_CONFIDENCE = 0.85;

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
        {
          replyMarkup: context.projectId
            ? projectHomeMenu({ id: context.projectId, name: "Project" })
            : undefined,
        },
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
      const inlineTitleEdit =
        !command && !onboardingReply && !update.document
          ? await consumeTelegramTitleEdit(
              supabase,
              context,
              detectionMessage.text,
            )
          : null;

      if (
        !command &&
        !onboardingReply &&
        !inlineTitleEdit &&
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

      if (!command && !onboardingReply && !inlineTitleEdit && !documentFailed) {
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
        !inlineTitleEdit &&
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

      if (inlineTitleEdit) {
        const delivery = await gateway.sendMessage(
          update.chat.id,
          inlineTitleEdit.cancelled
            ? "Editing cancelled."
            : `✅ Updated title to: ${inlineTitleEdit.title}`,
          { replyToMessageId: update.messageId },
        );
        replySent = delivery.sent;
      } else if (onboardingReply) {
        const delivery = await gateway.sendMessage(
          update.chat.id,
          onboardingReply,
          {
            replyToMessageId: update.messageId,
            replyMarkup: context.projectId
              ? projectHomeMenu({ id: context.projectId, name: "Project" })
              : undefined,
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
          if (
            candidate.eventType === "possible_task_completion" &&
            candidate.matchedTaskId &&
            candidate.confidence >= AUTO_COMPLETION_CONFIDENCE &&
            effectiveContext.userRecordId
          ) {
            await reviewProjectEventCandidate(
              supabase,
              effectiveContext,
              candidate.id,
              "confirm",
            );
            const reaction = gateway.reactToMessage
              ? await gateway.reactToMessage(
                  update.chat.id,
                  update.messageId,
                  "🎉",
                )
              : { sent: false };
            // A failed reaction must not create a noisy acknowledgement message.
            // The confirmed task mutation remains persisted and visible in task views.
            replySent = reaction.sent || replySent;
          } else {
            const delivery = await gateway.sendMessage(
              update.chat.id,
              projectEventCandidateMessage(candidate),
              {
                replyToMessageId: update.messageId,
                replyMarkup: {
                  inline_keyboard: [
                    [
                      {
                        text: `✅ ${projectEventConfirmLabel(candidate.eventType)}`,
                        callback_data: projectEventCandidateCallbackData(
                          "confirm",
                          candidate.id,
                        ),
                      },
                      {
                        text: "✏️ Edit",
                        callback_data: projectEventCandidateCallbackData(
                          "edit",
                          candidate.id,
                        ),
                      },
                      {
                        text: "❌ Ignore",
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
      }
    } else {
      const interactiveResult = await handleInteractiveTelegramCallback(
        supabase,
        update,
        context,
        gateway,
      );
      const taskView = parseTaskViewCallbackData(update.data);
      const bulkAssignment = parseBulkAssignmentCallbackData(update.data);
      const taskBatch = parseCandidateBatchCallbackData(update.data);
      const projectName = parseProjectNameCallbackData(update.data);
      const isProjectEvent = Boolean(
        parseProjectEventCandidateCallbackData(update.data),
      );
      const result = interactiveResult ?? (taskView
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
            }));
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

async function handleInteractiveTelegramCallback(
  supabase: SupabaseClient,
  update: TelegramInboundCallback,
  context: TelegramContext,
  gateway: TelegramGateway,
) {
  if (!update.chat) return null;

  const projectEvent = parseProjectEventCandidateCallbackData(update.data);
  if (projectEvent?.action === "edit" && context.projectId) {
    await gateway.answerCallback(update.callbackQueryId, "Choose what to edit");
    const delivery = await gateway.sendMessage(
      update.chat.id,
      "✏️ What should change before this project event is confirmed?",
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "📝 Title",
                callback_data: candidateEditCallbackData(
                  "title",
                  projectEvent.candidateId,
                ),
              },
              {
                text: "👤 Owner",
                callback_data: candidateEditCallbackData(
                  "owner",
                  projectEvent.candidateId,
                ),
              },
            ],
            [
              {
                text: "📅 Deadline",
                callback_data: candidateEditCallbackData(
                  "deadline",
                  projectEvent.candidateId,
                ),
              },
            ],
          ],
        },
      },
    );
    return { handled: true, replySent: delivery.sent };
  }

  const candidateEdit = parseCandidateEditCallbackData(update.data);
  if (candidateEdit && context.projectId) {
    if (candidateEdit.field === "deadline") {
      await gateway.answerCallback(update.callbackQueryId, "Choose a deadline");
      const delivery = await gateway.sendMessage(
        update.chat.id,
        "📅 Set the candidate deadline:",
        { replyMarkup: candidateDeadlineMenu(candidateEdit.candidateId) },
      );
      return { handled: true, replySent: delivery.sent };
    }
    const session = await startTelegramEditSession(supabase, context, {
      targetKind: "project_event_candidate",
      targetId: candidateEdit.candidateId,
      fieldName: candidateEdit.field,
    });
    await gateway.answerCallback(update.callbackQueryId, "Editing started");
    const delivery =
      candidateEdit.field === "title"
        ? await gateway.sendMessage(
            update.chat.id,
            "📝 Send the corrected title now. Send /cancel to stop editing.",
          )
        : await gateway.sendMessage(
            update.chat.id,
            session.options.length
              ? "👤 Choose the correct owner:"
              : "No linked project members are available yet. Ask members to say hello in this group.",
            {
              replyMarkup: ownerChoiceMenu(session.id, session.options),
            },
          );
    return { handled: true, replySent: delivery.sent };
  }

  const candidateDeadline = parseCandidateDeadlineCallbackData(update.data);
  if (candidateDeadline && context.projectId) {
    const deadline = deadlineFromPreset(candidateDeadline.preset);
    const updated = await updateCandidateDeadlineFromTelegram(
      supabase,
      context,
      candidateDeadline.candidateId,
      deadline,
    );
    await gateway.answerCallback(update.callbackQueryId, "Deadline updated");
    const delivery = await gateway.sendMessage(
      update.chat.id,
      `✅ Candidate updated\n\n${updated.summary}\nDeadline: ${updated.dueLabel ?? "None"}`,
    );
    return { handled: true, replySent: delivery.sent };
  }

  const ownerChoice = parseEditSessionChoiceCallbackData(update.data);
  if (ownerChoice) {
    const changed = await applyTelegramOwnerChoice(
      supabase,
      context,
      ownerChoice.sessionId,
      ownerChoice.optionIndex,
    );
    await gateway.answerCallback(update.callbackQueryId, "Owner updated");
    if (update.messageId) {
      await gateway.clearKeyboard(update.chat.id, update.messageId);
    }
    const delivery = await gateway.sendMessage(
      update.chat.id,
      `✅ Owner changed to ${changed.owner.displayName}.`,
    );
    return { handled: true, replySent: delivery.sent };
  }

  const taskDeadline = parseTaskDeadlineCallbackData(update.data);
  if (taskDeadline) {
    const task = await getTaskForTelegramContext(
      supabase,
      context,
      taskDeadline.taskId,
    );
    if (!task) {
      await gateway.answerCallback(update.callbackQueryId, "Task unavailable");
      return { handled: true, replySent: false };
    }
    const changed = await updateTaskDeadlineFromTelegram(
      supabase,
      { ...context, projectId: task.project_id },
      task,
      deadlineFromPreset(taskDeadline.preset),
    );
    await gateway.answerCallback(update.callbackQueryId, "Deadline updated");
    const response = taskDetailResponse(changed ?? task, {
      privateChat: update.chat.type === "private",
    });
    const delivery = await gateway.sendMessage(update.chat.id, response.text, {
      replyMarkup: response.replyMarkup,
    });
    return { handled: true, replySent: delivery.sent };
  }

  const taskSnooze = parseTaskSnoozeCallbackData(update.data);
  if (taskSnooze) {
    const task = await getTaskForTelegramContext(
      supabase,
      context,
      taskSnooze.taskId,
    );
    if (!task) {
      await gateway.answerCallback(update.callbackQueryId, "Task unavailable");
      return { handled: true, replySent: false };
    }
    const scheduledFor = snoozeFromPreset(taskSnooze.preset);
    await snoozeTaskReminder(supabase, task, scheduledFor);
    await gateway.answerCallback(update.callbackQueryId, "Reminder snoozed");
    const delivery = await gateway.sendMessage(
      update.chat.id,
      `⏰ I'll remind you about “${task.title}” ${formatReminderTime(scheduledFor)}.`,
    );
    return { handled: true, replySent: delivery.sent };
  }

  const taskAction = parseTaskActionCallbackData(update.data);
  if (taskAction) {
    const task = await getTaskForTelegramContext(
      supabase,
      context,
      taskAction.taskId,
    );
    if (!task) {
      await gateway.answerCallback(update.callbackQueryId, "Task unavailable");
      return { handled: true, replySent: false };
    }
    const taskContext = { ...context, projectId: task.project_id };
    if (taskAction.action === "complete" || taskAction.action === "reopen") {
      const changed = await updateTaskStatusFromTelegram(
        supabase,
        taskContext,
        task,
        taskAction.action === "complete" ? "done" : "todo",
      );
      await gateway.answerCallback(
        update.callbackQueryId,
        taskAction.action === "complete" ? "Task completed" : "Task reopened",
      );
      const response = taskDetailResponse(changed, {
        privateChat: update.chat.type === "private",
      });
      const delivery = await gateway.sendMessage(update.chat.id, response.text, {
        replyMarkup: response.replyMarkup,
      });
      return { handled: true, replySent: delivery.sent };
    }
    if (taskAction.action === "edit_deadline") {
      await gateway.answerCallback(update.callbackQueryId, "Choose a deadline");
      const delivery = await gateway.sendMessage(
        update.chat.id,
        `📅 Deadline for “${task.title}”:`,
        { replyMarkup: taskDeadlineMenu(task.id) },
      );
      return { handled: true, replySent: delivery.sent };
    }
    if (taskAction.action === "snooze") {
      await gateway.answerCallback(update.callbackQueryId, "Choose when");
      const delivery = await gateway.sendMessage(
        update.chat.id,
        `⏰ Snooze “${task.title}” until:`,
        { replyMarkup: taskSnoozeMenu(task.id) },
      );
      return { handled: true, replySent: delivery.sent };
    }
    if (taskAction.action === "edit_title" || taskAction.action === "edit_owner") {
      const fieldName = taskAction.action === "edit_title" ? "title" : "owner";
      const session = await startTelegramEditSession(supabase, taskContext, {
        targetKind: "task",
        targetId: task.id,
        fieldName,
      });
      await gateway.answerCallback(update.callbackQueryId, "Editing started");
      const delivery =
        fieldName === "title"
          ? await gateway.sendMessage(
              update.chat.id,
              "📝 Send the corrected task title now. Send /cancel to stop editing.",
            )
          : await gateway.sendMessage(
              update.chat.id,
              session.options.length
                ? "👤 Choose the new owner:"
                : "No linked project members are available yet.",
              { replyMarkup: ownerChoiceMenu(session.id, session.options) },
            );
      return { handled: true, replySent: delivery.sent };
    }
    await gateway.answerCallback(update.callbackQueryId, "Task details");
    const response = taskDetailResponse(task, {
      privateChat: update.chat.type === "private",
    });
    const delivery = await gateway.sendMessage(update.chat.id, response.text, {
      replyMarkup: response.replyMarkup,
    });
    return { handled: true, replySent: delivery.sent };
  }

  const home = parseProjectHomeCallbackData(update.data);
  if (home && context.projectId) {
    const [project, tasks] = await Promise.all([
      getTelegramProject(supabase, context.projectId),
      listProjectTasks(supabase, context.projectId),
    ]);
    const response =
      home.action === "tasks"
        ? tasksResponse(project, tasks)
        : home.action === "due_today"
          ? dueTodayResponse(project, tasks)
          : home.action === "settings"
            ? settingsResponse(project)
            : projectHomeResponse(project, tasks);
    await gateway.answerCallback(update.callbackQueryId, "TaskGoblin");
    const delivery = await gateway.sendMessage(update.chat.id, response.text, {
      replyMarkup: response.replyMarkup,
    });
    return { handled: true, replySent: delivery.sent };
  }

  return null;
}

function ownerChoiceMenu(
  sessionId: string,
  options: Array<{ displayName: string }>,
) {
  if (!options.length) return undefined;
  return {
    inline_keyboard: options.map((option, index) => [
      {
        text: `👤 ${option.displayName}`,
        callback_data: editSessionChoiceCallbackData(sessionId, index),
      },
    ]),
  };
}

function taskDeadlineMenu(taskId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Today", callback_data: taskDeadlineCallbackData("today", taskId) },
        { text: "Tomorrow", callback_data: taskDeadlineCallbackData("tomorrow", taskId) },
      ],
      [
        { text: "Next week", callback_data: taskDeadlineCallbackData("next_week", taskId) },
        { text: "Clear", callback_data: taskDeadlineCallbackData("clear", taskId) },
      ],
    ],
  };
}

function candidateDeadlineMenu(candidateId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Today", callback_data: candidateDeadlineCallbackData("today", candidateId) },
        { text: "Tomorrow", callback_data: candidateDeadlineCallbackData("tomorrow", candidateId) },
      ],
      [
        { text: "Next week", callback_data: candidateDeadlineCallbackData("next_week", candidateId) },
        { text: "Clear", callback_data: candidateDeadlineCallbackData("clear", candidateId) },
      ],
    ],
  };
}

function taskSnoozeMenu(taskId: string) {
  return {
    inline_keyboard: [
      [
        { text: "1 hour", callback_data: taskSnoozeCallbackData("one_hour", taskId) },
        { text: "Tomorrow 9 AM", callback_data: taskSnoozeCallbackData("tomorrow_morning", taskId) },
      ],
    ],
  };
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
  if (command === "start" && isPrivateChat) {
    return {
      text: [
            "👋 Welcome to your TaskGoblin workspace.",
            "",
            "Use /mytasks to browse your assigned tasks across every project.",
            "Open a project group to use /summary, /project, /kpi, and /tasks.",
          ].join("\n"),
    };
  }
  if (command === "help" && isPrivateChat) return { text: helpMessage() };
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

  if (command === "undo") {
    const undone = await undoLastTaskMutation(supabase, context);
    return {
      text: undone
        ? `↩️ ${undone.description}`
        : "There is no task change to undo in this project.",
    };
  }

  const [project, tasks] = await Promise.all([
    getTelegramProject(supabase, context.projectId),
    listProjectTasks(supabase, context.projectId),
  ]);
  if (command === "start") return projectHomeResponse(project, tasks);
  if (command === "help") {
    return { text: helpMessage(), replyMarkup: projectHomeMenu(project) };
  }
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
  const label = projectEventLabel(candidate.eventType);
  const lines = ["🤖 I detected a project event.", "", `📌 ${candidate.summary}`];
  if (candidate.dueLabel) {
    lines.push(`📅 ${candidate.dueLabel}`);
  }
  if (duplicate) lines.push("", duplicate);
  lines.push(
    "",
    `Why: I interpreted the message as ${articleFor(label)} ${label}.`,
    "Is this correct?",
  );
  return lines.join("\n");
}

function articleFor(value: string) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
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

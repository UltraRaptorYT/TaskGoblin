import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProjectDetectionContext,
  ProjectEventDetectionResult,
  ValidatedProjectEvent,
} from "@/lib/project-event-detection";
import type { ProjectEventType } from "@/lib/project-event-schemas";
import type { CandidateCallbackAction } from "@/lib/telegram-callbacks";
import type { TelegramDocumentExtraction } from "@/lib/telegram-document";
import type { DeterministicTaskCandidate } from "@/lib/task-candidates";
import type {
  TelegramActor,
  TelegramChat,
  TelegramInboundDocument,
  TelegramInboundMessage,
  TelegramInboundUpdate,
} from "@/lib/taskgoblin-types";

export type TelegramContext = {
  chatRecordId: string | null;
  userRecordId: string | null;
  projectId: string | null;
  displayName: string | null;
};

export type PersistedTelegramMessage = { id: string };
export type PersistedTaskCandidate = { id: string; title: string };

export type TelegramPrivateReplyContext = {
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
};

export type AgentTaskCandidateInput = {
  title: string;
  description: string | null;
  ownerTelegramUserRecordId: string | null;
  dueLabel: string | null;
  dueAt: string | null;
  confidence: number;
};

export type PersistedTaskCandidateBatch = {
  batchId: string;
  candidates: PersistedTaskCandidate[];
};

export type CandidateReviewResult = {
  candidateId: string;
  state: "confirmed" | "edited" | "ignored";
  taskId: string | null;
  title: string;
};

export type CandidateBatchReviewResult = {
  batchId: string;
  state: "confirmed" | "ignored";
  taskIds: string[];
  titles: string[];
};

export type PersistedProjectNameCandidate = {
  id: string;
  proposedName: string;
};

export type ProjectNameCandidateReviewResult = {
  candidateId: string;
  state: "confirmed" | "ignored";
  projectName: string;
};

export type ProjectEventCandidateReviewResult = {
  candidateId: string;
  state: "confirmed" | "edited" | "ignored";
  taskId: string | null;
  eventType: ProjectEventType;
  summary: string;
  reminderScheduledFor: string | null;
};

export type PersistedBulkAssignmentCandidate = {
  id: string;
  targetOwnerDisplayName: string;
  taskCount: number;
};

export type BulkAssignmentReviewResult = {
  candidateId: string;
  state: "confirmed" | "ignored";
  targetOwnerDisplayName: string;
  assignedTaskCount: number;
};

export type UndoTaskMutationResult = {
  transactionId: number;
  affectedTaskCount: number;
  description: string;
};

export type TelegramProjectMemberOption = {
  telegramUserRecordId: string;
  displayName: string;
};

export type TelegramEditTargetKind = "task" | "project_event_candidate";

export type TelegramEditSession = {
  id: string;
  targetKind: TelegramEditTargetKind;
  targetId: string;
  fieldName: "title" | "owner";
  options: TelegramProjectMemberOption[];
};

export type TelegramTitleEditResult = {
  targetKind: TelegramEditTargetKind;
  targetId: string;
  title: string;
  cancelled: boolean;
};

export type ProjectSummaryKnowledge = {
  documentNames: string[];
  recentEvents: Array<{ eventType: string; title: string }>;
};

export type AiDetectionRun = {
  id: string;
};

export type PersistedProjectEventCandidate = {
  id: string;
  eventType: ProjectEventType;
  summary: string;
  confidence: number;
  matchedTaskId: string | null;
  duplicateOfTaskId: string | null;
  duplicateOfCandidateId: string | null;
  dueLabel: string | null;
};

export type TelegramTaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source_participant_name: string | null;
  due_label: string | null;
  due_at: string | null;
  blocked_by: string | null;
  owner_telegram_user_id: string | null;
  updated_at: string;
};

export type TelegramProjectRow = {
  id: string;
  name: string;
  description: string | null;
  health_score: number;
  health_label: string;
  timezone: string;
};

export type TelegramUserTaskRow = TelegramTaskRow & {
  project_name: string;
};

export async function claimTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramInboundUpdate,
) {
  const { data, error } = await supabase.rpc("taskgoblin_claim_telegram_update", {
    p_update_id: update.updateId,
    p_update_type: update.updateType,
    p_raw_json: update.raw,
  });
  if (error) throw new Error(`Could not claim Telegram update: ${error.message}`);
  return data === true;
}

export async function ensureTelegramContext(
  supabase: SupabaseClient,
  update: TelegramInboundUpdate,
): Promise<TelegramContext> {
  const actor = update.actor;
  const chat = update.chat;
  const userRecord = actor ? await upsertTelegramUser(supabase, actor) : null;
  let chatRecord = chat ? await upsertTelegramChat(supabase, chat) : null;

  if (
    chatRecord &&
    !chatRecord.project_id &&
    (chat?.type === "group" ||
      chat?.type === "supergroup" ||
      chat?.type === "channel")
  ) {
    chatRecord = await provisionChatProject(supabase, chat, chatRecord.id);
  }

  if (chatRecord?.project_id && userRecord && actor) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("taskgoblin_project_members")
      .upsert(
        {
          project_id: chatRecord.project_id,
          telegram_user_id: userRecord.id,
          display_name: displayName(actor),
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "project_id,telegram_user_id" },
      );
    if (error) throw new Error(`Could not persist Telegram member: ${error.message}`);
  }

  const { error: updateError } = await supabase
    .from("taskgoblin_telegram_updates")
    .update({
      telegram_chat_record_id: chatRecord?.id ?? null,
      telegram_user_record_id: userRecord?.id ?? null,
    })
    .eq("update_id", update.updateId);
  if (updateError) {
    throw new Error(`Could not attach Telegram update context: ${updateError.message}`);
  }

  return {
    chatRecordId: chatRecord?.id ?? null,
    userRecordId: userRecord?.id ?? null,
    projectId: chatRecord?.project_id ?? null,
    displayName: actor ? displayName(actor) : null,
  };
}

export async function persistTelegramMessage(
  supabase: SupabaseClient,
  message: TelegramInboundMessage,
  context: TelegramContext,
): Promise<PersistedTelegramMessage> {
  if (!context.chatRecordId) {
    throw new Error("Cannot persist a Telegram message without a chat record.");
  }

  const { data, error } = await supabase
    .from("taskgoblin_telegram_messages")
    .upsert(
      {
        import_id: null,
        project_id: context.projectId,
        telegram_chat_record_id: context.chatRecordId,
        telegram_user_record_id: context.userRecordId,
        telegram_update_id: message.updateId,
        telegram_message_id: message.messageId,
        message_type: message.updateType,
        sent_at: message.sentAt,
        edited_at: message.editedAt,
        sender_name: context.displayName,
        sender_telegram_id: message.actor ? String(message.actor.id) : null,
        plain_text: message.text,
        reply_to_telegram_message_id: message.replyToMessageId,
        message_thread_id: message.messageThreadId,
        raw_json: message.raw,
      },
      { onConflict: "telegram_chat_record_id,telegram_message_id" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not persist Telegram message: ${error?.message ?? "Unknown error"}`);
  }
  return { id: data.id as string };
}

export async function updatePersistedTelegramMessageText(
  supabase: SupabaseClient,
  sourceMessage: PersistedTelegramMessage,
  plainText: string,
) {
  const { error } = await supabase
    .from("taskgoblin_telegram_messages")
    .update({ plain_text: plainText })
    .eq("id", sourceMessage.id);
  if (error) {
    throw new Error(`Could not update Telegram message text: ${error.message}`);
  }
}

export async function linkPersistedTelegramMessageToProject(
  supabase: SupabaseClient,
  sourceMessage: PersistedTelegramMessage,
  projectId: string,
) {
  const { error } = await supabase
    .from("taskgoblin_telegram_messages")
    .update({ project_id: projectId })
    .eq("id", sourceMessage.id);
  if (error) {
    throw new Error(
      `Could not link private Telegram reply to its project: ${error.message}`,
    );
  }
}

export async function resolvePrivateReminderReplyContext(
  supabase: SupabaseClient,
  telegramUserRecordId: string,
  telegramChatId: number,
  replyToTelegramMessageId: number,
): Promise<TelegramPrivateReplyContext | null> {
  const { data: delivery, error: deliveryError } = await supabase
    .from("taskgoblin_notification_deliveries")
    .select("reminder_id")
    .eq("channel", "telegram")
    .eq("status", "sent")
    .eq("recipient_telegram_chat_id", telegramChatId)
    .eq("provider_message_id", String(replyToTelegramMessageId))
    .not("reminder_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deliveryError) {
    throw new Error(
      `Could not resolve Telegram reminder delivery: ${deliveryError.message}`,
    );
  }
  if (!delivery?.reminder_id) return null;
  return resolvePrivateReminderContext(
    supabase,
    telegramUserRecordId,
    delivery.reminder_id as string,
  );
}

export async function resolveRecentPrivateReminderContext(
  supabase: SupabaseClient,
  telegramUserRecordId: string,
  telegramChatId: number,
  inboundSentAt: string | null,
  maxAgeMinutes = 30,
): Promise<TelegramPrivateReplyContext | null> {
  const receivedAt = inboundSentAt ? new Date(inboundSentAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) return null;
  const { data: delivery, error } = await supabase
    .from("taskgoblin_notification_deliveries")
    .select("reminder_id")
    .eq("channel", "telegram")
    .eq("status", "sent")
    .eq("recipient_telegram_chat_id", telegramChatId)
    .not("reminder_id", "is", null)
    .lte("created_at", receivedAt.toISOString())
    .gte(
      "created_at",
      new Date(
        receivedAt.getTime() - Math.max(maxAgeMinutes, 1) * 60_000,
      ).toISOString(),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not resolve recent Telegram reminder: ${error.message}`,
    );
  }
  if (!delivery?.reminder_id) return null;
  return resolvePrivateReminderContext(
    supabase,
    telegramUserRecordId,
    delivery.reminder_id as string,
  );
}

async function resolvePrivateReminderContext(
  supabase: SupabaseClient,
  telegramUserRecordId: string,
  reminderId: string,
): Promise<TelegramPrivateReplyContext | null> {
  const { data: reminder, error: reminderError } = await supabase
    .from("taskgoblin_reminders")
    .select("task_id")
    .eq("id", reminderId)
    .maybeSingle();
  if (reminderError) {
    throw new Error(
      `Could not resolve Telegram reminder task: ${reminderError.message}`,
    );
  }
  if (!reminder?.task_id) return null;

  const { data: task, error: taskError } = await supabase
    .from("taskgoblin_tasks")
    .select("id, project_id, title")
    .eq("id", reminder.task_id)
    .eq("owner_telegram_user_id", telegramUserRecordId)
    .maybeSingle();
  if (taskError) {
    throw new Error(
      `Could not resolve Telegram reminder owner: ${taskError.message}`,
    );
  }
  if (!task?.project_id) return null;

  const { data: project, error: projectError } = await supabase
    .from("taskgoblin_projects")
    .select("name")
    .eq("id", task.project_id)
    .maybeSingle();
  if (projectError) {
    throw new Error(
      `Could not resolve Telegram reminder project: ${projectError.message}`,
    );
  }
  if (!project) return null;

  return {
    projectId: task.project_id as string,
    projectName: project.name as string,
    taskId: task.id as string,
    taskTitle: task.title as string,
  };
}

export async function persistTelegramProjectDocument(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  document: TelegramInboundDocument,
  result:
    | { extraction: TelegramDocumentExtraction; error?: never }
    | { extraction?: never; error: string },
) {
  if (!context.projectId) {
    throw new Error("Cannot persist a document without a Telegram project.");
  }
  const extraction = result.extraction;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("taskgoblin_project_documents")
    .upsert(
      {
        project_id: context.projectId,
        source_telegram_message_id: sourceMessage.id,
        telegram_file_id: document.fileId,
        telegram_file_unique_id: document.fileUniqueId,
        filename:
          extraction?.filename ??
          document.fileName ??
          `document-${document.fileUniqueId}`,
        mime_type: document.mimeType,
        file_size: document.fileSize,
        parse_status: extraction ? "processed" : "failed",
        extracted_text: extraction?.text ?? "",
        was_truncated: extraction?.wasTruncated ?? false,
        error_message: result.error ?? null,
        updated_at: now,
      },
      { onConflict: "source_telegram_message_id" },
    );
  if (error) {
    throw new Error(`Could not persist Telegram document: ${error.message}`);
  }
}

export async function createTaskCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  candidate: DeterministicTaskCandidate,
): Promise<PersistedTaskCandidate> {
  if (!context.projectId) {
    throw new Error("Cannot create a task candidate without a project.");
  }

  const { data, error } = await supabase
    .from("taskgoblin_task_candidates")
    .upsert(
      {
        project_id: context.projectId,
        source_telegram_message_id: sourceMessage.id,
        dedupe_key: sourceMessage.id,
        proposed_title: candidate.title,
        proposed_owner_telegram_user_id: candidate.assignToSender
          ? context.userRecordId
          : null,
        confidence: candidate.confidence,
        detection_source: "deterministic",
        state: "detected",
      },
      {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      },
    )
    .select("id, proposed_title")
    .maybeSingle();
  if (error) throw new Error(`Could not persist task candidate: ${error.message}`);

  if (data) {
    return { id: data.id as string, title: data.proposed_title as string };
  }

  const { data: existing, error: existingError } = await supabase
    .from("taskgoblin_task_candidates")
    .select("id, proposed_title")
    .eq("dedupe_key", sourceMessage.id)
    .single();
  if (existingError || !existing) {
    throw new Error(
      `Could not load task candidate: ${existingError?.message ?? "Unknown error"}`,
    );
  }
  return {
    id: existing.id as string,
    title: existing.proposed_title as string,
  };
}

export async function createAgentTaskCandidateBatch(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  proposals: AgentTaskCandidateInput[],
): Promise<PersistedTaskCandidateBatch> {
  if (!context.projectId) {
    throw new Error("Cannot create an agent task batch without a project.");
  }
  if (proposals.length < 1 || proposals.length > 8) {
    throw new Error("An agent task batch must contain between 1 and 8 tasks.");
  }

  const batchId = sourceMessage.id;
  const { error } = await supabase
    .from("taskgoblin_task_candidates")
    .upsert(
      proposals.map((proposal, index) => ({
        project_id: context.projectId,
        source_telegram_message_id: sourceMessage.id,
        agent_batch_id: batchId,
        proposal_index: index + 1,
        dedupe_key: `${batchId}:agent:${index + 1}`,
        proposed_title: proposal.title,
        proposed_description: proposal.description,
        proposed_owner_telegram_user_id:
          proposal.ownerTelegramUserRecordId,
        proposed_due_label: proposal.dueLabel,
        proposed_due_at: proposal.dueAt,
        confidence: proposal.confidence,
        detection_source: "ai",
        state: "detected",
      })),
      {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      },
    )
  if (error) {
    throw new Error(
      `Could not persist agent task candidates: ${error.message}`,
    );
  }

  const { data, error: loadError } = await supabase
    .from("taskgoblin_task_candidates")
    .select("id, proposed_title, proposal_index")
    .eq("agent_batch_id", batchId)
    .order("proposal_index");
  if (loadError || !data || data.length < 1) {
    throw new Error(
      `Could not load agent task candidates: ${loadError?.message ?? "Empty batch"}`,
    );
  }

  return {
    batchId,
    candidates: data.map((row) => ({
      id: row.id as string,
      title: row.proposed_title as string,
    })),
  };
}

export async function queueAgentTaskCandidateBatch(
  supabase: SupabaseClient,
  context: TelegramContext,
  batchId: string,
) {
  if (!context.projectId) throw new Error("Task candidate batch has no project.");
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_task_candidate_batch",
    {
      p_batch_id: batchId,
      p_project_id: context.projectId,
      p_action: "queue",
      p_reviewer_telegram_user_id: null,
    },
  );
  if (error || !Array.isArray(data) || data.length < 1) {
    throw new Error(
      `Could not queue task candidate batch: ${error?.message ?? "Unknown error"}`,
    );
  }
}

export async function createProjectNameCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  input: {
    originalName: string;
    proposedName: string;
    evidence: string;
    confidence: number;
  },
): Promise<PersistedProjectNameCandidate> {
  if (!context.projectId) {
    throw new Error("Cannot suggest a project name without a project.");
  }
  const { data, error } = await supabase
    .from("taskgoblin_project_name_candidates")
    .upsert(
      {
        project_id: context.projectId,
        source_telegram_message_id: sourceMessage.id,
        original_name: input.originalName,
        proposed_name: input.proposedName,
        evidence: input.evidence,
        confidence: input.confidence,
        state: "detected",
      },
      {
        onConflict: "source_telegram_message_id,proposed_name",
        ignoreDuplicates: true,
      },
    )
    .select("id, proposed_name")
    .maybeSingle();
  if (error) {
    throw new Error(`Could not persist project name candidate: ${error.message}`);
  }

  let row = data;
  if (!row) {
    const { data: existing, error: existingError } = await supabase
      .from("taskgoblin_project_name_candidates")
      .select("id, proposed_name")
      .eq("source_telegram_message_id", sourceMessage.id)
      .eq("proposed_name", input.proposedName)
      .single();
    if (existingError || !existing) {
      throw new Error(
        `Could not load project name candidate: ${existingError?.message ?? "Unknown error"}`,
      );
    }
    row = existing;
  }
  return {
    id: row.id as string,
    proposedName: row.proposed_name as string,
  };
}

export async function queueProjectNameCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
) {
  if (!context.projectId) {
    throw new Error("Project name candidate has no project.");
  }
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_project_name_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: "queue",
      p_reviewer_telegram_user_id: null,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(
      `Could not queue project name candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
}

export async function loadProjectDetectionContext(
  supabase: SupabaseClient,
  projectId: string,
  window: {
    telegramChatRecordId: string;
    beforeTelegramMessageId: number;
    messageThreadId: number | null;
    sentAt: string | null;
    recentMessageLimit?: number;
    maxLookbackMinutes?: number | null;
  },
): Promise<ProjectDetectionContext> {
  const recentMessageLimit = Math.min(
    Math.max(window.recentMessageLimit ?? 12, 1),
    50,
  );
  const maxLookbackMinutes =
    window.maxLookbackMinutes === undefined ? 30 : window.maxLookbackMinutes;
  let recentMessagesQuery = supabase
    .from("taskgoblin_telegram_messages")
    .select(
      "telegram_message_id, telegram_user_record_id, sent_at, plain_text, reply_to_telegram_message_id",
    )
    .eq("project_id", projectId)
    .eq("telegram_chat_record_id", window.telegramChatRecordId)
    .lt("telegram_message_id", window.beforeTelegramMessageId)
    .in("message_type", ["message", "edited_message"])
    .neq("plain_text", "")
    .order("telegram_message_id", { ascending: false })
    .limit(recentMessageLimit);
  recentMessagesQuery =
    window.messageThreadId === null
      ? recentMessagesQuery.is("message_thread_id", null)
      : recentMessagesQuery.eq("message_thread_id", window.messageThreadId);
  if (window.sentAt && maxLookbackMinutes !== null) {
    const sentAt = new Date(window.sentAt);
    if (!Number.isNaN(sentAt.getTime())) {
      recentMessagesQuery = recentMessagesQuery.gte(
        "sent_at",
        new Date(
          sentAt.getTime() - Math.max(maxLookbackMinutes, 0) * 60 * 1000,
        ).toISOString(),
      );
    }
  }

  const [
    { data: project, error: projectError },
    { data: memberRows, error: memberError },
    { data: taskRows, error: taskError },
    { data: candidateRows, error: candidateError },
    { data: recentMessageRows, error: recentMessageError },
    { data: documentRows, error: documentError },
  ] = await Promise.all([
    supabase
      .from("taskgoblin_projects")
      .select("timezone")
      .eq("id", projectId)
      .single(),
    supabase
      .from("taskgoblin_project_members")
      .select("telegram_user_id, display_name")
      .eq("project_id", projectId)
      .limit(200),
    supabase
      .from("taskgoblin_tasks")
      .select("id, title, status, owner_telegram_user_id, due_label")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("taskgoblin_project_event_candidates")
      .select("id, event_type, summary")
      .eq("project_id", projectId)
      .in("state", ["detected", "awaiting_confirmation", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(50),
    recentMessagesQuery,
    supabase
      .from("taskgoblin_project_documents")
      .select("filename, extracted_text, created_at")
      .eq("project_id", projectId)
      .eq("parse_status", "processed")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (projectError || !project) {
    throw new Error(
      `Could not load project detection settings: ${projectError?.message ?? "Unknown error"}`,
    );
  }
  if (memberError) {
    throw new Error(`Could not load project members: ${memberError.message}`);
  }
  if (taskError) {
    throw new Error(`Could not load project tasks: ${taskError.message}`);
  }
  if (candidateError) {
    throw new Error(
      `Could not load recent project event candidates: ${candidateError.message}`,
    );
  }
  if (recentMessageError) {
    throw new Error(
      `Could not load recent Telegram messages: ${recentMessageError.message}`,
    );
  }
  if (documentError) {
    throw new Error(
      `Could not load project documents: ${documentError.message}`,
    );
  }

  const memberRecordIds = (memberRows ?? []).map(
    (row) => row.telegram_user_id as string,
  );
  let telegramUsers: Array<{
    id: string;
    username: string | null;
  }> = [];
  if (memberRecordIds.length) {
    const { data, error } = await supabase
      .from("taskgoblin_telegram_users")
      .select("id, username")
      .in("id", memberRecordIds);
    if (error) {
      throw new Error(`Could not load Telegram member details: ${error.message}`);
    }
    telegramUsers = (data ?? []) as typeof telegramUsers;
  }
  const usersById = new Map(telegramUsers.map((user) => [user.id, user]));

  return {
    projectId,
    timezone: (project.timezone as string | null) || "UTC",
    members: (memberRows ?? []).map((row) => ({
      telegramUserRecordId: row.telegram_user_id as string,
      username:
        usersById.get(row.telegram_user_id as string)?.username ?? null,
      displayName: row.display_name as string,
    })),
    tasks: (taskRows ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      ownerTelegramUserRecordId:
        (row.owner_telegram_user_id as string | null) ?? null,
      dueLabel: (row.due_label as string | null) ?? null,
    })),
    recentCandidates: (candidateRows ?? []).map((row) => ({
      id: row.id as string,
      eventType: row.event_type as ProjectEventType,
      summary: row.summary as string,
    })),
    documents: (documentRows ?? []).map((row) => ({
      filename: row.filename as string,
      extractedText: (row.extracted_text as string).slice(0, 12_000),
    })),
    recentMessages: (recentMessageRows ?? [])
      .map((row) => {
        const telegramUserRecordId =
          (row.telegram_user_record_id as string | null) ?? null;
        const member = telegramUserRecordId
          ? (memberRows ?? []).find(
              (candidate) =>
                candidate.telegram_user_id === telegramUserRecordId,
            )
          : null;
        return {
          telegramMessageId: Number(row.telegram_message_id),
          sentAt: (row.sent_at as string | null) ?? null,
          senderUsername: telegramUserRecordId
            ? usersById.get(telegramUserRecordId)?.username ?? null
            : null,
          senderDisplayName:
            (member?.display_name as string | undefined) ?? "Unknown",
          text: row.plain_text as string,
          replyToTelegramMessageId:
            (row.reply_to_telegram_message_id as number | null) ?? null,
        };
      })
      .reverse(),
  };
}

export async function startAiDetectionRun(
  supabase: SupabaseClient,
  projectId: string,
  sourceMessage: PersistedTelegramMessage,
  provider: "openai" | "mock",
  model: string,
  promptVersion: string,
): Promise<AiDetectionRun> {
  const { data, error } = await supabase
    .from("taskgoblin_ai_detection_runs")
    .insert({
      project_id: projectId,
      source_telegram_message_id: sourceMessage.id,
      provider,
      model,
      prompt_version: promptVersion,
      status: "running",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `Could not start AI detection run: ${error?.message ?? "Unknown error"}`,
    );
  }
  return { id: data.id as string };
}

export async function completeAiDetectionRun(
  supabase: SupabaseClient,
  runId: string,
  result: ProjectEventDetectionResult,
) {
  const { error } = await supabase
    .from("taskgoblin_ai_detection_runs")
    .update({
      provider: result.provider,
      model: result.model,
      status: "completed",
      structured_output: result.modelOutput,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", runId);
  if (error) {
    throw new Error(`Could not complete AI detection run: ${error.message}`);
  }
}

export async function failAiDetectionRun(
  supabase: SupabaseClient,
  runId: string,
  errorMessage: string,
) {
  await supabase
    .from("taskgoblin_ai_detection_runs")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function createProjectEventCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  detectionRun: AiDetectionRun,
  event: ValidatedProjectEvent,
): Promise<PersistedProjectEventCandidate> {
  if (!context.projectId) {
    throw new Error("Cannot create a project event candidate without a project.");
  }
  const { data, error } = await supabase
    .from("taskgoblin_project_event_candidates")
    .insert({
      project_id: context.projectId,
      ai_detection_run_id: detectionRun.id,
      source_telegram_message_id: sourceMessage.id,
      event_type: event.eventType,
      state: "detected",
      summary: event.summary,
      event_payload: {
        ...event.payload,
        sourceTelegramMessageId: event.sourceTelegramMessageId,
      },
      matched_task_id: event.matchedTaskId,
      proposed_owner_telegram_user_id: event.ownerTelegramUserRecordId,
      proposed_due_label: event.dueLabel,
      proposed_due_at: event.dueAt,
      duplicate_of_task_id: event.duplicateOfTaskId,
      duplicate_of_candidate_id: event.duplicateOfCandidateId,
      confidence: event.confidence,
      rationale: event.rationale,
    })
    .select(
      "id, event_type, summary, confidence, matched_task_id, duplicate_of_task_id, duplicate_of_candidate_id, proposed_due_label",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `Could not persist project event candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
  return {
    id: data.id as string,
    eventType: data.event_type as ProjectEventType,
    summary: data.summary as string,
    confidence: Number(data.confidence),
    matchedTaskId: (data.matched_task_id as string | null) ?? null,
    duplicateOfTaskId:
      (data.duplicate_of_task_id as string | null) ?? null,
    duplicateOfCandidateId:
      (data.duplicate_of_candidate_id as string | null) ?? null,
    dueLabel: (data.proposed_due_label as string | null) ?? null,
  };
}

export async function findProjectEventCandidateBySource(
  supabase: SupabaseClient,
  sourceMessage: PersistedTelegramMessage,
): Promise<PersistedProjectEventCandidate | null> {
  const { data, error } = await supabase
    .from("taskgoblin_project_event_candidates")
    .select(
      "id, event_type, summary, confidence, matched_task_id, duplicate_of_task_id, duplicate_of_candidate_id, proposed_due_label",
    )
    .eq("source_telegram_message_id", sourceMessage.id)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not load existing project event candidate: ${error.message}`,
    );
  }
  if (!data) return null;
  return {
    id: data.id as string,
    eventType: data.event_type as ProjectEventType,
    summary: data.summary as string,
    confidence: Number(data.confidence),
    matchedTaskId: (data.matched_task_id as string | null) ?? null,
    duplicateOfTaskId:
      (data.duplicate_of_task_id as string | null) ?? null,
    duplicateOfCandidateId:
      (data.duplicate_of_candidate_id as string | null) ?? null,
    dueLabel: (data.proposed_due_label as string | null) ?? null,
  };
}

export async function queueProjectEventCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
) {
  if (!context.projectId) {
    throw new Error("Project event candidate has no project.");
  }
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_project_event_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: "queue",
      p_reviewer_telegram_user_id: null,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(
      `Could not queue project event candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
}

export async function reviewProjectEventCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
  action: CandidateCallbackAction,
): Promise<ProjectEventCandidateReviewResult> {
  if (!context.projectId) {
    throw new Error("Project event candidate has no project.");
  }
  let rpcName = "taskgoblin_transition_project_event_candidate";
  let rpcArguments: Record<string, string | null> = {
    p_candidate_id: candidateId,
    p_project_id: context.projectId,
    p_action: action,
    p_reviewer_telegram_user_id: context.userRecordId,
  };
  if (action === "confirm" && context.userRecordId) {
    const { data: candidate, error: candidateError } = await supabase
      .from("taskgoblin_project_event_candidates")
      .select("event_type")
      .eq("id", candidateId)
      .eq("project_id", context.projectId)
      .single();
    if (candidateError || !candidate) {
      throw new Error(
        `Could not load project event candidate: ${candidateError?.message ?? "Unknown error"}`,
      );
    }
    if (candidate.event_type === "possible_task_completion") {
      rpcName = "taskgoblin_confirm_completion_candidate";
      rpcArguments = {
        p_candidate_id: candidateId,
        p_project_id: context.projectId,
        p_reviewer_telegram_user_id: context.userRecordId,
      };
    }
  }
  const { data, error } = await supabase.rpc(rpcName, rpcArguments);
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(
      `Could not review project event candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
  const row = data[0] as {
    candidate_id: string;
    candidate_state: ProjectEventCandidateReviewResult["state"];
    task_id: string | null;
    event_type: ProjectEventType;
    summary: string;
  };
  let reminderScheduledFor: string | null = null;
  if (row.candidate_state === "confirmed" && row.task_id) {
    const { data: reminder, error: reminderError } = await supabase
      .from("taskgoblin_reminders")
      .select("scheduled_for")
      .eq("task_id", row.task_id)
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (reminderError) {
      throw new Error(
        `Could not load the scheduled task reminder: ${reminderError.message}`,
      );
    }
    reminderScheduledFor =
      (reminder?.scheduled_for as string | null | undefined) ?? null;
  }
  return {
    candidateId: row.candidate_id,
    state: row.candidate_state,
    taskId: row.task_id,
    eventType: row.event_type,
    summary: row.summary,
    reminderScheduledFor,
  };
}

export async function undoLastTaskMutation(
  supabase: SupabaseClient,
  context: TelegramContext,
): Promise<UndoTaskMutationResult | null> {
  if (!context.projectId || !context.userRecordId) {
    throw new Error("Undo needs a linked TaskGoblin project member.");
  }
  const { data, error } = await supabase.rpc(
    "taskgoblin_undo_last_task_mutation",
    {
      p_project_id: context.projectId,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
  if (error) throw new Error(`Could not undo task change: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as {
    transaction_id: number | string;
    affected_task_count: number | string;
    description: string;
  };
  return {
    transactionId: Number(row.transaction_id),
    affectedTaskCount: Number(row.affected_task_count),
    description: row.description,
  };
}

export async function queueTaskCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
) {
  if (!context.projectId) throw new Error("Task candidate has no project.");
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_task_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: "queue",
      p_reviewer_telegram_user_id: null,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(`Could not queue task candidate: ${error?.message ?? "Unknown error"}`);
  }
}

export async function reviewTaskCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
  action: CandidateCallbackAction,
): Promise<CandidateReviewResult> {
  if (!context.projectId) throw new Error("Task candidate has no project.");
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_task_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: action,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(`Could not review task candidate: ${error?.message ?? "Unknown error"}`);
  }
  const row = data[0] as {
    candidate_id: string;
    candidate_state: CandidateReviewResult["state"];
    task_id: string | null;
    title: string;
  };
  return {
    candidateId: row.candidate_id,
    state: row.candidate_state,
    taskId: row.task_id,
    title: row.title,
  };
}

export async function reviewAgentTaskCandidateBatch(
  supabase: SupabaseClient,
  context: TelegramContext,
  batchId: string,
  action: "confirm" | "ignore",
): Promise<CandidateBatchReviewResult> {
  if (!context.projectId) throw new Error("Task candidate batch has no project.");
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_task_candidate_batch",
    {
      p_batch_id: batchId,
      p_project_id: context.projectId,
      p_action: action,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
  if (error || !Array.isArray(data) || data.length < 1) {
    throw new Error(
      `Could not review task candidate batch: ${error?.message ?? "Unknown error"}`,
    );
  }
  const rows = data as Array<{
    candidate_state: "confirmed" | "ignored";
    task_id: string | null;
    title: string;
  }>;
  return {
    batchId,
    state: rows[0].candidate_state,
    taskIds: rows.flatMap((row) => (row.task_id ? [row.task_id] : [])),
    titles: rows.map((row) => row.title),
  };
}

export async function reviewProjectNameCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
  action: "confirm" | "ignore",
): Promise<ProjectNameCandidateReviewResult> {
  if (!context.projectId) {
    throw new Error("Project name candidate has no project.");
  }
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_project_name_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: action,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(
      `Could not review project name candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
  const row = data[0] as {
    candidate_id: string;
    candidate_state: "confirmed" | "ignored";
    project_name: string;
  };
  return {
    candidateId: row.candidate_id,
    state: row.candidate_state,
    projectName: row.project_name,
  };
}

export async function listProjectTasks(
  supabase: SupabaseClient,
  projectId: string,
): Promise<TelegramTaskRow[]> {
  const { data, error } = await supabase
    .from("taskgoblin_tasks")
    .select(
      "id, project_id, title, description, status, priority, source_participant_name, due_label, due_at, blocked_by, owner_telegram_user_id, updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load project tasks: ${error.message}`);
  return (data ?? []) as TelegramTaskRow[];
}

export async function loadProjectSummaryKnowledge(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectSummaryKnowledge> {
  const [
    { data: documents, error: documentError },
    { data: events, error: eventError },
  ] = await Promise.all([
    supabase
      .from("taskgoblin_project_documents")
      .select("filename")
      .eq("project_id", projectId)
      .eq("parse_status", "processed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("taskgoblin_project_events")
      .select("event_type, title")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (documentError) {
    throw new Error(`Could not load project documents: ${documentError.message}`);
  }
  if (eventError) {
    throw new Error(`Could not load project memory: ${eventError.message}`);
  }
  return {
    documentNames: (documents ?? []).map((row) => row.filename as string),
    recentEvents: (events ?? []).map((row) => ({
      eventType: row.event_type as string,
      title: row.title as string,
    })),
  };
}

export async function findProjectMemberByUsername(
  supabase: SupabaseClient,
  projectId: string,
  username: string,
): Promise<{ telegramUserRecordId: string; displayName: string } | null> {
  const normalized = username.replace(/^@/, "").trim();
  if (!/^[a-z0-9_]{5,32}$/i.test(normalized)) return null;
  const { data: user, error: userError } = await supabase
    .from("taskgoblin_telegram_users")
    .select("id")
    .ilike("username", normalized)
    .maybeSingle();
  if (userError) {
    throw new Error(`Could not resolve Telegram username: ${userError.message}`);
  }
  if (!user) return null;
  return getProjectMemberOwner(supabase, projectId, user.id as string);
}

export async function getProjectMemberOwner(
  supabase: SupabaseClient,
  projectId: string,
  telegramUserRecordId: string,
): Promise<{ telegramUserRecordId: string; displayName: string } | null> {
  const { data, error } = await supabase
    .from("taskgoblin_project_members")
    .select("telegram_user_id, display_name")
    .eq("project_id", projectId)
    .eq("telegram_user_id", telegramUserRecordId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load project member: ${error.message}`);
  }
  if (!data) return null;
  return {
    telegramUserRecordId: data.telegram_user_id as string,
    displayName: (data.display_name as string | null)?.trim() || "this member",
  };
}

export async function createBulkAssignmentCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  owner: { telegramUserRecordId: string; displayName: string },
): Promise<PersistedBulkAssignmentCandidate> {
  if (!context.projectId) {
    throw new Error("Cannot assign tasks without a project.");
  }
  const { data: tasks, error: taskError } = await supabase
    .from("taskgoblin_tasks")
    .select("id")
    .eq("project_id", context.projectId)
    .neq("status", "done")
    .order("created_at", { ascending: true })
    .limit(200);
  if (taskError) {
    throw new Error(`Could not load active tasks: ${taskError.message}`);
  }
  const taskIds = (tasks ?? []).map((task) => task.id as string);
  if (!taskIds.length) {
    throw new Error("This project has no active confirmed tasks to assign.");
  }

  const { data, error } = await supabase
    .from("taskgoblin_bulk_assignment_candidates")
    .insert({
      project_id: context.projectId,
      source_telegram_message_id: sourceMessage.id,
      target_owner_telegram_user_id: owner.telegramUserRecordId,
      target_owner_display_name: owner.displayName,
      task_ids: taskIds,
      state: "detected",
    })
    .select("id, target_owner_display_name, task_ids")
    .single();
  if (error || !data) {
    throw new Error(
      `Could not create bulk assignment candidate: ${error?.message ?? "Unknown error"}`,
    );
  }
  const candidate = {
    id: data.id as string,
    targetOwnerDisplayName: data.target_owner_display_name as string,
    taskCount: (data.task_ids as string[]).length,
  };
  const { error: queueError } = await supabase.rpc(
    "taskgoblin_transition_bulk_assignment_candidate",
    {
      p_candidate_id: candidate.id,
      p_project_id: context.projectId,
      p_action: "queue",
      p_reviewer_telegram_user_id: null,
    },
  );
  if (queueError) {
    throw new Error(
      `Could not queue bulk assignment candidate: ${queueError.message}`,
    );
  }
  return candidate;
}

export async function reviewBulkAssignmentCandidate(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
  action: "confirm" | "ignore",
): Promise<BulkAssignmentReviewResult> {
  if (!context.projectId) {
    throw new Error("Bulk assignment candidate has no project.");
  }
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_bulk_assignment_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: action,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(
      `Could not review bulk assignment: ${error?.message ?? "Unknown error"}`,
    );
  }
  const row = data[0] as {
    candidate_id: string;
    candidate_state: "confirmed" | "ignored";
    target_owner_display_name: string;
    assigned_task_count: number;
  };
  return {
    candidateId: row.candidate_id,
    state: row.candidate_state,
    targetOwnerDisplayName: row.target_owner_display_name,
    assignedTaskCount: Number(row.assigned_task_count),
  };
}

export async function getTelegramProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<TelegramProjectRow> {
  const { data, error } = await supabase
    .from("taskgoblin_projects")
    .select("id, name, description, health_score, health_label, timezone")
    .eq("id", projectId)
    .single();
  if (error || !data) {
    throw new Error(
      `Could not load Telegram project: ${error?.message ?? "Unknown error"}`,
    );
  }
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string | null) ?? null,
    health_score: Number(data.health_score),
    health_label: data.health_label as string,
    timezone: (data.timezone as string | null) ?? "UTC",
  };
}

export async function listTelegramUserTasks(
  supabase: SupabaseClient,
  telegramUserRecordId: string,
): Promise<TelegramUserTaskRow[]> {
  const { data: taskRows, error: taskError } = await supabase
    .from("taskgoblin_tasks")
    .select(
      "id, project_id, title, description, status, priority, source_participant_name, due_label, due_at, blocked_by, owner_telegram_user_id, updated_at",
    )
    .eq("owner_telegram_user_id", telegramUserRecordId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (taskError) {
    throw new Error(`Could not load Telegram user tasks: ${taskError.message}`);
  }

  const projectIds = [
    ...new Set((taskRows ?? []).map((row) => row.project_id as string)),
  ];
  if (!projectIds.length) return [];

  const { data: projectRows, error: projectError } = await supabase
    .from("taskgoblin_projects")
    .select("id, name")
    .in("id", projectIds);
  if (projectError) {
    throw new Error(
      `Could not load Telegram user task projects: ${projectError.message}`,
    );
  }
  const projectNames = new Map(
    (projectRows ?? []).map((row) => [
      row.id as string,
      row.name as string,
    ]),
  );

  return (taskRows ?? []).map((row) => ({
    ...(row as TelegramTaskRow),
    project_name:
      projectNames.get(row.project_id as string) ?? "Unknown project",
  }));
}

export async function getTaskForTelegramContext(
  supabase: SupabaseClient,
  context: TelegramContext,
  taskId: string,
): Promise<TelegramUserTaskRow | null> {
  if (!context.projectId && !context.userRecordId) return null;

  let query = supabase
    .from("taskgoblin_tasks")
    .select(
      "id, project_id, title, description, status, priority, source_participant_name, due_label, due_at, blocked_by, owner_telegram_user_id, updated_at",
    )
    .eq("id", taskId);
  query = context.projectId
    ? query.eq("project_id", context.projectId)
    : query.eq("owner_telegram_user_id", context.userRecordId!);

  const { data: task, error: taskError } = await query.maybeSingle();
  if (taskError) {
    throw new Error(`Could not load Telegram task: ${taskError.message}`);
  }
  if (!task) return null;

  const { data: project, error: projectError } = await supabase
    .from("taskgoblin_projects")
    .select("name")
    .eq("id", task.project_id)
    .single();
  if (projectError || !project) {
    throw new Error(
      `Could not load Telegram task project: ${projectError?.message ?? "Unknown error"}`,
    );
  }
  return {
    ...(task as TelegramTaskRow),
    project_name: project.name as string,
  };
}

export async function updateTaskStatusFromTelegram(
  supabase: SupabaseClient,
  context: TelegramContext,
  task: TelegramUserTaskRow,
  status: "done" | "todo",
): Promise<TelegramUserTaskRow> {
  if (!context.userRecordId) {
    throw new Error("Task updates need a linked Telegram member.");
  }
  const patch =
    status === "done"
      ? {
          status,
          blocked_by: null,
          owner_telegram_user_id: context.userRecordId,
          source_participant_name:
            context.displayName?.trim() || task.source_participant_name,
          updated_at: new Date().toISOString(),
        }
      : {
          status,
          blocked_by: null,
          updated_at: new Date().toISOString(),
        };
  let query = supabase
    .from("taskgoblin_tasks")
    .update(patch)
    .eq("id", task.id)
    .eq("project_id", task.project_id);
  if (!context.projectId) {
    query = query.eq("owner_telegram_user_id", context.userRecordId);
  }
  const { error } = await query;
  if (error) throw new Error(`Could not update task status: ${error.message}`);
  const refreshed = await getTaskForTelegramContext(supabase, context, task.id);
  if (!refreshed) throw new Error("Updated task is no longer available.");
  return refreshed;
}

export async function updateTaskDeadlineFromTelegram(
  supabase: SupabaseClient,
  context: TelegramContext,
  task: TelegramUserTaskRow,
  deadline: { dueLabel: string | null; dueAt: string | null },
) {
  if (!context.userRecordId) {
    throw new Error("Deadline updates need a linked Telegram member.");
  }
  let query = supabase
    .from("taskgoblin_tasks")
    .update({
      due_label: deadline.dueLabel,
      due_at: deadline.dueAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("project_id", task.project_id);
  if (!context.projectId) {
    query = query.eq("owner_telegram_user_id", context.userRecordId);
  }
  const { error } = await query;
  if (error) throw new Error(`Could not update task deadline: ${error.message}`);
  return getTaskForTelegramContext(supabase, context, task.id);
}

export async function updateCandidateDeadlineFromTelegram(
  supabase: SupabaseClient,
  context: TelegramContext,
  candidateId: string,
  deadline: { dueLabel: string | null; dueAt: string | null },
) {
  if (!context.projectId || !context.userRecordId) {
    throw new Error("Candidate editing needs a linked project member.");
  }
  const { data, error } = await supabase
    .from("taskgoblin_project_event_candidates")
    .update({
      proposed_due_label: deadline.dueLabel,
      proposed_due_at: deadline.dueAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("project_id", context.projectId)
    .eq("state", "awaiting_confirmation")
    .select("id, summary, proposed_due_label")
    .single();
  if (error || !data) {
    throw new Error(
      `Could not update candidate deadline: ${error?.message ?? "Candidate is no longer editable."}`,
    );
  }
  return {
    id: data.id as string,
    summary: data.summary as string,
    dueLabel: (data.proposed_due_label as string | null) ?? null,
  };
}

export async function startTelegramEditSession(
  supabase: SupabaseClient,
  context: TelegramContext,
  input: {
    targetKind: TelegramEditTargetKind;
    targetId: string;
    fieldName: "title" | "owner";
  },
): Promise<TelegramEditSession> {
  if (!context.projectId || !context.chatRecordId || !context.userRecordId) {
    throw new Error("Inline editing needs a linked project group member.");
  }
  const options =
    input.fieldName === "owner"
      ? await listProjectMemberOptions(supabase, context.projectId)
      : [];
  const { error: closeError } = await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .update({ consumed_at: new Date().toISOString() })
    .eq("telegram_chat_record_id", context.chatRecordId)
    .eq("telegram_user_id", context.userRecordId)
    .is("consumed_at", null);
  if (closeError) {
    throw new Error(`Could not close the previous edit: ${closeError.message}`);
  }
  const { data, error } = await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .insert({
      project_id: context.projectId,
      telegram_chat_record_id: context.chatRecordId,
      telegram_user_id: context.userRecordId,
      target_kind: input.targetKind,
      target_id: input.targetId,
      field_name: input.fieldName,
      payload: { options },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `Could not start inline editing: ${error?.message ?? "Unknown error"}`,
    );
  }
  return {
    id: data.id as string,
    targetKind: input.targetKind,
    targetId: input.targetId,
    fieldName: input.fieldName,
    options,
  };
}

export async function consumeTelegramTitleEdit(
  supabase: SupabaseClient,
  context: TelegramContext,
  text: string,
): Promise<TelegramTitleEditResult | null> {
  if (!context.chatRecordId || !context.userRecordId) return null;
  const { data: session, error } = await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .select("id, project_id, target_kind, target_id")
    .eq("telegram_chat_record_id", context.chatRecordId)
    .eq("telegram_user_id", context.userRecordId)
    .eq("field_name", "title")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load inline edit: ${error.message}`);
  if (!session) return null;

  const cancelled = text.trim().toLowerCase() === "/cancel";
  const title = text.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!cancelled && title.length < 2) {
    throw new Error("The task title must contain at least two characters.");
  }
  if (!cancelled) {
    if (session.target_kind === "task") {
      const { error: updateError } = await supabase
        .from("taskgoblin_tasks")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", session.target_id)
        .eq("project_id", session.project_id);
      if (updateError) {
        throw new Error(`Could not update task title: ${updateError.message}`);
      }
    } else {
      const { error: updateError } = await supabase
        .from("taskgoblin_project_event_candidates")
        .update({ summary: title, updated_at: new Date().toISOString() })
        .eq("id", session.target_id)
        .eq("project_id", session.project_id)
        .eq("state", "awaiting_confirmation");
      if (updateError) {
        throw new Error(`Could not update candidate title: ${updateError.message}`);
      }
    }
  }
  await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("consumed_at", null);
  return {
    targetKind: session.target_kind as TelegramEditTargetKind,
    targetId: session.target_id as string,
    title,
    cancelled,
  };
}

export async function applyTelegramOwnerChoice(
  supabase: SupabaseClient,
  context: TelegramContext,
  sessionId: string,
  optionIndex: number,
) {
  if (!context.chatRecordId || !context.userRecordId) {
    throw new Error("Owner editing needs a linked Telegram member.");
  }
  const { data: session, error } = await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .select("id, project_id, target_kind, target_id, field_name, payload")
    .eq("id", sessionId)
    .eq("telegram_chat_record_id", context.chatRecordId)
    .eq("telegram_user_id", context.userRecordId)
    .eq("field_name", "owner")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error || !session) {
    throw new Error("This owner selection has expired.");
  }
  const options = Array.isArray(session.payload?.options)
    ? (session.payload.options as TelegramProjectMemberOption[])
    : [];
  const owner = options[optionIndex];
  if (!owner) throw new Error("This owner selection is invalid.");
  const currentOwner = await getProjectMemberOwner(
    supabase,
    session.project_id as string,
    owner.telegramUserRecordId,
  );
  if (!currentOwner) throw new Error("That member is no longer in this project.");

  if (session.target_kind === "task") {
    const { error: updateError } = await supabase
      .from("taskgoblin_tasks")
      .update({
        owner_telegram_user_id: currentOwner.telegramUserRecordId,
        source_participant_name: currentOwner.displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.target_id)
      .eq("project_id", session.project_id);
    if (updateError) {
      throw new Error(`Could not change task owner: ${updateError.message}`);
    }
  } else {
    const { error: updateError } = await supabase
      .from("taskgoblin_project_event_candidates")
      .update({
        proposed_owner_telegram_user_id: currentOwner.telegramUserRecordId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.target_id)
      .eq("project_id", session.project_id)
      .eq("state", "awaiting_confirmation");
    if (updateError) {
      throw new Error(`Could not change candidate owner: ${updateError.message}`);
    }
  }
  await supabase
    .from("taskgoblin_telegram_edit_sessions")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("consumed_at", null);
  return {
    targetKind: session.target_kind as TelegramEditTargetKind,
    targetId: session.target_id as string,
    owner: currentOwner,
  };
}

export async function snoozeTaskReminder(
  supabase: SupabaseClient,
  task: TelegramUserTaskRow,
  scheduledFor: string,
) {
  const { error } = await supabase.from("taskgoblin_reminders").insert({
    task_id: task.id,
    channel: "telegram",
    tone: "friendly",
    message: "",
    scheduled_for: scheduledFor,
    status: "scheduled",
  });
  if (error) throw new Error(`Could not snooze reminder: ${error.message}`);
}

export async function listProjectMemberOptions(
  supabase: SupabaseClient,
  projectId: string,
): Promise<TelegramProjectMemberOption[]> {
  const { data, error } = await supabase
    .from("taskgoblin_project_members")
    .select("telegram_user_id, display_name")
    .eq("project_id", projectId)
    .order("display_name", { ascending: true })
    .limit(20);
  if (error) throw new Error(`Could not load project members: ${error.message}`);
  return (data ?? []).map((row) => ({
    telegramUserRecordId: row.telegram_user_id as string,
    displayName: row.display_name as string,
  }));
}

export async function completeTelegramUpdate(
  supabase: SupabaseClient,
  updateId: number,
  status: "processed" | "ignored" = "processed",
) {
  const { error } = await supabase
    .from("taskgoblin_telegram_updates")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("update_id", updateId);
  if (error) throw new Error(`Could not complete Telegram update: ${error.message}`);
}

export async function failTelegramUpdate(
  supabase: SupabaseClient,
  updateId: number,
  errorMessage: string,
) {
  await supabase
    .from("taskgoblin_telegram_updates")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 1000),
    })
    .eq("update_id", updateId);
}

async function upsertTelegramUser(
  supabase: SupabaseClient,
  actor: TelegramActor,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("taskgoblin_telegram_users")
    .upsert(
      {
        telegram_user_id: actor.id,
        username: actor.username,
        first_name: actor.firstName,
        last_name: actor.lastName,
        language_code: actor.languageCode,
        is_bot: actor.isBot,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not persist Telegram user: ${error?.message ?? "Unknown error"}`);
  }
  return { id: data.id as string };
}

async function upsertTelegramChat(
  supabase: SupabaseClient,
  chat: TelegramChat,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("taskgoblin_telegram_chats")
    .upsert(
      {
        telegram_chat_id: chat.id,
        chat_type: chat.type,
        title: chat.title,
        username: chat.username,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "telegram_chat_id" },
    )
    .select("id, project_id")
    .single();
  if (error || !data) {
    throw new Error(`Could not persist Telegram chat: ${error?.message ?? "Unknown error"}`);
  }
  return {
    id: data.id as string,
    project_id: data.project_id as string | null,
  };
}

async function provisionChatProject(
  supabase: SupabaseClient,
  chat: TelegramChat,
  chatRecordId: string,
) {
  const name = chat.title?.trim() || `Telegram ${chat.id}`;
  const { data: workspace, error: workspaceError } = await supabase
    .from("taskgoblin_workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    throw new Error(
      `Could not create Telegram workspace: ${workspaceError?.message ?? "Unknown error"}`,
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("taskgoblin_projects")
    .insert({
      workspace_id: workspace.id,
      name,
      source: "telegram_live",
    })
    .select("id")
    .single();
  if (projectError || !project) {
    throw new Error(
      `Could not create Telegram project: ${projectError?.message ?? "Unknown error"}`,
    );
  }

  const { data: linked, error: linkError } = await supabase
    .from("taskgoblin_telegram_chats")
    .update({ project_id: project.id, updated_at: new Date().toISOString() })
    .eq("id", chatRecordId)
    .is("project_id", null)
    .select("id, project_id")
    .maybeSingle();
  if (linkError) {
    throw new Error(`Could not link Telegram project: ${linkError.message}`);
  }
  if (linked) {
    return {
      id: linked.id as string,
      project_id: linked.project_id as string,
    };
  }

  const { data: current, error: currentError } = await supabase
    .from("taskgoblin_telegram_chats")
    .select("id, project_id")
    .eq("id", chatRecordId)
    .single();
  if (currentError || !current?.project_id) {
    throw new Error(
      `Could not reload Telegram project: ${currentError?.message ?? "Unknown error"}`,
    );
  }
  return {
    id: current.id as string,
    project_id: current.project_id as string,
  };
}

function displayName(actor: TelegramActor) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ");
}

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

export type CandidateReviewResult = {
  candidateId: string;
  state: "confirmed" | "edited" | "ignored";
  taskId: string | null;
  title: string;
};

export type ProjectEventCandidateReviewResult = {
  candidateId: string;
  state: "confirmed" | "edited" | "ignored";
  taskId: string | null;
  eventType: ProjectEventType;
  summary: string;
  reminderScheduledFor: string | null;
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
        proposed_title: candidate.title,
        proposed_owner_telegram_user_id: candidate.assignToSender
          ? context.userRecordId
          : null,
        confidence: candidate.confidence,
        detection_source: "deterministic",
        state: "detected",
      },
      {
        onConflict: "source_telegram_message_id",
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
    .eq("source_telegram_message_id", sourceMessage.id)
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

export async function loadProjectDetectionContext(
  supabase: SupabaseClient,
  projectId: string,
  window: {
    telegramChatRecordId: string;
    beforeTelegramMessageId: number;
    messageThreadId: number | null;
    sentAt: string | null;
  },
): Promise<ProjectDetectionContext> {
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
    .limit(12);
  recentMessagesQuery =
    window.messageThreadId === null
      ? recentMessagesQuery.is("message_thread_id", null)
      : recentMessagesQuery.eq("message_thread_id", window.messageThreadId);
  if (window.sentAt) {
    const sentAt = new Date(window.sentAt);
    if (!Number.isNaN(sentAt.getTime())) {
      recentMessagesQuery = recentMessagesQuery.gte(
        "sent_at",
        new Date(sentAt.getTime() - 30 * 60 * 1000).toISOString(),
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
  const { data, error } = await supabase.rpc(
    "taskgoblin_transition_project_event_candidate",
    {
      p_candidate_id: candidateId,
      p_project_id: context.projectId,
      p_action: action,
      p_reviewer_telegram_user_id: context.userRecordId,
    },
  );
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

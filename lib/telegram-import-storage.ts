import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NormalizedTelegramImport,
  TaskScanResult,
} from "@/lib/taskgoblin-types";

export async function persistTelegramImport(params: {
  supabase: SupabaseClient;
  telegramImport: NormalizedTelegramImport;
  scan: TaskScanResult;
  sourceFilename: string;
  model: string;
}) {
  const { supabase, telegramImport, scan, sourceFilename, model } = params;
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const importId = crypto.randomUUID();
  const scanRunId = crypto.randomUUID();

  await supabase.from("workspaces").insert({
    id: workspaceId,
    name: telegramImport.chatName,
  });

  await supabase.from("projects").insert({
    id: projectId,
    workspace_id: workspaceId,
    name: telegramImport.chatName,
    source: "telegram",
    health_score: scan.projectHealth.score,
    health_label: scan.projectHealth.label,
  });

  await supabase.from("telegram_imports").insert({
    id: importId,
    project_id: projectId,
    chat_id: telegramImport.chatId,
    chat_name: telegramImport.chatName,
    chat_type: telegramImport.chatType,
    source_filename: sourceFilename,
    import_status: "scanned",
    parser_version: "telegram-parser-v1",
    message_count: telegramImport.messages.length,
  });

  if (telegramImport.participants.length > 0) {
    await supabase.from("chat_participants").insert(
      telegramImport.participants.map((participant) => ({
        project_id: projectId,
        display_name: participant.name,
        telegram_user_id: participant.telegramUserId,
      }))
    );
  }

  if (telegramImport.messages.length > 0) {
    await supabase.from("telegram_messages").insert(
      telegramImport.messages.map((message) => ({
        import_id: importId,
        telegram_message_id: message.id,
        message_type: message.type,
        sent_at: message.date || null,
        sender_name: message.senderName,
        sender_telegram_id: message.senderTelegramId,
        plain_text: message.text,
        raw_json: message.raw,
      }))
    );
  }

  await supabase.from("scan_runs").insert({
    id: scanRunId,
    project_id: projectId,
    telegram_import_id: importId,
    status: "completed",
    model,
    prompt_version: "taskgoblin-telegram-v1",
    raw_output: scan,
  });

  if (scan.tasks.length > 0) {
    await supabase.from("tasks").insert(
      scan.tasks.map((task) => ({
        id: task.id,
        project_id: projectId,
        scan_run_id: scanRunId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        source_participant_name: task.owner,
        due_label: task.deadline,
        confidence: task.confidence,
        blocked_by: task.blockedBy,
        source_message_ids: task.sourceMessageIds,
        source_snippet: task.sourceSnippet,
      }))
    );
  }

  await supabase.from("project_events").insert({
    project_id: projectId,
    event_type: "telegram_import_scanned",
    title: "Telegram import scanned",
    metadata: {
      importId,
      scanRunId,
      messageCount: telegramImport.messages.length,
      taskCount: scan.tasks.length,
    },
  });

  return { workspaceId, projectId, importId, scanRunId };
}

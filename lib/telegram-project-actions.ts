import type { SupabaseClient } from "@supabase/supabase-js";

import { bulkAssignmentCallbackData } from "@/lib/telegram-callbacks";
import type {
  PersistedTelegramMessage,
  TelegramContext,
} from "@/lib/telegram-repository";
import {
  createBulkAssignmentCandidate,
  findProjectMemberByUsername,
  getProjectMemberOwner,
} from "@/lib/telegram-repository";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

export type TelegramProjectActionResponse = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<
      Array<{ text: string; callback_data: string }>
    >;
  };
};

export type BulkAssignmentIntent =
  | { target: "self" }
  | { target: "username"; username: string };

export function parseBulkAssignmentIntent(
  text: string,
): BulkAssignmentIntent | null {
  const fragments = text
    .split(/\r?\n/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .reverse();
  for (const fragment of fragments) {
    const intent = parseSingleBulkAssignmentIntent(fragment);
    if (intent) return intent;
  }
  return null;
}

function parseSingleBulkAssignmentIntent(
  text: string,
): BulkAssignmentIntent | null {
  const mentionedOwner =
    text.match(
      /\b(?:assign|give|reassign)\s+(?:all|every)\s+(?:of\s+)?(?:the\s+)?tasks?\s+(?:to\s+)?@([a-z0-9_]{5,32})\b/i,
    ) ??
    text.match(
      /\b(?:assign|give|reassign)\s+@([a-z0-9_]{5,32})\s+(?:all|every)\s+(?:of\s+)?(?:the\s+)?tasks?\b/i,
    );
  if (mentionedOwner) {
    return { target: "username", username: mentionedOwner[1] };
  }
  if (
    /\bassign\s+(?:all|every)\s+(?:of\s+)?(?:the\s+)?tasks?\s+to\s+me\b/i.test(
      text,
    ) ||
    /\bi\s+(?:will|'ll|can)\s+(?:take|do|handle)\s+(?:all|every)\s+(?:of\s+)?(?:the\s+)?tasks?\b/i.test(
      text,
    )
  ) {
    return { target: "self" };
  }
  return null;
}

export async function handleExplicitTelegramProjectAction(
  supabase: SupabaseClient,
  context: TelegramContext,
  sourceMessage: PersistedTelegramMessage,
  message: TelegramInboundMessage,
): Promise<TelegramProjectActionResponse | null> {
  const intent = parseBulkAssignmentIntent(message.text);
  if (!intent || !context.projectId) return null;

  const owner =
    intent.target === "self"
      ? context.userRecordId
        ? await getProjectMemberOwner(
            supabase,
            context.projectId,
            context.userRecordId,
          )
        : null
      : await findProjectMemberByUsername(
          supabase,
          context.projectId,
          intent.username,
        );
  if (!owner) {
    const target =
      intent.target === "username" ? `@${intent.username}` : "your account";
    return {
      text: `I cannot assign tasks to ${target} because that Telegram user is not a known member of this project group.`,
    };
  }

  try {
    const candidate = await createBulkAssignmentCandidate(
      supabase,
      context,
      sourceMessage,
      owner,
    );
    return {
      text: [
        `Assign all ${candidate.taskCount} active confirmed tasks to ${candidate.targetOwnerDisplayName}?`,
        "",
        "This will replace their current owners. Completed tasks will not change.",
      ].join("\n"),
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: `Assign all ${candidate.taskCount}`,
              callback_data: bulkAssignmentCallbackData(
                "confirm",
                candidate.id,
              ),
            },
            {
              text: "Cancel",
              callback_data: bulkAssignmentCallbackData(
                "ignore",
                candidate.id,
              ),
            },
          ],
        ],
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("no active confirmed tasks")
    ) {
      return { text: error.message };
    }
    throw error;
  }
}

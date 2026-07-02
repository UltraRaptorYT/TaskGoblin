import type {
  ChatParticipant,
  NormalizedTelegramImport,
  NormalizedTelegramMessage,
} from "@/lib/taskgoblin-types";

type TelegramTextEntity = {
  text?: string;
  type?: string;
};

type TelegramRawMessage = {
  id?: number;
  type?: string;
  date?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  actor_id?: string;
  text?: string | TelegramTextEntity[];
  text_entities?: TelegramTextEntity[];
  members?: string[];
  [key: string]: unknown;
};

type TelegramRawExport = {
  id?: number | string;
  name?: string;
  type?: string;
  messages?: TelegramRawMessage[];
};

type TelegramParsedExport = Omit<TelegramRawExport, "messages"> & {
  messages: TelegramRawMessage[];
};

export function normalizeTelegramExport(
  raw: unknown
): NormalizedTelegramImport {
  if (!isTelegramExport(raw)) {
    throw new Error("Expected a Telegram Desktop JSON export with messages.");
  }

  const participantsByKey = new Map<string, ChatParticipant>();

  const rawMessages = raw.messages;
  const messages = rawMessages.map((message, index) => {
    const normalized = normalizeTelegramMessage(message, index);
    const participantName = normalized.senderName;
    const participantId =
      normalized.senderTelegramId ?? participantName ?? `unknown-${index}`;

    if (participantName && !participantsByKey.has(participantId)) {
      participantsByKey.set(participantId, {
        id: participantId,
        name: participantName,
        telegramUserId: normalized.senderTelegramId ?? undefined,
      });
    }

    for (const member of message.members ?? []) {
      if (!participantsByKey.has(member)) {
        participantsByKey.set(member, {
          id: member,
          name: member,
        });
      }
    }

    return normalized;
  });

  return {
    chatId: String(raw.id ?? "telegram-export"),
    chatName: raw.name ?? "Telegram import",
    chatType: raw.type ?? "unknown",
    importedAt: new Date().toISOString(),
    participants: [...participantsByKey.values()],
    messages,
  };
}

export function buildTranscript(
  telegramImport: NormalizedTelegramImport,
  limit = 140
) {
  return telegramImport.messages
    .filter((message) => message.text.trim().length > 0)
    .slice(-limit)
    .map((message) => {
      const sender = message.senderName ?? "System";
      return `[${message.id}] ${message.date} ${sender}: ${message.text}`;
    })
    .join("\n");
}

function normalizeTelegramMessage(
  message: TelegramRawMessage,
  fallbackIndex: number
): NormalizedTelegramMessage {
  const type =
    message.type === "message" || message.type === "service"
      ? message.type
      : "unknown";

  return {
    id: typeof message.id === "number" ? message.id : fallbackIndex,
    type,
    date: message.date ?? "",
    senderName: message.from ?? message.actor ?? null,
    senderTelegramId: message.from_id ?? message.actor_id ?? null,
    text: flattenTelegramText(message.text, message.text_entities),
    raw: message,
  };
}

function flattenTelegramText(
  text: TelegramRawMessage["text"],
  textEntities: TelegramRawMessage["text_entities"]
) {
  if (typeof text === "string") {
    return text;
  }

  if (Array.isArray(text)) {
    return text
      .map((part) => (typeof part === "string" ? part : part.text ?? ""))
      .join("");
  }

  if (Array.isArray(textEntities)) {
    return textEntities.map((entity) => entity.text ?? "").join("");
  }

  return "";
}

function isTelegramExport(value: unknown): value is TelegramParsedExport {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as TelegramRawExport).messages)
  );
}

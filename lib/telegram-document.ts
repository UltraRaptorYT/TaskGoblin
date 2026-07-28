import { readProjectBriefBuffer } from "@/lib/project-brief-parser";
import type {
  TelegramInboundDocument,
  TelegramInboundMessage,
} from "@/lib/taskgoblin-types";

const MAX_TELEGRAM_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_EVENT_DOCUMENT_CHARACTERS = 30_000;

type TelegramFileResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    file_path?: string;
    file_size?: number;
  };
};

export type TelegramDocumentExtraction = {
  filename: string;
  extension: string;
  text: string;
  wasTruncated: boolean;
};

export async function extractTelegramDocument(
  document: TelegramInboundDocument,
  options: {
    token?: string;
    fetcher?: typeof fetch;
  } = {},
): Promise<TelegramDocumentExtraction> {
  const token = options.token ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }
  if (
    document.fileSize !== null &&
    document.fileSize > MAX_TELEGRAM_DOCUMENT_BYTES
  ) {
    throw new Error("TaskGoblin can read Telegram documents up to 15 MB.");
  }

  const filename = supportedFilename(document);
  const fetcher = options.fetcher ?? fetch;
  const fileResponse = await fetcher(
    `https://api.telegram.org/bot${token}/getFile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: document.fileId }),
    },
  );
  const filePayload = (await fileResponse
    .json()
    .catch(() => ({}))) as TelegramFileResponse;
  const filePath = filePayload.result?.file_path;
  if (!fileResponse.ok || !filePayload.ok || !filePath) {
    throw new Error(
      filePayload.description ?? "Telegram could not prepare this document.",
    );
  }
  if (
    filePayload.result?.file_size !== undefined &&
    filePayload.result.file_size > MAX_TELEGRAM_DOCUMENT_BYTES
  ) {
    throw new Error("TaskGoblin can read Telegram documents up to 15 MB.");
  }

  const downloadResponse = await fetcher(
    `https://api.telegram.org/file/bot${token}/${filePath}`,
  );
  if (!downloadResponse.ok) {
    throw new Error("Telegram document download failed.");
  }
  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  if (buffer.byteLength > MAX_TELEGRAM_DOCUMENT_BYTES) {
    throw new Error("TaskGoblin can read Telegram documents up to 15 MB.");
  }

  return readProjectBriefBuffer(filename, buffer);
}

export function documentMessageText(
  message: TelegramInboundMessage,
  extraction?: TelegramDocumentExtraction,
) {
  if (!message.document) return message.text;
  const lines = [`Telegram document: ${displayFilename(message.document)}`];
  if (message.text) lines.push(`Caption: ${message.text}`);
  if (extraction) {
    lines.push(
      "",
      "Extracted document content:",
      extraction.text.slice(0, MAX_EVENT_DOCUMENT_CHARACTERS),
    );
  }
  return lines.join("\n");
}

export function displayFilename(document: TelegramInboundDocument) {
  return (
    document.fileName?.replace(/\u0000/g, "").trim().slice(0, 255) ||
    `document-${document.fileUniqueId}`
  );
}

function supportedFilename(document: TelegramInboundDocument) {
  const filename = displayFilename(document);
  if (/\.(?:pdf|docx|txt|md)$/i.test(filename)) return filename;

  const extension = mimeExtension(document.mimeType);
  if (extension) return `${filename}.${extension}`;
  throw new Error(
    "TaskGoblin can currently read PDF, DOCX, TXT, and MD documents.",
  );
}

function mimeExtension(mimeType: string | null) {
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (mimeType === "text/plain") return "txt";
  if (mimeType === "text/markdown") return "md";
  return null;
}

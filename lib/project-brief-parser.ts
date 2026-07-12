import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import type { NormalizedTelegramImport } from "@/lib/taskgoblin-types";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 120_000;

const EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

export async function readProjectBrief(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Project briefs must be 15 MB or smaller.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS.has(extension)) {
    throw new Error("Upload a PDF, Word document, Markdown file, or text file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (extension === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    text = buffer.toString("utf8");
  }

  const normalizedText = text.replace(/\u0000/g, "").trim();
  if (!normalizedText) {
    throw new Error(
      "No readable text was found. Scanned PDFs need OCR before upload."
    );
  }

  return {
    filename: file.name,
    extension,
    text: normalizedText.slice(0, MAX_TEXT_CHARACTERS),
    wasTruncated: normalizedText.length > MAX_TEXT_CHARACTERS,
  };
}

export function normalizeProjectBrief(params: {
  filename: string;
  extension: string;
  text: string;
}): NormalizedTelegramImport {
  const title = params.filename.replace(/\.[^.]+$/, "");
  const sections = params.text
    .split(/\n\s*\n/)
    .map((section) => section.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    chatId: `brief-${crypto.randomUUID()}`,
    chatName: title || "Project brief",
    chatType: `project_brief_${params.extension}`,
    importedAt: new Date().toISOString(),
    participants: [],
    messages: sections.map((section, index) => ({
      id: index + 1,
      type: "message",
      date: "",
      senderName: "Project brief",
      senderTelegramId: null,
      text: section,
      raw: { section: index + 1 },
    })),
  };
}

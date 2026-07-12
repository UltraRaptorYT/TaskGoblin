import { GoogleGenAI } from "@google/genai";

import { createMockScanResult } from "@/lib/mock-scan";
import type {
  NormalizedTelegramImport,
  TaskScanResult,
} from "@/lib/taskgoblin-types";
import { buildTranscript } from "@/lib/telegram-parser";

const TASK_SCAN_SCHEMA = {
  name: "taskgoblin_scan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "projectHealth",
      "tasks",
      "decisions",
      "questions",
      "risks",
      "blockers",
      "accountabilitySuggestions",
    ],
    properties: {
      summary: { type: "string" },
      projectHealth: {
        type: "object",
        additionalProperties: false,
        required: ["score", "label", "explanation"],
        properties: {
          score: { type: "number" },
          label: { type: "string" },
          explanation: { type: "string" },
        },
      },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "description",
            "owner",
            "deadline",
            "status",
            "priority",
            "confidence",
            "sourceMessageIds",
            "sourceSnippet",
          ],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            owner: { type: ["string", "null"] },
            deadline: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: ["backlog", "todo", "doing", "blocked", "done", "overdue"],
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
            },
            confidence: { type: "number" },
            sourceMessageIds: {
              type: "array",
              items: { type: "number" },
            },
            sourceSnippet: { type: "string" },
          },
        },
      },
      decisions: {
        type: "array",
        items: sourceBackedTextSchema(["id", "text", "sourceMessageIds"]),
      },
      questions: {
        type: "array",
        items: {
          ...sourceBackedTextSchema(["id", "text", "sourceMessageIds", "owner"]),
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            owner: { type: ["string", "null"] },
            sourceMessageIds: { type: "array", items: { type: "number" } },
          },
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "type",
            "severity",
            "message",
            "reason",
            "sourceMessageIds",
          ],
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: [
                "ghost_task",
                "blocker",
                "missing_deadline",
                "vague_promise",
                "deadline_risk",
                "stale_task",
              ],
            },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            message: { type: "string" },
            reason: { type: "string" },
            sourceMessageIds: { type: "array", items: { type: "number" } },
          },
        },
      },
      blockers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "taskId", "message", "blockedBy", "sourceMessageIds"],
          properties: {
            id: { type: "string" },
            taskId: { type: ["string", "null"] },
            message: { type: "string" },
            blockedBy: { type: ["string", "null"] },
            sourceMessageIds: { type: "array", items: { type: "number" } },
          },
        },
      },
      accountabilitySuggestions: {
        type: "object",
        additionalProperties: false,
        required: ["professional", "friendly", "goblin"],
        properties: {
          professional: { type: "string" },
          friendly: { type: "string" },
          goblin: { type: "string" },
        },
      },
    },
  },
};

export async function scanTelegramImport(
  telegramImport: NormalizedTelegramImport
): Promise<{ result: TaskScanResult; usedMock: boolean; model: string }> {
  return scanImport(telegramImport, "Telegram conversation");
}

export async function scanProjectBrief(
  projectBrief: NormalizedTelegramImport
): Promise<{ result: TaskScanResult; usedMock: boolean; model: string }> {
  return scanImport(projectBrief, "project brief");
}

async function scanImport(
  telegramImport: NormalizedTelegramImport,
  sourceKind: "Telegram conversation" | "project brief"
): Promise<{ result: TaskScanResult; usedMock: boolean; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

  if (!apiKey) {
    return {
      result: createMockScanResult(telegramImport),
      usedMock: true,
      model: "mock",
    };
  }

  const client = new GoogleGenAI({ apiKey });
  const transcript = buildTranscript(telegramImport);

  const response = await client.models.generateContent({
    model,
    contents: `Source type: ${sourceKind}\nProject: ${telegramImport.chatName}\nParticipants: ${telegramImport.participants
      .map((participant) => participant.name)
      .join(", ") || "Not explicitly listed"}\n\nSource content:\n${transcript}`,
    config: {
      systemInstruction:
        `You are TaskGoblin, an AI project manager. Extract only facts supported by the supplied ${sourceKind}. Do not invent owners or deadlines. Use null where unknown. Treat headings, deliverables, milestones, responsibilities, dependencies, and success criteria as project context. Goblin tone may be playful, but never cruel.`,
      responseMimeType: "application/json",
      responseJsonSchema: TASK_SCAN_SCHEMA.schema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty task scan.");

  return {
    result: JSON.parse(text) as TaskScanResult,
    usedMock: false,
    model,
  };
}

function sourceBackedTextSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties: {
      id: { type: "string" },
      text: { type: "string" },
      source: { type: "string" },
      sourceMessageIds: { type: "array", items: { type: "number" } },
    },
  };
}

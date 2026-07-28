import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OPENAI_REMINDER_MODEL,
  createAccountabilityMessage,
  generateAccountabilityMessage,
} from "@/lib/accountability";
import { createMockScanResult } from "@/lib/mock-scan";
import {
  DEFAULT_OPENAI_SCAN_MODEL,
  scanProjectBrief,
} from "@/lib/openai-scan";
import type {
  NormalizedTelegramImport,
  TaskItem,
} from "@/lib/taskgoblin-types";

const projectBrief: NormalizedTelegramImport = {
  chatId: "brief",
  chatName: "Website launch",
  chatType: "project_brief",
  importedAt: "2026-07-28T08:00:00.000Z",
  participants: [{ id: "zi-bing", name: "Zi Bing" }],
  messages: [
    {
      id: 1,
      type: "message",
      date: "2026-07-28T08:00:00.000Z",
      senderName: "Project brief",
      senderTelegramId: null,
      text: "Build and test the launch website.",
      raw: {},
    },
  ],
};

const task: TaskItem = {
  id: "task-1",
  title: "Build the launch website",
  description: "Finish the responsive project site.",
  owner: "Zi Bing",
  deadline: "Friday",
  status: "doing",
  priority: "high",
  confidence: 0.95,
  sourceMessageIds: [1],
};

describe("OpenAI provider consolidation", () => {
  it("uses OpenAI Structured Outputs for legacy import scanning", async () => {
    const scan = createMockScanResult(projectBrief);
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify(scan),
    });
    const client = {
      responses: { create },
    } as unknown as OpenAI;

    const result = await scanProjectBrief(projectBrief, { client });

    expect(result).toEqual({
      result: scan,
      usedMock: false,
      model: DEFAULT_OPENAI_SCAN_MODEL,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENAI_SCAN_MODEL,
        store: false,
        reasoning: { effort: "none" },
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            name: "taskgoblin_scan",
            strict: true,
          }),
        },
      }),
    );
  });

  it("uses OpenAI for every reminder tone when a client is available", async () => {
    const generated =
      'Zi Bing, the TaskGoblin ledger is checking "Build the launch website", still marked in progress with high priority and due Friday. Singapore time is now 28 Jul 2026, 5:30 pm, so please keep the team aligned. Reply with one concrete update: confirm completion, share your current progress and immediate next step, or name the blocker and help you need.';
    const create = vi.fn().mockResolvedValue({ output_text: generated });
    const client = {
      responses: { create },
    } as unknown as OpenAI;

    await expect(
      generateAccountabilityMessage(task, "friendly", { client }),
    ).resolves.toBe(generated);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENAI_REMINDER_MODEL,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 500,
      }),
    );
  });

  it("keeps deterministic fallbacks when no OpenAI key is configured", async () => {
    await expect(
      generateAccountabilityMessage(task, "professional", { apiKey: "" }),
    ).resolves.toBe(createAccountabilityMessage(task, "professional"));

    const result = await scanProjectBrief(projectBrief, { apiKey: "" });
    expect(result.usedMock).toBe(true);
    expect(result.model).toBe("mock");
  });

  it("falls back safely when reminder generation fails", async () => {
    const client = {
      responses: {
        create: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      },
    } as unknown as OpenAI;

    await expect(
      generateAccountabilityMessage(task, "goblin", { client }),
    ).resolves.toBe(createAccountabilityMessage(task, "goblin"));
  });
});

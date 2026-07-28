import { describe, expect, it, vi } from "vitest";

import {
  documentMessageText,
  extractTelegramDocument,
} from "@/lib/telegram-document";
import type { TelegramInboundMessage } from "@/lib/taskgoblin-types";

describe("Telegram document processing", () => {
  it("downloads and extracts a supported text document", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              file_path: "documents/assignment.txt",
              file_size: 35,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response("Build the API and submit it Friday.", { status: 200 }),
      );

    const result = await extractTelegramDocument(
      {
        fileId: "file-id",
        fileUniqueId: "file-unique-id",
        fileName: "assignment.txt",
        mimeType: "text/plain",
        fileSize: 35,
      },
      { token: "test-token", fetcher },
    );

    expect(result).toMatchObject({
      filename: "assignment.txt",
      extension: "txt",
      text: "Build the API and submit it Friday.",
      wasTruncated: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported files before downloading them", async () => {
    const fetcher = vi.fn();

    await expect(
      extractTelegramDocument(
        {
          fileId: "file-id",
          fileUniqueId: "file-unique-id",
          fileName: "archive.zip",
          mimeType: "application/zip",
          fileSize: 100,
        },
        { token: "test-token", fetcher },
      ),
    ).rejects.toThrow("PDF, DOCX, TXT, and MD");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("builds bounded AI input from the document and caption", () => {
    const message = {
      text: "Here is our assignment brief",
      document: {
        fileId: "file-id",
        fileUniqueId: "file-unique-id",
        fileName: "assignment.txt",
        mimeType: "text/plain",
        fileSize: 35,
      },
    } as TelegramInboundMessage;

    expect(
      documentMessageText(message, {
        filename: "assignment.txt",
        extension: "txt",
        text: "Build the API.",
        wasTruncated: false,
      }),
    ).toContain("Extracted document content:\nBuild the API.");
  });
});

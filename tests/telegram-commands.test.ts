import { describe, expect, it } from "vitest";

import {
  TELEGRAM_COMMANDS,
  parseTelegramCommand,
} from "@/lib/telegram-commands";

describe("parseTelegramCommand", () => {
  it.each(TELEGRAM_COMMANDS)("routes /%s deterministically", (name) => {
    expect(parseTelegramCommand(`/${name}`)).toEqual({
      name,
      arguments: "",
    });
  });

  it("accepts Telegram bot suffixes and arguments", () => {
    expect(parseTelegramCommand("/tasks@TaskGoblinBot active", "TaskGoblinBot"))
      .toEqual({
        name: "tasks",
        arguments: "active",
      });
  });

  it("rejects unsupported commands and commands for another bot", () => {
    expect(parseTelegramCommand("/done 12")).toBeNull();
    expect(
      parseTelegramCommand("/tasks@OtherBot", "TaskGoblinBot"),
    ).toBeNull();
  });
});

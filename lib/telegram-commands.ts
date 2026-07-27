export const TELEGRAM_COMMANDS = [
  "help",
  "summary",
  "tasks",
  "mytasks",
] as const;

export type TelegramCommandName = (typeof TELEGRAM_COMMANDS)[number];

export type ParsedTelegramCommand = {
  name: TelegramCommandName;
  arguments: string;
};

export function parseTelegramCommand(
  text: string,
  botUsername?: string,
): ParsedTelegramCommand | null {
  const match = text
    .trim()
    .match(/^\/([a-z][a-z0-9_]*)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;

  const [, rawName, targetUsername, rawArguments = ""] = match;
  if (
    targetUsername &&
    botUsername &&
    targetUsername.toLowerCase() !== botUsername.replace(/^@/, "").toLowerCase()
  ) {
    return null;
  }

  const name = rawName.toLowerCase();
  if (!TELEGRAM_COMMANDS.includes(name as TelegramCommandName)) return null;

  return {
    name: name as TelegramCommandName,
    arguments: rawArguments.trim(),
  };
}

export function isTelegramCommandLike(text: string) {
  return text.trimStart().startsWith("/");
}

export function helpMessage() {
  return [
    "TaskGoblin commands:",
    "/help — show this guide",
    "/summary — show confirmed project progress",
    "/tasks — list active confirmed tasks",
    "/mytasks — list confirmed tasks assigned to you",
    "",
    "TaskGoblin watches high-signal project commitments and asks before creating a task.",
  ].join("\n");
}

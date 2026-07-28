import type {
  TelegramActor,
  TelegramChatType,
  TelegramInboundMessage,
} from "@/lib/taskgoblin-types";
import { telegramProjectDashboardUrl } from "@/lib/telegram-links";
import type { TelegramContext } from "@/lib/telegram-repository";

const GROUP_CHAT_TYPES = new Set<TelegramChatType>(["group", "supergroup"]);
const MEMBER_GREETING_PATTERN =
  /^(?:hello|hi|hey)(?:\s+@([a-z0-9_]+))?[!.]?$/i;

export function telegramOnboardingReply(
  message: TelegramInboundMessage,
  context: TelegramContext,
  configuredBotUsername: string | undefined,
  configuredBotToken?: string,
) {
  if (!GROUP_CHAT_TYPES.has(message.chat.type)) return null;

  const botUsername = normalizeUsername(configuredBotUsername);
  const joinedBot = findJoinedTaskGoblin(
    message,
    botUsername,
    configuredBotToken,
  );
  if (joinedBot) {
    return telegramBotAddedReply(
      joinedBot,
      configuredBotUsername,
      context.projectId,
    );
  }

  if (
    !context.projectId ||
    !context.userRecordId ||
    !message.actor ||
    message.actor.isBot
  ) {
    return null;
  }

  const greeting = message.text.match(MEMBER_GREETING_PATTERN);
  if (!greeting) return null;
  const mentionedUsername = normalizeUsername(greeting[1]);
  if (mentionedUsername && mentionedUsername !== botUsername) return null;

  const identity = message.actor.username
    ? `@${message.actor.username}`
    : context.displayName ?? message.actor.firstName;
  return [
    `Hello, ${context.displayName ?? message.actor.firstName}!`,
    `You are linked to this project as ${identity}.`,
    "I can now safely recognise you as a task owner.",
    "",
    "For private deadline reminders, open my private chat and press Start once.",
  ].join("\n");
}

export function telegramBotAddedReply(
  bot: TelegramActor,
  configuredBotUsername?: string,
  projectId?: string | null,
) {
  const botUsername =
    normalizeUsername(bot.username) ?? normalizeUsername(configuredBotUsername);
  return welcomeMessage(botUsername, projectId);
}

function findJoinedTaskGoblin(
  message: TelegramInboundMessage,
  botUsername: string | null,
  configuredBotToken: string | undefined,
) {
  const botId = botIdFromToken(configuredBotToken);
  return message.newChatMembers.find(
    (member) =>
      member.isBot &&
      ((botId !== null && member.id === botId) ||
        (botUsername !== null &&
          normalizeUsername(member.username) === botUsername)),
  );
}

function welcomeMessage(botUsername: string | null, projectId?: string | null) {
  const privateSetup = botUsername
    ? `2. Each member should open @${botUsername} privately and press Start once to receive private reminders.`
    : "2. Each member should open my private chat and press Start once to receive private reminders.";
  const lines = [
    "👋 Hello! I’m TaskGoblin, the AI project manager for this group.",
    "",
    "I can detect task proposals, assignments, deadlines, progress, blockers, completions, and decisions. I will ask for confirmation before changing project state.",
    "",
    "Quick setup:",
    "1. Each team member should send hello in this group so I can link their Telegram identity.",
    privateSetup,
    "3. Try an explicit assignment, for example:",
    "@alex please prepare the demo by Friday",
    "",
    "Use /help to see commands, /tasks for active work, and /mytasks for your assignments.",
  ];
  const dashboardUrl = projectId
    ? telegramProjectDashboardUrl(projectId)
    : null;
  if (dashboardUrl) {
    lines.push("", `Track this project on the web:\n${dashboardUrl}`);
  }
  return lines.join("\n");
}

function botIdFromToken(value: string | undefined) {
  const match = value?.match(/^(\d+):/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

function normalizeUsername(value: string | undefined | null) {
  return value?.trim().replace(/^@/, "").toLowerCase() || null;
}

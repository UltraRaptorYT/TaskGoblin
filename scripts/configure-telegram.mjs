import { readFile } from "node:fs/promises";

const env = await readLocalEnv();
const token = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.TASKGOBLIN_APP_URL || env.TASKGOBLIN_APP_URL;
const webhookSecret =
  process.env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  throw new Error(
    "Add TELEGRAM_BOT_TOKEN to .env.local before configuring Telegram.",
  );
}

const apiUrl = `https://api.telegram.org/bot${token}`;

await setCommands(
  { type: "default" },
  [
    { command: "start", description: "Open your TaskGoblin workspace" },
    { command: "help", description: "Show TaskGoblin commands" },
    {
      command: "mytasks",
      description: "Browse your tasks across every project",
    },
  ],
);

await setCommands(
  { type: "all_group_chats" },
  [
    { command: "help", description: "Show TaskGoblin commands" },
    { command: "summary", description: "Show confirmed project progress" },
    { command: "project", description: "Show project goal and priorities" },
    { command: "kpi", description: "Show confirmed project metrics" },
    { command: "tasks", description: "Browse active project tasks" },
    { command: "mytasks", description: "Browse your tasks in this project" },
    { command: "undo", description: "Reverse the latest task change" },
  ],
);

if (appUrl && webhookSecret) {
  await configureWebhook(appUrl, webhookSecret);
  console.log("TaskGoblin commands and webhook update types configured.");
} else {
  console.log(
    "TaskGoblin command menus configured. Add TASKGOBLIN_APP_URL and TELEGRAM_WEBHOOK_SECRET to configure the webhook too.",
  );
}

async function setCommands(scope, commands) {
  const response = await fetch(`${apiUrl}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, commands }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(
      `Telegram setMyCommands failed: ${payload.description ?? response.status}`,
    );
  }
}

async function configureWebhook(rawAppUrl, secretToken) {
  const webhookUrl = `${rawAppUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const response = await fetch(`${apiUrl}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: [
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "callback_query",
        "my_chat_member",
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(
      `Telegram setWebhook failed: ${payload.description ?? response.status}`,
    );
  }
}

async function readLocalEnv() {
  const contents = await readFile(
    new URL("../.env.local", import.meta.url),
    "utf8",
  ).catch(() => "");
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2"),
        ];
      }),
  );
}

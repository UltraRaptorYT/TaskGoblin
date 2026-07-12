import { readFile } from "node:fs/promises";

const env = await readLocalEnv();
const token = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Add TELEGRAM_BOT_TOKEN to .env.local before starting the bot.");
}

const apiUrl = `https://api.telegram.org/bot${token}`;
let offset = 0;

const bot = await callTelegram("getMe");
console.log(`TaskGoblin bot @${bot.username} is listening. Press Ctrl+C to stop.`);

while (true) {
  try {
    const updates = await callTelegram("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      await handleUpdate(update);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message?.chat?.id || typeof message.text !== "string") return;

  const command = message.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  const name = message.from?.first_name || "quest keeper";

  if (command === "/start") {
    await sendMessage(
      message.chat.id,
      `Welcome, ${name}! 🧌\n\nTaskGoblin is awake. I can turn project chats into trackable work.\n\nFor now, upload your Telegram export at the TaskGoblin website. Project linking and continuous chat tracking are the next setup step.\n\nUse /help to see available commands.`,
    );
    return;
  }

  if (command === "/help") {
    await sendMessage(
      message.chat.id,
      "TaskGoblin commands:\n/start — wake the Goblin\n/help — show this guide\n/status — check the bot connection",
    );
    return;
  }

  if (command === "/status") {
    await sendMessage(message.chat.id, "✅ Bot connected. Project linking is not configured yet.");
    return;
  }

  if (message.text.startsWith("/")) {
    await sendMessage(message.chat.id, "I don't know that command yet. Try /help.");
  }
}

async function sendMessage(chatId, text) {
  return callTelegram("sendMessage", { chat_id: chatId, text });
}

async function callTelegram(method, body) {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(`Telegram ${method} failed: ${payload.description}`);
  return payload.result;
}

async function readLocalEnv() {
  const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "");
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

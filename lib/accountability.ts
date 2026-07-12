import { GoogleGenAI } from "@google/genai";

import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

export async function generateAccountabilityMessage(
  task: TaskItem,
  tone: AccountabilityTone,
) {
  if (tone !== "goblin" || !process.env.GEMINI_API_KEY) {
    return createAccountabilityMessage(task, tone);
  }

  try {
    const currentTime = formatSingaporeTime();
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
      contents: JSON.stringify({
        title: task.title,
        description: task.description ?? null,
        owner: task.owner,
        deadline: task.deadline,
        status: task.status,
        priority: task.priority,
        blockedBy: task.blockedBy ?? null,
        currentTime,
        timezone: "Asia/Singapore",
      }),
      config: {
        systemInstruction:
          "You write premium TaskGoblin accountability reminders for Telegram. Write exactly one polished message of 70–110 words across 3–5 sentences. The message must address the supplied owner by name when present, repeat the exact task title, state the exact supplied deadline when present, and mention the supplied current Singapore time so the urgency is concrete. Include the task status, priority, or blocker when useful. End by asking for one concrete response: completion, current progress plus next step, or the blocker plus help needed. Sound theatrical, eerie, sinister, witty, and mischievous—as if an ancient goblin ledger is tracking unfinished work. Make it impressive, not a vague one-line flourish. Never invent an owner, deadline, progress, or time remaining. No markdown, headings, quotation wrappers, violence, harm, hate, humiliation, profanity, coercion, or genuine threats.",
        candidateCount: 1,
        maxOutputTokens: 500,
      },
    });

    const message = response.text?.trim();
    return message && isCompleteGoblinMessage(message, task)
      ? message
      : createAccountabilityMessage(task, tone);
  } catch {
    return createAccountabilityMessage(task, tone);
  }
}

export function createAccountabilityMessage(
  task: TaskItem,
  tone: AccountabilityTone
) {
  const owner = task.owner ?? "team";
  const due = task.deadline ? ` due ${task.deadline}` : " without a clear due date";

  if (tone === "professional") {
    return `Hi ${owner}, quick reminder that "${task.title}" is${due}. Please share the latest status when you can.`;
  }

  if (tone === "friendly") {
    return `Hey ${owner}, checking in on "${task.title}"${due}. Anything blocking you, or are we good to keep moving?`;
  }

  const timing = formatSingaporeTime();
  const deadlineLine = task.deadline
    ? `The exact mark beside it reads ${task.deadline}, and the clock in Singapore now shows ${timing}.`
    : `No due date has been written beside it, even as the clock in Singapore shows ${timing}.`;
  return `🕯️ ${owner}, attend carefully: the Goblin has opened the ledger, and "${task.title}" is still marked ${task.status} with ${task.priority} priority. ${deadlineLine} This entry will not vanish merely because the page is left unread. Reply now with one clear truth: confirm it is complete, state the current progress and next step, or name the blocker and the help required.`;
}

function isCompleteGoblinMessage(message: string, task: TaskItem) {
  const normalized = message.toLowerCase();
  const words = message.trim().split(/\s+/).length;
  const includesOwner = task.owner
    ? normalized.includes(task.owner.toLowerCase())
    : true;
  const includesTask = normalized.includes(task.title.toLowerCase());
  const includesDeadline = task.deadline
    ? normalized.includes(task.deadline.toLowerCase())
    : true;

  return words >= 55 && includesOwner && includesTask && includesDeadline;
}

function formatSingaporeTime() {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

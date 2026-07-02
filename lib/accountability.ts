import type { AccountabilityTone, TaskItem } from "@/lib/taskgoblin-types";

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

  return `${owner}, the task "${task.title}" is still staring at us${due}. Please feed it an update before it becomes a project health incident.`;
}

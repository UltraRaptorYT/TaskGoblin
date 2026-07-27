import type {
  TaskCandidateState,
  TelegramInboundMessage,
} from "@/lib/taskgoblin-types";
import { isTelegramCommandLike } from "@/lib/telegram-commands";

export type TaskCandidateTransitionAction =
  | "queue"
  | "confirm"
  | "edit"
  | "ignore";

export type DeterministicTaskCandidate = {
  title: string;
  confidence: number;
  assignToSender: boolean;
};

const FIRST_PERSON_COMMITMENT =
  /\b(?:i will|i['’]ll|i can|i commit to|i am going to)\b/i;
const EXPLICIT_REQUEST =
  /\b(?:please|can you|could you|would you|need you to|you need to|you must)\b/i;

export function detectDeterministicTaskCandidate(
  message: TelegramInboundMessage,
): DeterministicTaskCandidate | null {
  const text = message.text.replace(/\s+/g, " ").trim();
  if (
    message.updateType !== "message" ||
    !message.actor ||
    message.actor.isBot ||
    isTelegramCommandLike(text) ||
    text.length < 8
  ) {
    return null;
  }

  const isCommitment = FIRST_PERSON_COMMITMENT.test(text);
  const isRequest = EXPLICIT_REQUEST.test(text);
  if (!isCommitment && !isRequest) return null;

  return {
    title: text.slice(0, 240),
    confidence: isCommitment ? 0.8 : 0.7,
    assignToSender: isCommitment,
  };
}

export function transitionTaskCandidateState(
  current: TaskCandidateState,
  action: TaskCandidateTransitionAction,
): TaskCandidateState {
  if (current === "detected" && action === "queue") {
    return "awaiting_confirmation";
  }
  if (current === "awaiting_confirmation") {
    if (action === "confirm") return "confirmed";
    if (action === "edit") return "edited";
    if (action === "ignore") return "ignored";
  }
  throw new Error(`Invalid task candidate transition: ${current} -> ${action}`);
}

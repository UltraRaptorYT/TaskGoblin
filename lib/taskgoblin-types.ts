export type TaskStatus =
  | "backlog"
  | "todo"
  | "doing"
  | "blocked"
  | "done"
  | "overdue";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type AccountabilityTone = "professional" | "friendly" | "goblin";

export type TaskItem = {
  id: string;
  title: string;
  description?: string;
  owner: string | null;
  deadline: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  confidence: number;
  blockedBy?: string;
  sourceMessageIds: number[];
  sourceSnippet?: string;
};

export type Decision = {
  id: string;
  text: string;
  source?: string;
  sourceMessageIds: number[];
};

export type Question = {
  id: string;
  text: string;
  owner?: string;
  sourceMessageIds: number[];
};

export type Risk = {
  id: string;
  type:
    | "ghost_task"
    | "blocker"
    | "missing_deadline"
    | "vague_promise"
    | "deadline_risk"
    | "stale_task";
  severity: "low" | "medium" | "high";
  message: string;
  reason?: string;
  sourceMessageIds: number[];
};

export type Blocker = {
  id: string;
  taskId?: string;
  message: string;
  blockedBy?: string;
  sourceMessageIds: number[];
};

export type ChatParticipant = {
  id: string;
  name: string;
  telegramUserId?: string;
  appProfileId?: string;
};

export type NormalizedTelegramMessage = {
  id: number;
  type: "message" | "service" | "unknown";
  date: string;
  senderName: string | null;
  senderTelegramId: string | null;
  text: string;
  raw: unknown;
};

export type NormalizedTelegramImport = {
  chatId: string;
  chatName: string;
  chatType: string;
  importedAt: string;
  participants: ChatParticipant[];
  messages: NormalizedTelegramMessage[];
};

export type TaskScanResult = {
  summary: string;
  projectHealth: {
    score: number;
    label: string;
    explanation: string;
  };
  tasks: TaskItem[];
  decisions: Decision[];
  questions: Question[];
  risks: Risk[];
  blockers: Blocker[];
  accountabilitySuggestions: Record<AccountabilityTone, string>;
};

export type TelegramImportResponse = {
  importId: string;
  projectId: string;
  persisted: boolean;
  normalized: {
    chatName: string;
    messageCount: number;
    participantCount: number;
  };
  scan: TaskScanResult;
};

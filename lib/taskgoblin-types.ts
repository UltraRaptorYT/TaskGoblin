export type TaskStatus =
  | "backlog"
  | "todo"
  | "doing"
  | "blocked"
  | "done"
  | "overdue";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type AccountabilityTone = "professional" | "friendly" | "goblin";

export type TaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

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
  subtasks?: TaskSubtask[];
  autoReminder?: boolean;
  reminderLeadMinutes?: number;
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

export type TelegramChatType =
  | "private"
  | "group"
  | "supergroup"
  | "channel"
  | "unknown";

export type TelegramActor = {
  id: number;
  isBot: boolean;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
};

export type TelegramChat = {
  id: number;
  type: TelegramChatType;
  title: string | null;
  username: string | null;
};

export type TelegramInboundDocument = {
  fileId: string;
  fileUniqueId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

export type TelegramInboundMessage = {
  kind: "message";
  updateId: number;
  updateType:
    | "message"
    | "edited_message"
    | "channel_post"
    | "edited_channel_post";
  messageId: number;
  sentAt: string | null;
  editedAt: string | null;
  text: string;
  chat: TelegramChat;
  actor: TelegramActor | null;
  document?: TelegramInboundDocument | null;
  newChatMembers: TelegramActor[];
  replyToMessageId: number | null;
  messageThreadId: number | null;
  raw: unknown;
};

export type TelegramInboundCallback = {
  kind: "callback_query";
  updateId: number;
  updateType: "callback_query";
  callbackQueryId: string;
  data: string | null;
  chat: TelegramChat | null;
  actor: TelegramActor;
  messageId: number | null;
  raw: unknown;
};

export type TelegramInboundBotAdded = {
  kind: "bot_added";
  updateId: number;
  updateType: "my_chat_member";
  sentAt: string | null;
  chat: TelegramChat;
  actor: TelegramActor;
  bot: TelegramActor;
  raw: unknown;
};

export type TelegramInboundUpdate =
  | TelegramInboundMessage
  | TelegramInboundCallback
  | TelegramInboundBotAdded;

export type TaskCandidateState =
  | "detected"
  | "awaiting_confirmation"
  | "confirmed"
  | "edited"
  | "ignored";

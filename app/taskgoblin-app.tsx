"use client";

import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileJson,
  History,
  Loader2,
  MessageSquareText,
  Send,
  Upload,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createMockScanResult } from "@/lib/mock-scan";
import type {
  AccountabilityTone,
  TaskItem,
  TaskScanResult,
  TaskStatus,
  TelegramImportResponse,
} from "@/lib/taskgoblin-types";

const DEFAULT_SCAN = createMockScanResult({
  chatId: "demo",
  chatName: "ACACIA LAUNCHPAD",
  chatType: "private_group",
  importedAt: new Date().toISOString(),
  participants: [
    { id: "hong-yu", name: "Hong Yu" },
    { id: "joash", name: "Joash" },
    { id: "zi-bing", name: "Zi Bing" },
  ],
  messages: [
    {
      id: 1,
      type: "message",
      date: "2026-07-02T10:00:00",
      senderName: "Hong Yu",
      senderTelegramId: "user1",
      text: "Need someone to do deployment and pitch deck.",
      raw: {},
    },
  ],
});

const LANES: { id: TaskStatus; title: string; helper: string }[] = [
  { id: "backlog", title: "Backlog", helper: "Captured but not committed" },
  { id: "todo", title: "To Do", helper: "Ready for assignment" },
  { id: "doing", title: "Doing", helper: "In progress now" },
  { id: "blocked", title: "Blocked", helper: "Needs intervention" },
  { id: "overdue", title: "Overdue", helper: "Deadline trouble" },
  { id: "done", title: "Done", helper: "Completed work" },
];

const TONES: AccountabilityTone[] = ["professional", "friendly", "goblin"];

export default function TaskGoblinApp() {
  const [scan, setScan] = useState<TaskScanResult>(DEFAULT_SCAN);
  const [selectedTaskId, setSelectedTaskId] = useState(scan.tasks[0]?.id);
  const [tone, setTone] = useState<AccountabilityTone>("friendly");
  const [fileName, setFileName] = useState<string>("Demo import");
  const [importStatus, setImportStatus] = useState<string>(
    "Upload a Telegram Desktop result.json or ZIP to replace this demo scan."
  );
  const [isImporting, setIsImporting] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(
    scan.accountabilitySuggestions.friendly
  );
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState(
    "Demo mode is open. Add Supabase env vars to send magic links."
  );

  const selectedTask = useMemo(
    () => scan.tasks.find((task) => task.id === selectedTaskId) ?? scan.tasks[0],
    [scan.tasks, selectedTaskId]
  );

  async function handleFileUpload(file: File | null) {
    if (!file) return;

    setIsImporting(true);
    setFileName(file.name);
    setImportStatus("Importing Telegram export and asking the Goblin to scan...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/imports/telegram", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as TelegramImportResponse & {
        error?: string;
        usedMock?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Telegram import failed.");
      }

      setScan(payload.scan);
      setSelectedTaskId(payload.scan.tasks[0]?.id);
      setReminderMessage(payload.scan.accountabilitySuggestions[tone]);
      setImportStatus(
        `${payload.normalized.chatName}: ${payload.normalized.messageCount} messages, ${payload.normalized.participantCount} participants. ${
          payload.persisted ? "Saved to Supabase." : "Running in demo mode."
        } ${payload.usedMock ? "Mock scan used." : "OpenAI scan used."}`
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "Telegram import failed."
      );
    } finally {
      setIsImporting(false);
    }
  }

  function updateTask(taskId: string, patch: Partial<TaskItem>) {
    setScan((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task
      ),
    }));

    void fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function generateReminder(task: TaskItem, nextTone = tone) {
    const response = await fetch("/api/messages/accountability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, tone: nextTone }),
    });
    const payload = (await response.json()) as { message?: string };
    setReminderMessage(payload.message ?? scan.accountabilitySuggestions[nextTone]);
  }

  async function scheduleReminder(task: TaskItem) {
    const response = await fetch(`/api/tasks/${task.id}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, tone }),
    });
    const payload = (await response.json()) as { message?: string };
    setReminderMessage(payload.message ?? reminderMessage);
    setImportStatus("Reminder staged. Configure the Telegram bot token to send it live.");
  }

  async function requestMagicLink() {
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
    };

    setAuthMessage(payload.message ?? payload.error ?? "Sign-in request failed.");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-stone-950">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-700">
                <Bot className="size-4" />
                Telegram-first accountability workspace
              </div>
              <h1 className="text-3xl font-semibold tracking-normal text-stone-950 sm:text-4xl">
                TaskGoblin turns Telegram chaos into a board your team can
                actually finish.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Upload a Telegram Desktop export, extract tasks with OpenAI,
                review a light Jira board, assign owners, and stage reminders
                for the people who need a nudge.
              </p>
            </div>

            <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-500 bg-emerald-50 px-4 py-5 text-center text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 lg:w-80">
              {isImporting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
              <span>{isImporting ? "Scanning..." : "Upload result.json or ZIP"}</span>
              <span className="max-w-full truncate text-xs font-normal text-emerald-700">
                {fileName}
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".json,.zip,application/json,application/zip"
                onChange={(event) =>
                  void handleFileUpload(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-3">
            <StatusPill
              icon={<FileJson className="size-4" />}
              label="Import"
              value={importStatus}
            />
            <StatusPill
              icon={<Users className="size-4" />}
              label="Board"
              value={`${scan.tasks.length} tasks, ${scan.risks.length} risks, ${scan.questions.length} questions`}
            />
            <StatusPill
              icon={<MessageSquareText className="size-4" />}
              label="Pitch"
              value="Jira for group chats, with reminders where the conversation started."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="space-y-4">
          <Card className="rounded-lg bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-700" />
                Goblin Scan
              </CardTitle>
              <CardDescription>{scan.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Health" value={scan.projectHealth.label} />
                <Metric label="Score" value={`${scan.projectHealth.score}/100`} />
                <Metric
                  label="Ghost tasks"
                  value={String(scan.tasks.filter((task) => !task.owner).length)}
                />
                <Metric label="Blockers" value={String(scan.blockers.length)} />
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {scan.projectHealth.explanation}
              </p>
            </CardContent>
          </Card>

          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1080px] grid-cols-6 gap-3">
              {LANES.map((lane) => {
                const laneTasks = scan.tasks.filter(
                  (task) => task.status === lane.id
                );

                return (
                  <div
                    key={lane.id}
                    className="rounded-lg border border-stone-200 bg-white p-3"
                  >
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold">{lane.title}</h2>
                      <p className="text-xs text-stone-500">{lane.helper}</p>
                    </div>
                    <div className="space-y-3">
                      {laneTasks.map((task) => (
                        <button
                          key={task.id}
                          className="w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            void generateReminder(task);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold leading-5">
                              {task.title}
                            </h3>
                            <span className={priorityClass(task.priority)}>
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">
                            {task.description}
                          </p>
                          <div className="mt-3 space-y-1 text-xs text-stone-500">
                            <p>Owner: {task.owner ?? "Needs owner"}</p>
                            <p>Due: {task.deadline ?? "No deadline"}</p>
                            <p>Confidence: {Math.round(task.confidence * 100)}%</p>
                          </div>
                        </button>
                      ))}
                      {laneTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">
                          No cards
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-lg bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-emerald-700" />
                Supabase Auth
              </CardTitle>
              <CardDescription>
                Email magic links are the first auth path for project history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                className="h-9 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-600"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button
                className="w-full"
                type="button"
                onClick={() => void requestMagicLink()}
              >
                Send magic link
              </Button>
              <p className="text-xs leading-5 text-stone-500">{authMessage}</p>
            </CardContent>
          </Card>

          {selectedTask ? (
            <Card className="rounded-lg bg-white">
              <CardHeader>
                <CardTitle>{selectedTask.title}</CardTitle>
                <CardDescription>{selectedTask.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block text-sm font-medium">
                  Owner
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-600"
                    value={selectedTask.owner ?? ""}
                    placeholder="Assign teammate"
                    onChange={(event) =>
                      updateTask(selectedTask.id, {
                        owner: event.target.value || null,
                      })
                    }
                  />
                </label>
                <label className="block text-sm font-medium">
                  Status
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-600"
                    value={selectedTask.status}
                    onChange={(event) =>
                      updateTask(selectedTask.id, {
                        status: event.target.value as TaskStatus,
                      })
                    }
                  >
                    {LANES.map((lane) => (
                      <option key={lane.id} value={lane.id}>
                        {lane.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Due label
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-600"
                    value={selectedTask.deadline ?? ""}
                    placeholder="Tomorrow 3 PM"
                    onChange={(event) =>
                      updateTask(selectedTask.id, {
                        deadline: event.target.value || null,
                      })
                    }
                  />
                </label>
                <div className="rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-600">
                  Source messages:{" "}
                  {selectedTask.sourceMessageIds.length
                    ? selectedTask.sourceMessageIds.join(", ")
                    : "No source ids"}
                  {selectedTask.sourceSnippet ? (
                    <p className="mt-2 text-stone-500">
                      &quot;{selectedTask.sourceSnippet}&quot;
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-lg bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5 text-emerald-700" />
                Reminder Agent
              </CardTitle>
              <CardDescription>
                Stage Telegram nudges in the Goblin voice that fits the moment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((nextTone) => (
                  <Button
                    key={nextTone}
                    type="button"
                    variant={tone === nextTone ? "default" : "outline"}
                    onClick={() => {
                      setTone(nextTone);
                      if (selectedTask) void generateReminder(selectedTask, nextTone);
                    }}
                  >
                    {nextTone}
                  </Button>
                ))}
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6">
                {reminderMessage}
              </div>
              <Button
                className="w-full"
                type="button"
                disabled={!selectedTask}
                onClick={() => selectedTask && void scheduleReminder(selectedTask)}
              >
                <CalendarClock className="size-4" />
                Stage Telegram reminder
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scan.risks.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{risk.message}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs">
                      {risk.severity}
                    </span>
                  </div>
                  {risk.reason ? (
                    <p className="mt-2 text-xs leading-5 text-stone-600">
                      {risk.reason}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-emerald-700" />
                Pitch Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-stone-600">
              <p>Jira for group chats.</p>
              <p>Turns Telegram chaos into tasks, owners, deadlines, and reminders.</p>
              <p>
                Demo arc: upload messy chat, generate board, assign ghost task,
                stage Telegram reminder, show project history.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-20 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="mt-0.5 text-emerald-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">
          {label}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function priorityClass(priority: string) {
  const base = "rounded-md px-2 py-1 text-[11px] font-semibold capitalize";

  if (priority === "urgent") return `${base} bg-red-100 text-red-700`;
  if (priority === "high") return `${base} bg-amber-100 text-amber-700`;
  if (priority === "medium") return `${base} bg-emerald-100 text-emerald-700`;
  return `${base} bg-stone-200 text-stone-700`;
}

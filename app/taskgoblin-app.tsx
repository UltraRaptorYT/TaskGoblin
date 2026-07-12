"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileJson,
  History,
  Loader2,
  MessageSquareText,
  Menu,
  Send,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Image from "next/image";

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
    <main className="min-h-screen text-[#17231c]">
      <header className="border-b border-[#cad0b0] bg-[#f4f1e8]/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#516057] md:flex" aria-label="Primary navigation">
            <a className="text-[#173d2b]" href="#board">Board</a>
            <a className="transition hover:text-[#173d2b]" href="#goblin-scan">Goblin scan</a>
            <a className="transition hover:text-[#173d2b]" href="#reminders">Reminders</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#b8c789] bg-[#eff6cf] px-3 py-1.5 text-xs font-bold text-[#38532f] sm:inline-flex">● Demo den</span>
            <Button className="hidden sm:inline-flex" type="button">Invite your crew</Button>
            <button className="grid size-10 place-items-center rounded-xl border border-[#c9c5b9] md:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          </div>
        </div>
      </header>

      <section className="overflow-hidden border-b border-[#cad0b0] bg-[#173d2b] text-white">
        <div className="relative mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_390px] lg:items-center lg:px-8">
          <div className="pointer-events-none absolute -right-24 -top-40 size-96 rounded-full border-[70px] border-[#dfff64]/10" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dfff64]/40 bg-[#dfff64]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#dfff64]">
              <Sparkles className="size-3.5" /> Your tiny task wrangler
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl">
              Less chat chaos.<br /><span className="text-[#dfff64]">More quests done.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#dce6dd] sm:text-lg">
              Drop in a Telegram export. Your Goblin spots the work, finds the owners, and keeps the crew moving—without another meeting.
            </p>
          </div>

          <label className="goblin-shadow relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[#dfff64] bg-[#f9f7ef] px-6 py-8 text-center text-sm font-bold text-[#173d2b] transition hover:-translate-y-1 hover:bg-white">
              {isImporting ? (
                <Loader2 className="size-7 animate-spin" />
              ) : (
                <span className="grid size-12 place-items-center rounded-full bg-[#dfff64]"><Upload className="size-5" /></span>
              )}
              <span className="text-base">{isImporting ? "Goblin is rummaging..." : "Feed the Goblin a chat export"}</span>
              <span className="max-w-full truncate text-xs font-medium text-[#69736b]">
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
      </section>

      <section className="border-b border-[#d8d3c5] bg-[#ebe7da]">
        <div className="mx-auto grid max-w-[1440px] gap-3 px-4 py-4 text-sm sm:px-6 md:grid-cols-3 lg:px-8">
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
      </section>

      <section id="board" className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_370px] lg:px-8 lg:py-8">
        <div className="space-y-4">
          <Card id="goblin-scan" className="bg-[#fffdf7]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[#dfff64]"><CheckCircle2 className="size-4 text-[#173d2b]" /></span>
                The Goblin&apos;s read
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
                    className="rounded-2xl border border-[#d8d3c5] bg-[#ebe7da]/70 p-3"
                  >
                    <div className="mb-3">
                      <h2 className="flex items-center justify-between text-sm font-extrabold text-[#173d2b]">{lane.title}<span className="rounded-full bg-[#d7d2c5] px-2 py-0.5 text-[10px]">{laneTasks.length}</span></h2>
                      <p className="text-xs text-stone-500">{lane.helper}</p>
                    </div>
                    <div className="space-y-3">
                      {laneTasks.map((task) => (
                        <button
                          key={task.id}
                          className={`w-full rounded-xl border bg-[#fffdf7] p-3 text-left shadow-[0_2px_0_rgb(23_61_43_/_0.08)] transition hover:-translate-y-0.5 hover:border-[#799636] ${selectedTaskId === task.id ? "border-[#799636] ring-2 ring-[#dfff64]" : "border-[#d8d3c5]"}`}
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
          <Card className="bg-[#fffdf7]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-emerald-700" />
                Save your den
              </CardTitle>
              <CardDescription>
                Sign in to keep this board and its quest history.
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
            <Card className="bg-[#fffdf7]">
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

          <Card id="reminders" className="bg-[#173d2b] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5 text-emerald-700" />
                Nudge workshop
              </CardTitle>
              <CardDescription>
                Pick a voice. The Goblin handles the awkward follow-up.
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
              <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-sm leading-6 text-[#f5f3e9]">
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

          <Card className="bg-[#fffdf7]">
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

          <Card className="bg-[#fffdf7]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-emerald-700" />
                Why teams keep it
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-stone-600">
              <p>✓ No new workflow for the crew to learn.</p>
              <p>✓ Every quest links back to the source message.</p>
              <p>✓ Friendly pressure, delivered where work began.</p>
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
    <div className="flex min-h-20 gap-3 rounded-xl border border-[#d2cdbf] bg-[#f7f4eb] p-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#dfff64] text-[#173d2b]">{icon}</div>
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
    <div className="rounded-xl border border-[#d8d3c5] bg-[#f1eee4] p-3">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-black text-[#173d2b]">{value}</p>
    </div>
  );
}

function BrandMark() {
  return (
    <a href="#" className="flex items-center gap-2.5" aria-label="TaskGoblin home">
      <span className="goblin-shadow-sm grid size-11 place-items-center overflow-hidden rounded-xl border-2 border-[#173d2b] bg-[#dfff64]" aria-hidden="true">
        <Image src="/brand/taskgoblin-logo.png" alt="" width={44} height={44} className="size-11 object-contain" priority />
      </span>
      <span className="text-xl font-black tracking-[-0.04em] text-[#173d2b]">Task<span className="text-[#66852c]">Goblin</span></span>
    </a>
  );
}

function priorityClass(priority: string) {
  const base = "rounded-md px-2 py-1 text-[11px] font-semibold capitalize";

  if (priority === "urgent") return `${base} bg-red-100 text-red-700`;
  if (priority === "high") return `${base} bg-amber-100 text-amber-700`;
  if (priority === "medium") return `${base} bg-emerald-100 text-emerald-700`;
  return `${base} bg-stone-200 text-stone-700`;
}

"use client";

import {
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LogOut,
  Loader2,
  MessageSquareText,
  Send,
  Upload,
  WandSparkles,
} from "lucide-react";
import type { Provider, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { getSupabasePublic } from "@/lib/supabase-public";
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
    "Upload a project brief or Telegram export to replace this demo scan."
  );
  const [isImporting, setIsImporting] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(
    scan.accountabilitySuggestions.friendly
  );
  const supabase = useMemo(() => getSupabasePublic(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [demoMode, setDemoMode] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const selectedTask = useMemo(
    () => scan.tasks.find((task) => task.id === selectedTaskId) ?? scan.tasks[0],
    [scan.tasks, selectedTaskId]
  );

  async function handleFileUpload(file: File | null) {
    if (!file) return;

    setIsImporting(true);
    setFileName(file.name);
    const isTelegramExport = /\.(json|zip)$/i.test(file.name);
    setImportStatus(
      isTelegramExport
        ? "Importing Telegram export and asking the Goblin to scan..."
        : "Reading the project brief and mapping the quests..."
    );

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        isTelegramExport ? "/api/imports/telegram" : "/api/imports/brief",
        {
        method: "POST",
        body: formData,
        }
      );
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
        `${payload.normalized.chatName}: ${payload.normalized.messageCount} source sections${isTelegramExport ? `, ${payload.normalized.participantCount} participants` : ""}. ${
          payload.persisted ? "Saved to Supabase." : "Running in demo mode."
        } ${payload.usedMock ? "Mock scan used." : "OpenAI scan used."}`
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "Import failed."
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

  async function signInWithOAuth(provider: Provider) {
    if (!supabase) {
      setAuthMessage("Connect Supabase first, or open the demo workspace.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthMessage(error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setDemoMode(false);
    setUser(null);
  }

  if (!authReady) return <LoadingScreen />;

  if (!user && !demoMode) {
    return (
      <LandingPage
        authMessage={authMessage}
        oauthConfigured={Boolean(supabase)}
        onOAuth={(provider) => void signInWithOAuth(provider)}
        onDemo={() => setDemoMode(true)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-[#17231c]">
      <header className="sticky top-0 z-30 border-b border-[#d8d3c5] bg-[#f4f1e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5"><BrandMark /><span className="hidden h-6 w-px bg-[#d8d3c5] sm:block" /><span className="hidden items-center gap-2 text-sm font-bold text-[#536158] sm:flex"><LayoutDashboard className="size-4" /> Workspace</span></div>
          <div className="flex items-center gap-2">
            <a href="/taskgoblin-pitch.html" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#536158] hover:bg-[#e7e3d7] sm:block">Pitch deck</a>
            <span className="hidden max-w-52 truncate text-xs font-semibold text-[#657168] md:block">{user?.email ?? "Demo workspace"}</span>
            <button type="button" onClick={() => void signOut()} className="grid size-9 place-items-center rounded-xl border border-[#c9c5b9] bg-[#fffdf7] text-[#536158] transition hover:bg-white hover:text-[#173d2b]" aria-label="Sign out"><LogOut className="size-4" /></button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#355543] bg-[#173d2b] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_470px] lg:items-center lg:px-8 lg:py-10">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#dfff64]">Turn source material into accountable work</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-.045em] sm:text-5xl">Your project, organized<br className="hidden sm:block" /> in one scan.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#c7d4ca]">Upload a brief or Telegram export. TaskGoblin extracts the work, highlights what is missing, and builds the board for you.</p>
          </div>
          <label className="group flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-[#8da660] bg-white/8 p-5 transition hover:border-[#dfff64] hover:bg-white/12">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#dfff64] text-[#173d2b]">{isImporting ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{isImporting ? "Scanning your project…" : "Upload project source"}</span>
              <span className="mt-1 block truncate text-xs text-[#b9c9bd]">{fileName === "Demo import" ? "PDF, DOCX, TXT, MD, Telegram JSON or ZIP" : fileName}</span>
            </span>
            <span className="hidden rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-[#dfff64] sm:block">Choose file</span>
            <input className="sr-only" type="file" accept=".pdf,.docx,.md,.txt,.json,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain,application/json,application/zip" onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </section>

      <div className="border-b border-[#d8d3c5] bg-[#ece8dc]">
        <div className="mx-auto flex max-w-[1500px] items-start gap-3 px-4 py-3 text-sm sm:items-center sm:px-6 lg:px-8">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#66852c] sm:mt-0" />
          <p className="min-w-0 flex-1 text-[#536158]">{importStatus}</p>
          <span className="hidden shrink-0 text-xs font-bold text-[#657168] md:block">{scan.tasks.length} tasks · {scan.risks.length} risks · {scan.questions.length} questions</span>
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#66852c]">Project overview</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.035em] sm:text-3xl">The Goblin&apos;s read</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#657168]">{scan.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Health" value={scan.projectHealth.label} />
            <Metric label="Score" value={`${scan.projectHealth.score}`} />
            <Metric label="Unassigned" value={String(scan.tasks.filter((task) => !task.owner).length)} />
            <Metric label="Blocked" value={String(scan.blockers.length)} />
          </div>
        </div>

        {scan.risks.length > 0 ? (
          <div className="mb-6 flex gap-3 rounded-2xl border border-[#e6c46d] bg-[#fff6d9] p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#9a6510]" />
            <div><p className="text-sm font-bold">Needs attention: {scan.risks[0].message}</p><p className="mt-1 text-xs leading-5 text-[#755d36]">{scan.risks[0].reason ?? scan.projectHealth.explanation}{scan.risks.length > 1 ? ` · ${scan.risks.length - 1} more risk${scan.risks.length > 2 ? "s" : ""}` : ""}</p></div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-black">Task board</h2><p className="text-xs text-[#657168]">Select a card to review or update it.</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {LANES.map((lane) => {
                const laneTasks = scan.tasks.filter((task) => task.status === lane.id);
                return (
                  <section key={lane.id} className="min-h-40 rounded-2xl border border-[#d8d3c5] bg-[#ebe7da]/75 p-3">
                    <div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-sm font-black">{lane.title}</h3><p className="text-[11px] text-[#778078]">{lane.helper}</p></div><span className="rounded-full bg-[#d8d3c5] px-2 py-0.5 text-[10px] font-black">{laneTasks.length}</span></div>
                    <div className="space-y-2">
                      {laneTasks.map((task) => (
                        <button key={task.id} className={`w-full rounded-xl border bg-[#fffdf7] p-3 text-left transition hover:border-[#799636] hover:shadow-sm ${selectedTaskId === task.id ? "border-[#799636] ring-2 ring-[#dfff64]" : "border-[#d8d3c5]"}`} onClick={() => { setSelectedTaskId(task.id); void generateReminder(task); }}>
                          <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-bold leading-5">{task.title}</h4><span className={priorityClass(task.priority)}>{task.priority}</span></div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#657168]">{task.description}</p>
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#ebe7da] pt-2 text-[11px] text-[#657168]"><span className={task.owner ? "" : "font-bold text-[#9a6510]"}>{task.owner ?? "Needs owner"}</span><span>{task.deadline ?? "No due date"}</span></div>
                        </button>
                      ))}
                      {laneTasks.length === 0 ? <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-[#cec9ba] text-xs text-[#969c96]">Nothing here</div> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {selectedTask ? (
              <Card className="bg-[#fffdf7]">
                <CardHeader className="border-b border-[#ebe7da] pb-4"><div className="flex items-center justify-between gap-3"><span className={priorityClass(selectedTask.priority)}>{selectedTask.priority}</span><span className="text-xs font-medium text-[#657168]">{Math.round(selectedTask.confidence * 100)}% confidence</span></div><CardTitle className="mt-2 text-lg font-black">{selectedTask.title}</CardTitle><CardDescription>{selectedTask.description}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-[#536158]">Owner<input className="mt-1.5 h-10 w-full rounded-xl border border-[#c9c5b9] bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#9fbd42]" value={selectedTask.owner ?? ""} placeholder="Assign owner" onChange={(event) => updateTask(selectedTask.id, { owner: event.target.value || null })} /></label>
                    <label className="text-xs font-bold text-[#536158]">Status<select className="mt-1.5 h-10 w-full rounded-xl border border-[#c9c5b9] bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#9fbd42]" value={selectedTask.status} onChange={(event) => updateTask(selectedTask.id, { status: event.target.value as TaskStatus })}>{LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label>
                  </div>
                  <label className="block text-xs font-bold text-[#536158]">Due date or label<input className="mt-1.5 h-10 w-full rounded-xl border border-[#c9c5b9] bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#9fbd42]" value={selectedTask.deadline ?? ""} placeholder="e.g. Friday 5 PM" onChange={(event) => updateTask(selectedTask.id, { deadline: event.target.value || null })} /></label>
                  {selectedTask.sourceSnippet ? <details className="rounded-xl bg-[#f1eee4] p-3"><summary className="cursor-pointer text-xs font-bold text-[#536158]">View source context</summary><p className="mt-2 text-xs leading-5 text-[#657168]">“{selectedTask.sourceSnippet}”</p></details> : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-[#355543] bg-[#173d2b] text-white">
              <CardHeader><CardTitle className="flex items-center gap-2 font-black"><Send className="size-4 text-[#dfff64]" /> Send a nudge</CardTitle><CardDescription className="text-[#b9c9bd]">Generate a follow-up for the selected task.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">{TONES.map((nextTone) => <button key={nextTone} type="button" className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${tone === nextTone ? "bg-[#dfff64] text-[#173d2b]" : "bg-white/10 text-white hover:bg-white/15"}`} onClick={() => { setTone(nextTone); if (selectedTask) void generateReminder(selectedTask, nextTone); }}>{nextTone}</button>)}</div>
                <div className="rounded-xl border border-white/10 bg-white/8 p-3 text-sm leading-6 text-[#edf2ee]">{reminderMessage}</div>
                <Button className="w-full" type="button" disabled={!selectedTask} onClick={() => selectedTask && void scheduleReminder(selectedTask)}><CalendarClock className="size-4" /> Stage Telegram reminder</Button>
                <p className="text-[11px] leading-4 text-[#9fb1a3]">Staging saves the reminder. Live delivery requires a connected Telegram bot.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}

function LandingPage({
  authMessage,
  oauthConfigured,
  onOAuth,
  onDemo,
}: {
  authMessage: string;
  oauthConfigured: boolean;
  onOAuth: (provider: Provider) => void;
  onDemo: () => void;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07140e] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,rgb(223_255_100_/_0.055)_49%,transparent_50%),linear-gradient(25deg,transparent_0%,transparent_48%,rgb(134_92_246_/_0.09)_49%,transparent_50%)] [background-size:420px_280px,520px_360px]" />
      <div className="pointer-events-none fixed left-1/2 top-40 size-[700px] -translate-x-1/2 rounded-full bg-[#5936ba]/20 blur-[150px]" />
      <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandMarkDark />
        <nav className="flex items-center gap-2 sm:gap-5">
          <a href="#how-it-works" className="hidden text-sm font-semibold text-white/60 transition hover:text-white sm:block">How it works</a>
          <a href="/taskgoblin-pitch.html" className="hidden text-sm font-semibold text-white/60 transition hover:text-white sm:block">Pitch deck</a>
          <button onClick={onDemo} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">Open demo</button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_390px] lg:py-16">
        <div className="max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dfff64]/20 bg-[#dfff64]/8 px-3 py-1.5 text-xs font-bold text-[#dfff64]"><WandSparkles className="size-3.5" /> AI project accountability, without the busywork</div>
          <h1 className="text-[clamp(3.4rem,7.5vw,7.4rem)] font-black leading-[.9] tracking-[-.07em]">
            Turn project chaos into<br />
            <span className="bg-gradient-to-r from-[#dfff64] via-[#63d9b1] to-[#9d72ff] bg-clip-text text-transparent">work that gets done.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60 sm:text-xl">Upload a project brief or Telegram export. TaskGoblin finds the tasks, owners, deadlines, and risks—then builds your team&apos;s board in seconds.</p>
          <div id="how-it-works" className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
            <LandingStep icon={<FileText className="size-4" />} label="Upload a brief" />
            <LandingStep icon={<WandSparkles className="size-4" />} label="AI maps the work" />
            <LandingStep icon={<MessageSquareText className="size-4" />} label="Review and nudge" />
          </div>
        </div>

        <aside className="rounded-3xl border border-white/12 bg-white/[.065] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="mb-6 grid size-12 place-items-center overflow-hidden rounded-2xl border border-[#dfff64]/40 bg-[#dfff64]"><Image src="/brand/taskgoblin-logo.png" alt="" width={48} height={48} className="size-12 object-contain" /></div>
          <h2 className="text-2xl font-black tracking-[-.035em]">Enter your workspace</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">Sign in to save projects, collaborate with your team, and keep every quest moving.</p>
          <div className="mt-6 space-y-3">
            <button onClick={() => onOAuth("google")} disabled={!oauthConfigured} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white font-bold text-[#142018] transition hover:bg-[#f0f0ec] disabled:cursor-not-allowed disabled:opacity-50"><span className="grid size-5 place-items-center rounded-full border border-[#d5d5d5] text-xs font-black text-[#4285f4]">G</span> Continue with Google</button>
            <button onClick={() => onOAuth("github")} disabled={!oauthConfigured} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"><svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.98 10.98 0 0 1 12 6.12c.98 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.24c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg> Continue with GitHub</button>
          </div>
          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-white/30"><span className="h-px flex-1 bg-white/10" /> or explore first <span className="h-px flex-1 bg-white/10" /></div>
          <button onClick={onDemo} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#dfff64] transition hover:bg-[#dfff64]/8">Open demo workspace <ArrowRight className="size-4" /></button>
          {!oauthConfigured ? <p className="mt-4 rounded-xl border border-[#ffbd59]/20 bg-[#ffbd59]/8 p-3 text-xs leading-5 text-[#ffd99b]">Supabase Auth is not configured yet. Demo mode is available.</p> : null}
          {authMessage ? <p className="mt-4 text-center text-xs leading-5 text-[#ffb4a9]">{authMessage}</p> : null}
          <p className="mt-5 text-center text-[11px] leading-5 text-white/30">By continuing, you agree to keep your goblin responsibly supervised.</p>
        </aside>
      </section>
    </main>
  );
}

function LandingStep({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold text-white/70"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#dfff64]/10 text-[#dfff64]">{icon}</span>{label}</div>;
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#07140e]"><div className="flex items-center gap-3 text-sm font-bold text-white/60"><Loader2 className="size-5 animate-spin text-[#dfff64]" /> Waking the Goblin…</div></main>;
}

function BrandMarkDark() {
  return (
    <a href="#" className="flex items-center gap-2.5" aria-label="TaskGoblin home">
      <span className="grid size-10 place-items-center overflow-hidden rounded-xl border border-[#dfff64]/40 bg-[#dfff64]"><Image src="/brand/taskgoblin-logo.png" alt="" width={40} height={40} className="size-10 object-contain" priority /></span>
      <span className="text-xl font-black tracking-[-.045em] text-white">Task<span className="text-[#dfff64]">Goblin</span></span>
    </a>
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

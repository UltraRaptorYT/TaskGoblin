"use client";

import type { Provider, User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

import { LandingPage } from "@/app/_components/taskgoblin/landing-page";
import { LoadingScreen } from "@/app/_components/taskgoblin/loading-screen";
import { ProjectOverview } from "@/app/_components/taskgoblin/project-overview";
import { TaskBoard } from "@/app/_components/taskgoblin/task-board";
import { TaskSidebar } from "@/app/_components/taskgoblin/task-sidebar";
import {
  ImportHero,
  ImportStatus,
  WorkspaceHeader,
} from "@/app/_components/taskgoblin/workspace-shell";
import { createMockScanResult } from "@/lib/mock-scan";
import { demoProjectScanKey, readDemoProjects, writeDemoProjects } from "@/lib/demo-projects";
import { getSupabasePublic } from "@/lib/supabase-public";
import type {
  AccountabilityTone,
  TaskItem,
  TaskScanResult,
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

const EMPTY_PROJECT_SCAN: TaskScanResult = {
  ...DEFAULT_SCAN,
  summary: "Add a project brief or Telegram chat to build this project's board.",
  projectHealth: { score: 0, label: "Not scanned", explanation: "No project sources have been added yet." },
  tasks: [], decisions: [], questions: [], risks: [], blockers: [],
};

export default function TaskGoblinApp({
  initialDemoMode = false,
  demoProjectId,
}: {
  initialDemoMode?: boolean;
  demoProjectId?: string;
}) {
  const initialScan = initialDemoMode && demoProjectId ? EMPTY_PROJECT_SCAN : DEFAULT_SCAN;
  const [scan, setScan] = useState<TaskScanResult>(initialScan);
  const [selectedTaskId, setSelectedTaskId] = useState(initialScan.tasks[0]?.id);
  const [projectName, setProjectName] = useState("Project workspace");
  const [tone, setTone] = useState<AccountabilityTone>("friendly");
  const [fileName, setFileName] = useState("Demo import");
  const [importStatus, setImportStatus] = useState(
    "Upload a project brief or Telegram export to replace this demo scan.",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(
    initialScan.accountabilitySuggestions.friendly,
  );
  const supabase = useMemo(() => getSupabasePublic(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [demoStorageReady, setDemoStorageReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!initialDemoMode || !demoProjectId) return;

    const restoreTimer = window.setTimeout(() => {
      try {
        const project = readDemoProjects().find((item) => item.id === demoProjectId);
        if (project) setProjectName(project.name);
        const stored = window.localStorage.getItem(demoProjectScanKey(demoProjectId));
        if (stored) {
          const savedScan = JSON.parse(stored) as TaskScanResult;
          if (Array.isArray(savedScan.tasks)) {
            setScan(savedScan);
            setSelectedTaskId(savedScan.tasks[0]?.id);
            setReminderMessage(savedScan.accountabilitySuggestions.friendly);
            setImportStatus("Restored your saved demo board from this browser.");
          }
        }
      } catch {
        window.localStorage.removeItem(demoProjectScanKey(demoProjectId));
      } finally {
        setDemoStorageReady(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [demoProjectId, initialDemoMode]);

  useEffect(() => {
    if (!initialDemoMode || !demoProjectId || !demoStorageReady) return;
    try {
      window.localStorage.setItem(demoProjectScanKey(demoProjectId), JSON.stringify(scan));
      writeDemoProjects(readDemoProjects().map((project) => project.id === demoProjectId ? {
        ...project,
        taskCount: scan.tasks.length,
        updatedAt: new Date().toISOString(),
      } : project));
    } catch {}
  }, [demoProjectId, demoStorageReady, initialDemoMode, scan]);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (window.location.hash.includes("access_token=")) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const selectedTask = useMemo(
    () => scan.tasks.find((task) => task.id === selectedTaskId) ?? scan.tasks[0],
    [scan.tasks, selectedTaskId],
  );

  async function handleFileUpload(file: File | null) {
    if (!file) return;

    setIsImporting(true);
    setFileName(file.name);
    const isTelegramExport = /\.(json|zip)$/i.test(file.name);
    setImportStatus(
      isTelegramExport
        ? "Importing Telegram export and asking the Goblin to scan..."
        : "Reading the project brief and mapping the quests...",
    );

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        isTelegramExport ? "/api/imports/telegram" : "/api/imports/brief",
        { method: "POST", body: formData },
      );
      const payload = (await response.json()) as TelegramImportResponse & {
        error?: string;
        usedMock?: boolean;
      };

      if (!response.ok) throw new Error(payload.error ?? "Telegram import failed.");

      setScan(payload.scan);
      setSelectedTaskId(payload.scan.tasks[0]?.id);
      setReminderMessage(payload.scan.accountabilitySuggestions[tone]);
      setImportStatus(
        `${payload.normalized.chatName}: ${payload.normalized.messageCount} source sections${isTelegramExport ? `, ${payload.normalized.participantCount} participants` : ""}. ${
          payload.persisted ? "Saved to Supabase." : "Running in demo mode."
        } ${payload.usedMock ? "Mock scan used." : "Gemini scan used."}`,
      );
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  function updateTask(taskId: string, patch: Partial<TaskItem>) {
    setScan((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    }));

    if (!initialDemoMode) {
      void fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setAuthMessage(error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setDemoMode(false);
    setUser(null);
    if (initialDemoMode) window.location.assign("/demo");
  }

  if (!authReady) return <LoadingScreen />;

  if (!user && !demoMode) {
    return (
      <LandingPage
        authMessage={authMessage}
        oauthConfigured={Boolean(supabase)}
        onOAuth={(provider) => void signInWithOAuth(provider)}
        onDemo={() => window.location.assign("/demo")}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <WorkspaceHeader identity={user?.email ?? "Demo workspace"} projectName={initialDemoMode ? projectName : undefined} onSignOut={() => void signOut()} />
      <ImportHero projectName={initialDemoMode ? projectName : undefined} fileName={fileName} isImporting={isImporting} onFileUpload={(file) => void handleFileUpload(file)} />
      <ImportStatus status={importStatus} scan={scan} />

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProjectOverview scan={scan} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <TaskBoard
            tasks={scan.tasks}
            selectedTaskId={selectedTaskId}
            onMoveTask={(taskId, status) => updateTask(taskId, { status })}
            onSelectTask={(task) => {
              setSelectedTaskId(task.id);
              void generateReminder(task);
            }}
          />
          <TaskSidebar
            selectedTask={selectedTask}
            tone={tone}
            reminderMessage={reminderMessage}
            onUpdateTask={updateTask}
            onToneChange={(nextTone) => {
              setTone(nextTone);
              if (selectedTask) void generateReminder(selectedTask, nextTone);
            }}
            onScheduleReminder={(task) => void scheduleReminder(task)}
          />
        </div>
      </section>
    </main>
  );
}

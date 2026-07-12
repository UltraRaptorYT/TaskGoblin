"use client";

import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Columns3, ListTodo, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { TaskItem, TaskScanResult, TaskStatus } from "@/lib/taskgoblin-types";
import { TaskBoard } from "./task-board";
import { priorityClass } from "./shared";

type View = "quests" | "board" | "calendar";

type Props = {
  scan: TaskScanResult;
  selectedTaskId?: string;
  onSelectTask: (task: TaskItem) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
};

export function TaskWorkspace({ scan, selectedTaskId, onSelectTask, onMoveTask, onToggleSubtask }: Props) {
  const [view, setView] = useState<View>("quests");
  const active = scan.tasks.filter((task) => task.status !== "done");
  const done = scan.tasks.filter((task) => task.status === "done").length;
  const blocked = active.filter((task) => task.status === "blocked" || task.status === "overdue").length;
  const completion = scan.tasks.length ? Math.round((done / scan.tasks.length) * 100) : 0;

  return (
    <div className="min-w-0">
      <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Stat label="Open quests" value={active.length} helper={`${done} completed`} />
        <Stat label="In progress" value={scan.tasks.filter((task) => task.status === "doing").length} helper="Across the team" />
        <Stat label="Blocked" value={blocked} helper={blocked ? "Needs attention" : "Nothing stuck"} danger={blocked > 0} />
        <Stat label="Project done" value={`${completion}%`} helper={`${scan.tasks.length} total quests`} progress={completion} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black tracking-[-.02em]">Project work</h2>
            <p className="text-xs text-muted-foreground">One plan, three useful views.</p>
          </div>
          <div className="inline-flex w-fit rounded-lg border bg-muted p-1">
            <ViewButton active={view === "quests"} icon={<ListTodo className="size-3.5" />} onClick={() => setView("quests")}>My quests</ViewButton>
            <ViewButton active={view === "board"} icon={<Columns3 className="size-3.5" />} onClick={() => setView("board")}>Board</ViewButton>
            <ViewButton active={view === "calendar"} icon={<CalendarDays className="size-3.5" />} onClick={() => setView("calendar")}>Calendar</ViewButton>
          </div>
        </div>

        {view === "quests" ? <QuestList tasks={scan.tasks} selectedTaskId={selectedTaskId} onSelect={onSelectTask} onMoveTask={onMoveTask} onToggleSubtask={onToggleSubtask} /> : null}
        {view === "board" ? <div className="p-3"><TaskBoard tasks={scan.tasks} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} onMoveTask={onMoveTask} compact /></div> : null}
        {view === "calendar" ? <CalendarView tasks={scan.tasks} onSelect={onSelectTask} /> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, helper, danger, progress }: { label: string; value: string | number; helper: string; danger?: boolean; progress?: number }) {
  return <div className="rounded-xl border bg-card px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><span className={`text-2xl font-black tracking-[-.04em] ${danger ? "text-amber-600" : ""}`}>{value}</span><span className="text-[10px] text-muted-foreground">{helper}</span></div>{progress !== undefined ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div> : null}</div>;
}

function ViewButton({ active, icon, children, onClick }: { active: boolean; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{icon}{children}</button>;
}

function QuestList({ tasks, selectedTaskId, onSelect, onMoveTask, onToggleSubtask }: { tasks: TaskItem[]; selectedTaskId?: string; onSelect: (task: TaskItem) => void; onMoveTask: (taskId: string, status: TaskStatus) => void; onToggleSubtask: (taskId: string, subtaskId: string) => void }) {
  return <div className="divide-y">{tasks.map((task) => {
    const subtasks = task.subtasks ?? [];
    const completed = subtasks.filter((item) => item.completed).length;
    return <div key={task.id} className={`group px-4 py-3 transition hover:bg-muted/45 ${selectedTaskId === task.id ? "bg-[#eff5d9]" : ""}`}>
      <div className="flex cursor-pointer items-start gap-3" onClick={() => onSelect(task)}>
        <button type="button" className="mt-0.5 text-muted-foreground" onClick={(event) => { event.stopPropagation(); onMoveTask(task.id, task.status === "done" ? "todo" : "done"); }}>{task.status === "done" ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4" />}</button>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{task.title}</h3><span className={priorityClass(task.priority)}>{task.priority}</span>{task.status === "blocked" ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><AlertTriangle className="size-3" /> Blocked</span> : null}</div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description}</p></div>
        <div className="hidden shrink-0 text-right sm:block"><p className="text-xs font-semibold">{task.owner ?? "Unassigned"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{task.deadline ?? "No due date"}</p></div>
      </div>
      {subtasks.length ? <div className="ml-7 mt-2 rounded-lg border bg-background/65 px-3 py-1.5"><div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground"><span>{completed}/{subtasks.length} steps</span><span>{Math.round((completed / subtasks.length) * 100)}%</span></div>{subtasks.map((subtask) => <button key={subtask.id} type="button" onClick={() => onToggleSubtask(task.id, subtask.id)} className="flex w-full items-center gap-2 py-1 text-left text-xs hover:text-primary">{subtask.completed ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Circle className="size-3.5 text-muted-foreground" />}<span className={subtask.completed ? "text-muted-foreground line-through" : ""}>{subtask.title}</span></button>)}</div> : null}
    </div>;
  })}{tasks.length === 0 ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Upload a source to generate your first quests.</div> : null}</div>;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function CalendarView({ tasks, onSelect }: { tasks: TaskItem[]; onSelect: (task: TaskItem) => void }) {
  const byDay = useMemo(() => Object.fromEntries(DAYS.map((day) => [day, tasks.filter((task) => task.deadline?.toLowerCase().includes(day.toLowerCase()))])), [tasks]);
  const unscheduled = tasks.filter((task) => !DAYS.some((day) => task.deadline?.toLowerCase().includes(day.toLowerCase())));
  return <div className="p-4"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-black">Weekly task plan</h3><p className="text-xs text-muted-foreground">Deadlines and automatic reminder timing in one place.</p></div><span className="pill inline-flex items-center gap-1.5 rounded-full bg-[#eff5d9] px-3 py-1 text-[11px] font-bold text-primary"><Sparkles className="size-3" /> Auto-plan</span></div><div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-7">{DAYS.map((day) => <div key={day} className="min-h-48 bg-card p-2"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{day.slice(0, 3)}</p><div className="space-y-2">{byDay[day].map((task: TaskItem) => <button key={task.id} type="button" onClick={() => onSelect(task)} className="w-full rounded-lg border-l-4 border-l-primary bg-muted p-2 text-left text-[11px] font-bold leading-4 hover:bg-secondary">{task.title}<span className="mt-1 block font-normal text-muted-foreground">{task.deadline}</span></button>)}</div></div>)}</div>{unscheduled.length ? <div className="mt-4"><p className="mb-2 text-xs font-bold text-muted-foreground">Unscheduled quests</p><div className="flex flex-wrap gap-2">{unscheduled.map((task) => <button key={task.id} type="button" onClick={() => onSelect(task)} className="rounded-lg border bg-card px-3 py-2 text-xs font-semibold hover:border-primary">{task.title}</button>)}</div></div> : null}</div>;
}

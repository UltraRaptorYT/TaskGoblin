import { CalendarClock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountabilityTone, TaskItem, TaskStatus } from "@/lib/taskgoblin-types";
import { priorityClass } from "./shared";
import { TASK_LANES } from "./task-board";

const TONES: AccountabilityTone[] = ["professional", "friendly", "goblin"];

type TaskSidebarProps = {
  selectedTask?: TaskItem;
  tone: AccountabilityTone;
  reminderMessage: string;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => void;
  onToneChange: (tone: AccountabilityTone) => void;
  onScheduleReminder: (task: TaskItem) => void;
};

export function TaskSidebar({ selectedTask, tone, reminderMessage, onUpdateTask, onToneChange, onScheduleReminder }: TaskSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      {selectedTask ? (
        <Card className="bg-card">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <span className={priorityClass(selectedTask.priority)}>{selectedTask.priority}</span>
              <span className="text-xs font-medium text-muted-foreground">{Math.round(selectedTask.confidence * 100)}% confidence</span>
            </div>
            <CardTitle className="mt-2 text-lg font-black">{selectedTask.title}</CardTitle>
            <CardDescription>{selectedTask.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-muted-foreground">
                Owner
                <input className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring" value={selectedTask.owner ?? ""} placeholder="Assign owner" onChange={(event) => onUpdateTask(selectedTask.id, { owner: event.target.value || null })} />
              </label>
              <label className="text-xs font-bold text-muted-foreground">
                Status
                <select className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring" value={selectedTask.status} onChange={(event) => onUpdateTask(selectedTask.id, { status: event.target.value as TaskStatus })}>
                  {TASK_LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold text-muted-foreground">
              Due date or label
              <input className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring" value={selectedTask.deadline ?? ""} placeholder="e.g. Friday 5 PM" onChange={(event) => onUpdateTask(selectedTask.id, { deadline: event.target.value || null })} />
            </label>
            {selectedTask.sourceSnippet ? (
              <details className="rounded-xl bg-muted p-3">
                <summary className="cursor-pointer text-xs font-bold text-muted-foreground">View source context</summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">“{selectedTask.sourceSnippet}”</p>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#355543] bg-[#173d2b] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black"><Send className="size-4 text-[#dfff64]" /> Send a nudge</CardTitle>
          <CardDescription className="text-[#b9c9bd]">Generate a follow-up for the selected task.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {TONES.map((nextTone) => (
              <button key={nextTone} type="button" className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${tone === nextTone ? "bg-[#dfff64] text-[#173d2b]" : "bg-white/10 text-white hover:bg-white/15"}`} onClick={() => onToneChange(nextTone)}>{nextTone}</button>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/8 p-3 text-sm leading-6 text-[#edf2ee]">{reminderMessage}</div>
          <Button className="w-full" type="button" disabled={!selectedTask} onClick={() => selectedTask && onScheduleReminder(selectedTask)}>
            <CalendarClock className="size-4" /> Stage Telegram reminder
          </Button>
          <p className="text-[11px] leading-4 text-[#9fb1a3]">Staging saves the reminder. Live delivery requires a connected Telegram bot.</p>
        </CardContent>
      </Card>
    </aside>
  );
}

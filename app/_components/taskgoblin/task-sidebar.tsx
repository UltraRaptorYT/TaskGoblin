"use client";

import { BellRing, Loader2, Send, UserPlus, Users, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountabilityTone, TaskItem, TaskStatus } from "@/lib/taskgoblin-types";
import { priorityClass } from "./shared";
import { TASK_LANES } from "./task-board";

const TONES: AccountabilityTone[] = ["professional", "friendly", "goblin"];

type TaskSidebarProps = {
  selectedTask?: TaskItem;
  teamMembers: string[];
  tone: AccountabilityTone;
  reminderMessage: string;
  isSendingReminder: boolean;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => void;
  onAddTeamMember: (name: string) => void;
  onRemoveTeamMember: (name: string) => void;
  onToneChange: (tone: AccountabilityTone) => void;
  onScheduleReminder: (task: TaskItem) => void;
  onAutoReminderChange: (task: TaskItem, enabled: boolean, leadMinutes: number) => void;
};

export function TaskSidebar({ selectedTask, teamMembers, tone, reminderMessage, isSendingReminder, onUpdateTask, onAddTeamMember, onRemoveTeamMember, onToneChange, onScheduleReminder, onAutoReminderChange }: TaskSidebarProps) {
  const [newMember, setNewMember] = useState("");
  const ownerOptions = [
    ...new Set([
      ...teamMembers,
      ...(selectedTask?.owner ? [selectedTask.owner] : []),
    ]),
  ];

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMember.trim()) return;
    onAddTeamMember(newMember);
    setNewMember("");
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <details className="group rounded-2xl border border-border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-black"><Users className="size-4 text-primary" /> Team members</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{teamMembers.length}</span>
        </summary>
        <div className="border-t border-border p-4">
          <form className="flex gap-2" onSubmit={submitMember}>
            <input className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={newMember} placeholder="Add teammate" aria-label="Team member name" onChange={(event) => setNewMember(event.target.value)} />
            <Button type="submit" aria-label="Add team member"><UserPlus className="size-4" /> Add</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <span key={member} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[9px] font-black text-primary-foreground">{member.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                {member}
                <button type="button" className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${member}`} onClick={() => onRemoveTeamMember(member)}><X className="size-3" /></button>
              </span>
            ))}
            {teamMembers.length === 0 ? <p className="text-xs text-muted-foreground">Add teammates, then assign tasks from the owner dropdown.</p> : null}
          </div>
        </div>
      </details>

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
                <select className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring" value={selectedTask.owner ?? ""} onChange={(event) => onUpdateTask(selectedTask.id, { owner: event.target.value || null })}>
                  <option value="">Unassigned</option>
                  {ownerOptions.map((member) => <option key={member} value={member}>{member}</option>)}
                </select>
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
            <div className="rounded-xl border bg-muted/55 p-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="flex items-center gap-1.5 text-xs font-black"><BellRing className="size-3.5 text-primary" /> Automatic reminder</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Queue a Telegram nudge before the due date.</p></div>
                <button type="button" role="switch" aria-checked={Boolean(selectedTask.autoReminder)} className={`relative h-6 w-11 rounded-full transition ${selectedTask.autoReminder ? "bg-primary" : "bg-border"}`} onClick={() => onAutoReminderChange(selectedTask, !selectedTask.autoReminder, selectedTask.reminderLeadMinutes ?? 1440)}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${selectedTask.autoReminder ? "left-6" : "left-1"}`} /></button>
              </div>
              <select className="mt-3 h-9 w-full rounded-lg border bg-background px-2 text-xs" value={selectedTask.reminderLeadMinutes ?? 1440} onChange={(event) => onAutoReminderChange(selectedTask, true, Number(event.target.value))}>
                <option value={60}>1 hour before</option><option value={360}>6 hours before</option><option value={1440}>1 day before</option><option value={2880}>2 days before</option>
              </select>
            </div>
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
          <div className={`rounded-xl border border-white/10 bg-white/8 p-3 text-sm leading-6 ${reminderMessage ? "text-[#edf2ee]" : "text-[#9fb1a3]"}`}>
            {isSendingReminder
              ? "The Goblin is consulting the ancient ledger..."
              : reminderMessage || "A fresh reminder will be written only when you click send."}
          </div>
          <Button className="w-full" type="button" disabled={!selectedTask || isSendingReminder} onClick={() => selectedTask && onScheduleReminder(selectedTask)}>
            {isSendingReminder ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isSendingReminder ? "Generating and sending..." : "Generate & send reminder"}
          </Button>
          <p className="text-[11px] leading-4 text-[#9fb1a3]">Send now creates a fresh AI message. Automatic reminders are queued against the task due date.</p>
        </CardContent>
      </Card>
    </aside>
  );
}

"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  List,
  Pencil,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TelegramProjectTask } from "@/lib/telegram-web-data";

type ProjectMember = {
  id: string;
  displayName: string;
  role: string;
};

type ProjectTaskWorkspaceProps = {
  projectId: string;
  initialTasks: TelegramProjectTask[];
  members: ProjectMember[];
  canEdit: boolean;
};

type ViewMode = "list" | "board" | "calendar";

type EditorDraft = {
  id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  ownerTelegramUserId: string;
  dueAt: string;
};

const statuses = [
  { id: "backlog", label: "Backlog", accent: "bg-white/30" },
  { id: "todo", label: "To do", accent: "bg-sky-300" },
  { id: "doing", label: "In progress", accent: "bg-amber-300" },
  { id: "blocked", label: "Blocked", accent: "bg-rose-400" },
  { id: "overdue", label: "Overdue", accent: "bg-orange-400" },
  { id: "done", label: "Done", accent: "bg-[#dfff64]" },
] as const;

const priorities = ["low", "medium", "high", "urgent"] as const;

export function ProjectTaskWorkspace({
  projectId,
  initialTasks,
  members,
  canEdit,
}: ProjectTaskWorkspaceProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<ViewMode>("board");
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const firstDeadline = initialTasks.find((task) => task.dueAt)?.dueAt;
    const date = firstDeadline ? new Date(firstDeadline) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return a.title.localeCompare(b.title);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt.localeCompare(b.dueAt);
      }),
    [tasks],
  );

  function openEditor(task: TelegramProjectTask) {
    if (!canEdit) return;
    setError(null);
    setEditor({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      ownerTelegramUserId: task.ownerTelegramUserId ?? "",
      dueAt: toDateTimeLocal(task.dueAt),
    });
  }

  function openCreate() {
    if (!canEdit) return;
    setError(null);
    setEditor({
      id: null,
      title: "",
      description: "",
      status: "backlog",
      priority: "medium",
      ownerTelegramUserId: "",
      dueAt: "",
    });
  }

  async function createTask(input: Record<string, string | null>) {
    setError(null);
    const response = await fetch(
      `/api/dashboard/projects/${projectId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { task?: TelegramProjectTask; error?: string }
      | null;
    if (!response.ok || !payload?.task) {
      throw new Error(payload?.error ?? "Task creation failed.");
    }
    setTasks((current) => [payload.task!, ...current]);
    router.refresh();
  }

  async function updateTask(
    taskId: string,
    patch: Record<string, string | null>,
  ) {
    setError(null);
    const response = await fetch(
      `/api/dashboard/projects/${projectId}/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { task?: TelegramProjectTask; error?: string }
      | null;
    if (!response.ok || !payload?.task) {
      throw new Error(payload?.error ?? "Task update failed.");
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? payload.task! : task)),
    );
    router.refresh();
  }

  async function saveEditor() {
    if (!editor || !canEdit) return;
    setSaving(true);
    try {
      const input = {
        title: editor.title,
        description: editor.description || null,
        status: editor.status,
        priority: editor.priority,
        ownerTelegramUserId: editor.ownerTelegramUserId || null,
        dueAt: editor.dueAt
          ? new Date(editor.dueAt).toISOString()
          : null,
      };
      if (editor.id) {
        await updateTask(editor.id, input);
      } else {
        await createTask(input);
      }
      setEditor(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Task update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(taskId: string, status: string) {
    if (!canEdit) return;
    const previous = tasks;
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
    try {
      await updateTask(taskId, { status });
    } catch (moveError) {
      setTasks(previous);
      setError(
        moveError instanceof Error ? moveError.message : "Task update failed.",
      );
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#102219]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-[-.035em]">
              Project tasks
            </h2>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-black text-[#dfff64]">
              {tasks.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#91a096]">
            {canEdit
              ? "Telegram admins can drag tasks or open one to edit its details."
              : "Read-only view. Telegram group owners and admins can make changes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#dfff64] px-3.5 py-2.5 text-xs font-black text-[#173d2b] transition hover:bg-[#e8ff8f]"
            >
              <Plus className="size-4" strokeWidth={3} />
              New task
            </button>
          ) : null}
          <div className="flex rounded-xl border border-white/10 bg-black/15 p-1">
            {(
              [
                ["list", "List", List],
                ["board", "Kanban", Columns3],
                ["calendar", "Calendar", CalendarDays],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                  view === id
                    ? "bg-[#dfff64] text-[#173d2b]"
                    : "text-[#aabbb0] hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-b border-rose-300/15 bg-rose-300/8 px-6 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Columns3 className="mx-auto size-7 text-[#718077]" />
          <p className="mt-3 font-bold">No confirmed tasks yet</p>
          <p className="mt-1 text-sm text-[#91a096]">
            TaskGoblin will show work here after the group confirms it.
          </p>
        </div>
      ) : view === "list" ? (
        <TaskList tasks={sortedTasks} canEdit={canEdit} onEdit={openEditor} />
      ) : view === "calendar" ? (
        <TaskCalendar
          tasks={tasks}
          month={calendarMonth}
          canEdit={canEdit}
          onEdit={openEditor}
          onPrevious={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() - 1,
                1,
              ),
            )
          }
          onNext={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() + 1,
                1,
              ),
            )
          }
        />
      ) : (
        <TaskBoard
          tasks={tasks}
          canEdit={canEdit}
          onEdit={openEditor}
          onMove={moveTask}
        />
      )}

      {editor ? (
        <TaskEditor
          draft={editor}
          members={members}
          saving={saving}
          error={error}
          onChange={setEditor}
          onClose={() => {
            setEditor(null);
            setError(null);
          }}
          onSave={saveEditor}
        />
      ) : null}
    </section>
  );
}

function TaskList({
  tasks,
  canEdit,
  onEdit,
}: {
  tasks: TelegramProjectTask[];
  canEdit: boolean;
  onEdit: (task: TelegramProjectTask) => void;
}) {
  return (
    <div className="divide-y divide-white/8">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 shrink-0 rounded-full ${statusAccent(task.status)}`}
              />
              <h3
                className={`truncate font-bold ${
                  task.status === "done"
                    ? "text-[#7f8d84] line-through"
                    : ""
                }`}
              >
                {task.title}
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#91a096]">
              {task.ownerName ?? "Unassigned"}
              {task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TaskBadge label={statusLabel(task.status)} />
            <TaskBadge label={task.priority} subtle />
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg border border-white/10 text-[#aabbb0] transition hover:border-[#dfff64]/40 hover:text-[#dfff64]"
                aria-label={`Edit ${task.title}`}
              >
                <Pencil className="size-3.5" />
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function TaskBoard({
  tasks,
  canEdit,
  onEdit,
  onMove,
}: {
  tasks: TelegramProjectTask[];
  canEdit: boolean;
  onEdit: (task: TelegramProjectTask) => void;
  onMove: (taskId: string, status: string) => void;
}) {
  return (
    <div className="overflow-x-auto p-5">
      <div className="grid min-w-[1320px] grid-cols-6 gap-3">
        {statuses.map((status) => {
          const laneTasks = tasks.filter((task) => task.status === status.id);
          return (
            <section
              key={status.id}
              onDragOver={(event) => {
                if (canEdit) event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/task-id");
                if (taskId) void onMove(taskId, status.id);
              }}
              className="min-h-80 rounded-2xl border border-white/8 bg-black/15 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${status.accent}`} />
                  <h3 className="text-xs font-black uppercase tracking-[.08em]">
                    {status.label}
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#718077]">
                  {laneTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {laneTasks.map((task) => (
                  <article
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/task-id", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onEdit(task)}
                    className={`rounded-xl border border-white/10 bg-[#173025] p-3 shadow-lg shadow-black/10 transition ${
                      canEdit
                        ? "cursor-pointer hover:border-[#dfff64]/35"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {canEdit ? (
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-[#718077]" />
                      ) : null}
                      <p className="text-sm font-bold leading-5">{task.title}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#91a096]">
                      <span className="truncate">
                        {task.ownerName ?? "Unassigned"}
                      </span>
                      <span className="shrink-0 capitalize">{task.priority}</span>
                    </div>
                    {task.dueAt ? (
                      <p className="mt-2 text-[11px] font-semibold text-[#dfff64]">
                        {formatDate(task.dueAt)}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCalendar({
  tasks,
  month,
  canEdit,
  onEdit,
  onPrevious,
  onNext,
}: {
  tasks: TelegramProjectTask[];
  month: Date;
  canEdit: boolean;
  onEdit: (task: TelegramProjectTask) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const days = calendarDays(month);
  const tasksByDay = new Map<string, TelegramProjectTask[]>();
  tasks.forEach((task) => {
    if (!task.dueAt) return;
    const key = localDateKey(new Date(task.dueAt));
    tasksByDay.set(key, [...(tasksByDay.get(key) ?? []), task]);
  });
  const unscheduled = tasks.filter((task) => !task.dueAt);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevious}
          className="grid size-9 cursor-pointer place-items-center rounded-lg border border-white/10 text-[#aabbb0] hover:text-white"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h3 className="text-base font-black">
          {new Intl.DateTimeFormat("en-SG", {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h3>
        <button
          type="button"
          onClick={onNext}
          className="grid size-9 cursor-pointer place-items-center rounded-lg border border-white/10 text-[#aabbb0] hover:text-white"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/10">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border-b border-white/10 bg-black/20 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[.08em] text-[#91a096]"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const key = localDateKey(day);
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          return (
            <div
              key={key}
              className="min-h-28 border-r border-b border-white/8 p-2 last:border-r-0"
            >
              <p
                className={`text-xs font-bold ${
                  inMonth ? "text-white" : "text-[#526158]"
                }`}
              >
                {day.getDate()}
              </p>
              <div className="mt-2 space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onEdit(task)}
                    disabled={!canEdit}
                    className={`block w-full truncate rounded-md border-l-2 bg-white/[.055] px-2 py-1 text-left text-[10px] font-bold ${statusBorder(task.status)} ${
                      canEdit ? "cursor-pointer hover:bg-white/10" : ""
                    }`}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 ? (
                  <p className="text-[10px] text-[#91a096]">
                    +{dayTasks.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {unscheduled.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/12 p-4">
          <p className="text-xs font-black uppercase tracking-[.08em] text-[#91a096]">
            No deadline
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unscheduled.map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={!canEdit}
                onClick={() => onEdit(task)}
                className={`rounded-lg bg-white/[.055] px-3 py-2 text-xs font-bold ${
                  canEdit ? "cursor-pointer hover:bg-white/10" : ""
                }`}
              >
                {task.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskEditor({
  draft,
  members,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: EditorDraft;
  members: ProjectMember[];
  saving: boolean;
  error: string | null;
  onChange: (draft: EditorDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[1.5rem] border border-white/12 bg-[#102219] p-6 shadow-2xl sm:rounded-[1.5rem]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-[#dfff64]">
              {draft.id ? "Admin edit" : "Admin create"}
            </p>
            <h3
              id="task-editor-title"
              className="mt-1 text-2xl font-black tracking-[-.035em]"
            >
              {draft.id ? "Update task" : "Create task"}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={onClose}
            className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/10 text-[#aabbb0] hover:text-white"
            aria-label="Close task editor"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Title">
            <Input
              value={draft.title}
              maxLength={200}
              onChange={(event) =>
                onChange({ ...draft, title: event.target.value })
              }
              className={formControlClass}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={draft.description}
              maxLength={2_000}
              rows={3}
              onChange={(event) =>
                onChange({ ...draft, description: event.target.value })
              }
              className={`${formControlClass} resize-y py-3`}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  onChange({ ...draft, status: value })
                }
              >
                <SelectTrigger className={formControlClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={draft.priority}
                onValueChange={(value) =>
                  onChange({ ...draft, priority: value })
                }
              >
                <SelectTrigger className={formControlClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {capitalize(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Owner">
              <Select
                value={draft.ownerTelegramUserId || "unassigned"}
                onValueChange={(value) =>
                  onChange({
                    ...draft,
                    ownerTelegramUserId:
                      value === "unassigned" ? "" : value,
                  })
                }
              >
                <SelectTrigger className={formControlClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Deadline">
              <Input
                type="datetime-local"
                value={draft.dueAt}
                onChange={(event) =>
                  onChange({ ...draft, dueAt: event.target.value })
                }
                className={formControlClass}
              />
            </Field>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm font-semibold text-rose-200">{error}</p>
        ) : null}

        <div className="mt-7 flex justify-end gap-3 border-t border-white/10 pt-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/12 px-4 py-3 text-sm font-black text-[#aabbb0] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onSave}
            disabled={saving || !draft.title.trim()}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#dfff64] px-5 py-3 text-sm font-black text-[#173d2b] transition hover:bg-[#e8ff8f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving
              ? "Saving…"
              : draft.id
                ? "Save changes"
                : "Create task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="block">
      <span className="mb-1.5 block text-xs font-black text-[#aabbb0]">
        {label}
      </span>
      {children}
    </Label>
  );
}

function TaskBadge({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${
        subtle
          ? "border border-white/12 text-[#aabbb0]"
          : "bg-white/10 text-white"
      }`}
    >
      {label}
    </span>
  );
}

const formControlClass =
  "h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[#dfff64]/60 focus:ring-2 focus:ring-[#dfff64]/10";
const selectContentClass =
  "border-white/12 bg-[#102219] text-white shadow-2xl";

function statusLabel(status: string) {
  return statuses.find((item) => item.id === status)?.label ?? status;
}

function statusAccent(status: string) {
  return statuses.find((item) => item.id === status)?.accent ?? "bg-white/30";
}

function statusBorder(status: string) {
  const classes: Record<string, string> = {
    backlog: "border-l-white/40",
    todo: "border-l-sky-300",
    doing: "border-l-amber-300",
    blocked: "border-l-rose-400",
    overdue: "border-l-orange-400",
    done: "border-l-[#dfff64]",
  };
  return classes[status] ?? classes.backlog;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

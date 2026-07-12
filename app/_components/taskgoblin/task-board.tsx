"use client";

import { GripVertical } from "lucide-react";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { TaskItem, TaskStatus } from "@/lib/taskgoblin-types";
import { priorityClass } from "./shared";

export const TASK_LANES: { id: TaskStatus; title: string; helper: string }[] = [
  { id: "backlog", title: "Backlog", helper: "Captured but not committed" },
  { id: "todo", title: "To Do", helper: "Ready for assignment" },
  { id: "doing", title: "Doing", helper: "In progress now" },
  { id: "blocked", title: "Blocked", helper: "Needs intervention" },
  { id: "overdue", title: "Overdue", helper: "Deadline trouble" },
  { id: "done", title: "Done", helper: "Completed work" },
];

type TaskBoardProps = {
  tasks: TaskItem[];
  selectedTaskId?: string;
  onSelectTask: (task: TaskItem) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
};

export function TaskBoard({ tasks, selectedTaskId, onSelectTask, onMoveTask }: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string>();
  const [targetLane, setTargetLane] = useState<TaskStatus>();
  const touchDrag = useRef<{ taskId: string; pointerId: number } | undefined>(undefined);

  function laneAtPoint(x: number, y: number) {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-task-lane]")?.dataset.taskLane as TaskStatus | undefined;
  }

  function startTouchDrag(event: ReactPointerEvent, taskId: string) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDrag.current = { taskId, pointerId: event.pointerId };
    setDraggedTaskId(taskId);
    setTargetLane(laneAtPoint(event.clientX, event.clientY));
  }

  function moveTouchDrag(event: ReactPointerEvent) {
    if (touchDrag.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    setTargetLane(laneAtPoint(event.clientX, event.clientY));
  }

  function endTouchDrag(event: ReactPointerEvent) {
    const active = touchDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const lane = laneAtPoint(event.clientX, event.clientY) ?? targetLane;
    if (lane) onMoveTask(active.taskId, lane);
    touchDrag.current = undefined;
    setDraggedTaskId(undefined);
    setTargetLane(undefined);
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-black">Task board</h2>
        <p className="text-xs text-muted-foreground">Drag cards between columns. On a phone, drag using the grip.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TASK_LANES.map((lane) => {
          const laneTasks = tasks.filter((task) => task.status === lane.id);
          const isTarget = targetLane === lane.id;
          return (
            <section
              key={lane.id}
              data-task-lane={lane.id}
              className={`min-h-40 rounded-2xl border bg-muted/70 p-3 transition ${isTarget ? "border-accent ring-2 ring-accent/60" : "border-border"}`}
              onDragOver={(event) => { event.preventDefault(); setTargetLane(lane.id); }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
                if (taskId) onMoveTask(taskId, lane.id);
                setDraggedTaskId(undefined);
                setTargetLane(undefined);
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div><h3 className="text-sm font-black">{lane.title}</h3><p className="text-[11px] text-muted-foreground">{lane.helper}</p></div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black">{laneTasks.length}</span>
              </div>
              <div className="space-y-2">
                {laneTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    className={`w-full cursor-pointer rounded-xl border bg-card p-3 text-left transition hover:border-ring hover:shadow-sm ${draggedTaskId === task.id ? "opacity-45" : ""} ${selectedTaskId === task.id ? "border-ring ring-2 ring-accent" : "border-border"}`}
                    onClick={() => onSelectTask(task)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectTask(task); }}
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/task-id", task.id); setDraggedTaskId(task.id); }}
                    onDragEnd={() => { setDraggedTaskId(undefined); setTargetLane(undefined); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold leading-5">{task.title}</h4>
                      <div className="flex items-center gap-1">
                        <span className={priorityClass(task.priority)}>{task.priority}</span>
                        <span
                          className="touch-none rounded-md p-1 text-muted-foreground hover:bg-muted"
                          aria-label={`Drag ${task.title}`}
                          onPointerDown={(event) => startTouchDrag(event, task.id)}
                          onPointerMove={moveTouchDrag}
                          onPointerUp={endTouchDrag}
                          onPointerCancel={endTouchDrag}
                        ><GripVertical className="size-4" /></span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                      <span className={task.owner ? "" : "font-bold text-amber-400"}>{task.owner ?? "Needs owner"}</span><span>{task.deadline ?? "No due date"}</span>
                    </div>
                  </div>
                ))}
                {laneTasks.length === 0 ? <div className="grid min-h-20 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">Drop a task here</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

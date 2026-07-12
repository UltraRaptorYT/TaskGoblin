import { AlertTriangle } from "lucide-react";

import type { TaskItem, TaskScanResult } from "@/lib/taskgoblin-types";
import { Metric } from "./shared";

export function ProjectOverview({ scan }: { scan: TaskScanResult }) {
  const management = getManagementMetrics(scan.tasks);

  return (
    <>
      <div className="mb-6 grid gap-4 xl:grid-cols-[auto_1fr] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#66852c]">Project overview</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.035em] sm:text-3xl">The Goblin&apos;s read</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{scan.summary}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Health" value={management.label} />
          <Metric label="Score" value={`${management.score}`} />
          <Metric label="Unassigned" value={String(management.unassigned)} />
          <Metric label="Blocked" value={String(management.blocked)} />
        </div>
      </div>
      {scan.risks.length > 0 ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#9a6510]" />
          <div>
            <p className="text-sm font-bold">Needs attention: {scan.risks[0].message}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/75">
              {scan.risks[0].reason ?? scan.projectHealth.explanation}
              {scan.risks.length > 1 ? ` · ${scan.risks.length - 1} more risk${scan.risks.length > 2 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getManagementMetrics(tasks: TaskItem[]) {
  if (tasks.length === 0) {
    return { score: 0, label: "Not started", unassigned: 0, blocked: 0 };
  }

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const unassigned = activeTasks.filter((task) => !task.owner?.trim()).length;
  const blocked = activeTasks.filter((task) => task.status === "blocked").length;
  const overdue = activeTasks.filter((task) => task.status === "overdue").length;
  const missingDeadline = activeTasks.filter((task) => !task.deadline?.trim()).length;
  const total = tasks.length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          (unassigned / total) * 25 -
          (blocked / total) * 30 -
          (overdue / total) * 35 -
          (missingDeadline / total) * 10,
      ),
    ),
  );

  const label = score >= 80 ? "Healthy" : score >= 60 ? "Watch" : "At risk";
  return { score, label, unassigned, blocked };
}

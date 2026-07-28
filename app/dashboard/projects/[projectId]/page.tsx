import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";
import {
  getTelegramProjectDetail,
  type TelegramProjectTask,
} from "@/lib/telegram-web-data";

export const metadata: Metadata = {
  title: "Project",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  doing: "In progress",
  blocked: "Blocked",
  overdue: "Overdue",
  done: "Done",
};

const statusClasses: Record<string, string> = {
  backlog: "bg-[#e8e4d8] text-[#5d685f]",
  todo: "bg-[#dcebd7] text-[#315c38]",
  doing: "bg-[#dceaf1] text-[#28536a]",
  blocked: "bg-[#f4d7d0] text-[#843c31]",
  overdue: "bg-[#f3dca9] text-[#755411]",
  done: "bg-[#dfff64] text-[#173d2b]",
};

function TaskRow({ task }: { task: TelegramProjectTask }) {
  const due = task.dueAt
    ? new Intl.DateTimeFormat("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(task.dueAt))
    : task.dueLabel;

  return (
    <article className="grid gap-4 border-b border-[#173d2b]/8 px-5 py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {task.status === "done" ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#66852c]" />
        ) : (
          <Circle className="mt-0.5 size-5 shrink-0 text-[#9aa198]" />
        )}
        <div className="min-w-0">
          <h3
            className={`font-bold leading-5 ${
              task.status === "done" ? "text-[#79827b] line-through" : ""
            }`}
          >
            {task.title}
          </h3>
          {task.description ? (
            <p className="mt-1 line-clamp-1 text-sm text-[#6d776f]">
              {task.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#7a847d]">
            <span>{task.ownerName ?? "Unassigned"}</span>
            {due ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                {due}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-8 sm:pl-0">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${
            statusClasses[task.status] ?? statusClasses.backlog
          }`}
        >
          {statusLabels[task.status] ?? task.status}
        </span>
        <span className="rounded-full border border-[#173d2b]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#68736b]">
          {task.priority}
        </span>
      </div>
    </article>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const identity = await getTelegramWebIdentity();
  if (!identity) redirect("/login");

  const { projectId } = await params;
  const project = await getTelegramProjectDetail(
    identity.telegramUserRecordId,
    projectId,
  );
  if (!project) notFound();

  const completion =
    project.taskCount === 0
      ? 0
      : Math.round((project.completedTaskCount / project.taskCount) * 100);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-[#657269] transition hover:text-[#173d2b]"
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>

      <section className="mt-7 overflow-hidden rounded-[1.75rem] bg-[#173d2b] text-white shadow-[5px_5px_0_#dfff64]">
        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_310px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#dfff64] px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#173d2b]">
                {project.memberRole}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70">
                <MessageCircle className="size-3" />
                {project.chatTitle ?? "Telegram chat"}
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-.055em] sm:text-5xl">
              {project.name}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#c5d2c9]">
              {project.description ??
                "Live project commitments collected from this Telegram group."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/[.055] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-white/45">
                  Progress
                </p>
                <p className="mt-1 text-4xl font-black text-[#dfff64]">
                  {completion}%
                </p>
              </div>
              <p className="text-sm font-semibold text-white/60">
                {project.completedTaskCount}/{project.taskCount} done
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#dfff64]"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 py-7 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Members", project.memberCount, Users],
          ["Your tasks", project.assignedTaskCount, CheckCircle2],
          ["Needs review", project.pendingReviewCount, Clock3],
          ["Health", project.healthLabel, ShieldCheck],
        ] satisfies Array<[string, string | number, LucideIcon]>).map(
          ([label, value, MetricIcon]) => {
            return (
              <div
                key={label}
                className="rounded-2xl border border-[#173d2b]/10 bg-[#fffdf7] p-5"
              >
                <MetricIcon className="size-4 text-[#66852c]" />
                <p className="mt-4 text-xs font-bold text-[#727d75]">{label}</p>
                <p className="mt-1 text-2xl font-black tracking-[-.03em]">
                  {value}
                </p>
              </div>
            );
          },
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <section>
          <div className="overflow-hidden rounded-[1.5rem] border border-[#173d2b]/10 bg-[#fffdf7]">
            <div className="flex items-center justify-between border-b border-[#173d2b]/10 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-xl font-black tracking-[-.035em]">
                  Project tasks
                </h2>
                <p className="mt-1 text-xs text-[#727d75]">
                  Confirmed work only. Inferred changes stay in review first.
                </p>
              </div>
              <span className="text-sm font-black">{project.taskCount}</span>
            </div>
            {project.tasks.length ? (
              project.tasks.map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              <div className="px-6 py-14 text-center">
                <Circle className="mx-auto size-7 text-[#a2aaa3]" />
                <p className="mt-3 font-bold">No confirmed tasks yet</p>
                <p className="mt-1 text-sm text-[#747f77]">
                  TaskGoblin will show work here after the group confirms it.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.5rem] border border-[#173d2b]/10 bg-[#fffdf7] p-5">
            <h2 className="text-sm font-black">Project members</h2>
            <div className="mt-4 space-y-3">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-[#e5e1d5] text-[10px] font-black">
                    {member.displayName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {member.displayName}
                    </p>
                    <p className="text-[11px] capitalize text-[#7b857e]">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[#173d2b]/10 bg-[#e7e3d7] p-5">
            <p className="text-xs font-black uppercase tracking-[.12em] text-[#66852c]">
              Privacy
            </p>
            <p className="mt-2 text-sm leading-6 text-[#56635a]">
              This page shows structured project state, not the group&apos;s raw
              message history. Membership is checked on every request.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

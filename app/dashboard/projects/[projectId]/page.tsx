import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProjectTaskWorkspace } from "@/app/dashboard/projects/[projectId]/project-task-workspace";
import { ProjectReportSettings } from "@/app/dashboard/projects/[projectId]/project-report-settings";
import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";
import { getTelegramProjectDetail } from "@/lib/telegram-web-data";

export const metadata: Metadata = {
  title: "Project",
};

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
    identity.telegramUserId,
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
        className="inline-flex items-center gap-2 text-sm font-bold text-[#aabbb0] transition hover:text-[#dfff64]"
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>

      <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#102219] text-white shadow-[5px_5px_0_#dfff64]">
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
          ["Members", project.memberCount, Users, null],
          ["Your tasks", project.assignedTaskCount, CheckCircle2, null],
          ["Needs review", project.pendingReviewCount, Clock3, null],
          ["Health", project.healthLabel, ShieldCheck, project.healthReason],
        ] satisfies Array<
          [string, string | number, LucideIcon, string | null]
        >).map(
          ([label, value, MetricIcon, detail]) => {
            return (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-[#102219] p-5"
              >
                <MetricIcon className="size-4 text-[#dfff64]" />
                <p className="mt-4 text-xs font-bold text-[#91a096]">{label}</p>
                <p className="mt-1 text-2xl font-black tracking-[-.03em]">
                  {value}
                </p>
                {detail ? (
                  <p className="mt-2 text-[11px] leading-4 text-[#91a096]">
                    {detail}
                  </p>
                ) : null}
              </div>
            );
          },
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <ProjectTaskWorkspace
          projectId={project.id}
          initialTasks={project.tasks}
          members={project.members}
          canEdit={project.memberRole === "admin"}
        />

        <aside className="space-y-5">
          <ProjectReportSettings
            projectId={project.id}
            initialSettings={project.reportSettings}
            canEdit={project.memberRole === "admin"}
          />
          <div className="rounded-[1.5rem] border border-white/10 bg-[#102219] p-5">
            <h2 className="text-sm font-black">Project members</h2>
            <div className="mt-4 space-y-3">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-white/10 text-[10px] font-black text-[#dfff64]">
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
                    <p className="text-[11px] capitalize text-[#91a096]">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-5">
            <p className="text-xs font-black uppercase tracking-[.12em] text-[#dfff64]">
              Privacy
            </p>
            <p className="mt-2 text-sm leading-6 text-[#aabbb0]">
              This page shows structured project state, not the group&apos;s raw
              message history. Membership is checked on every request.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

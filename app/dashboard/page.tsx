import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  ListTodo,
  MessageCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";
import { getTelegramDashboardData } from "@/lib/telegram-web-data";

export const metadata: Metadata = {
  title: "Your projects",
};

export const dynamic = "force-dynamic";

function completion(taskCount: number, doneCount: number) {
  return taskCount === 0 ? 0 : Math.round((doneCount / taskCount) * 100);
}

export default async function DashboardPage() {
  const identity = await getTelegramWebIdentity();
  if (!identity) redirect("/login");

  const data = await getTelegramDashboardData(
    identity.telegramUserRecordId,
    identity.telegramUserId,
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <section className="flex flex-col gap-7 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#dfff64]">
            <Sparkles className="size-4" />
            Telegram workspace
          </p>
          <h1 className="text-4xl font-black tracking-[-.055em] sm:text-5xl">
            Good to see you, {identity.displayName.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#aabbb0]">
            These are the live project groups where TaskGoblin has recognised
            your Telegram account.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[.055] px-4 py-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#dfff64] text-[#173d2b]">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-[#91a096]">Connected as</p>
            <p className="text-sm font-black">
              {identity.username ? `@${identity.username}` : identity.displayName}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-b border-white/10 py-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#dfff64]">
            What TaskGoblin does
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#b7c6bc]">
            TaskGoblin turns project conversations into reviewable tasks,
            owners, deadlines, decisions, and reminders—then gives the team a
            visual workspace without exposing raw chat history.
          </p>
        </div>
        <Link
          href="/legacy"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 transition hover:border-[#dfff64]/35 hover:bg-white/[.07]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#dfff64]">
            <FileText className="size-4" />
          </span>
          <span>
            <span className="block text-xs font-black">Import a project brief</span>
            <span className="mt-0.5 block text-[11px] text-[#91a096]">
              PDF, DOCX, TXT, or MD · separate imported project
            </span>
          </span>
          <ArrowUpRight className="size-4 text-[#91a096]" />
        </Link>
      </section>

      <section
        className="grid gap-3 py-7 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Workspace summary"
      >
        {[
          {
            label: "Projects",
            value: data.projects.length,
            icon: FolderKanban,
            accent: "bg-[#173d2b] text-[#dfff64]",
          },
          {
            label: "All tasks",
            value: data.totalTasks,
            icon: ListTodo,
            accent: "bg-white/10 text-[#d7e2da]",
          },
          {
            label: "Assigned to you",
            value: data.assignedTasks,
            icon: CheckCircle2,
            accent: "bg-[#dfff64] text-[#173d2b]",
          },
          {
            label: "Needs review",
            value: data.pendingReviews,
            icon: Clock3,
            accent: "bg-[#f3dca9] text-[#6d5012]",
          },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-[#102219] p-5 shadow-lg shadow-black/10"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#aabbb0]">{label}</p>
              <span className={`grid size-9 place-items-center rounded-xl ${accent}`}>
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-5 text-3xl font-black tracking-[-.04em]">{value}</p>
          </div>
        ))}
      </section>

      {data.projects.length === 0 ? (
        <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#102219] text-white shadow-[5px_5px_0_#dfff64]">
          <div className="grid gap-9 p-7 sm:p-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
            <div>
              <span className="grid size-12 place-items-center rounded-2xl bg-[#dfff64] text-[#173d2b]">
                <Plus className="size-6" strokeWidth={3} />
              </span>
              <h2 className="mt-6 text-3xl font-black tracking-[-.045em]">
                No linked project chats yet.
              </h2>
              <p className="mt-3 max-w-xl leading-7 text-[#c4d2c8]">
                Add TaskGoblin to a Telegram group, disable privacy mode for the
                bot, then send a message or say hello. Once the bot sees your
                account in that group, the project appears here automatically.
              </p>
            </div>
            <ol className="space-y-3">
              {[
                "Add @TaskGoblin to the project group",
                "Let the bot receive group messages",
                "Send a message from your Telegram account",
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm font-semibold"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#dfff64] text-xs font-black text-[#173d2b]">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="mt-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-.035em]">
                Your project chats
              </h2>
              <p className="mt-1 text-sm text-[#91a096]">
                Structured work from the groups you share with TaskGoblin.
              </p>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {data.projects.map((project) => {
              const progress = completion(
                project.taskCount,
                project.completedTaskCount,
              );
              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="group rounded-[1.5rem] border border-white/10 bg-[#102219] p-6 transition hover:-translate-y-1 hover:border-[#dfff64]/40 hover:shadow-[5px_5px_0_#dfff64]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#dfff64] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#173d2b]">
                          {project.memberRole}
                        </span>
                        {project.pendingReviewCount > 0 ? (
                          <span className="rounded-full bg-[#f3dca9] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] text-[#6d5012]">
                            {project.pendingReviewCount} to review
                          </span>
                        ) : null}
                      </div>
                      <h3 className="truncate text-2xl font-black tracking-[-.04em]">
                        {project.name}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[#91a096]">
                        <MessageCircle className="size-3.5 shrink-0" />
                        {project.chatTitle ?? "Telegram project chat"}
                      </p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 text-[#b9c9bf] transition group-hover:bg-[#dfff64] group-hover:text-[#173d2b]">
                      <ArrowUpRight className="size-5" />
                    </span>
                  </div>
                  <p className="mt-5 line-clamp-2 min-h-12 text-sm leading-6 text-[#aabbb0]">
                    {project.description ??
                      "TaskGoblin is organising commitments from this project group."}
                  </p>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{progress}% complete</span>
                      <span className="text-[#91a096]">
                        {project.completedTaskCount}/{project.taskCount} tasks
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#dfff64]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-4 border-t border-white/8 pt-4 text-xs font-semibold text-[#91a096]">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {project.memberCount} members
                    </span>
                    <span>{project.assignedTaskCount} yours</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

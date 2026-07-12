import { CheckCircle2, FileText, LayoutDashboard, Loader2, LogOut, MessagesSquare } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { TaskScanResult } from "@/lib/taskgoblin-types";
import { BrandMark } from "./shared";

type WorkspaceHeaderProps = { identity: string; projectName?: string; onSignOut: () => void };

export function WorkspaceHeader({ identity, projectName, onSignOut }: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <BrandMark dark />
          <span className="hidden h-6 w-px bg-border sm:block" />
          {projectName ? (
            <Link href="/demo" className="hidden min-w-0 items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground sm:flex">
              <LayoutDashboard className="size-4 shrink-0" /> All projects <span className="text-border">/</span> <span className="truncate text-foreground">{projectName}</span>
            </Link>
          ) : <span className="hidden items-center gap-2 text-sm font-bold text-muted-foreground sm:flex"><LayoutDashboard className="size-4" /> Workspace</span>}
        </div>
        <div className="flex items-center gap-2">
          <a href="/taskgoblin-pitch.html" target="_blank" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted sm:block">Pitch deck</a>
          <a href="/telegram.html" target="_blank" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground lg:block">Demo chat</a>
          <span className="hidden max-w-52 truncate text-xs font-semibold text-muted-foreground md:block">{identity}</span>
          <button type="button" onClick={onSignOut} className="grid size-9 place-items-center rounded-xl border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Leave workspace"><LogOut className="size-4" /></button>
        </div>
      </div>
    </header>
  );
}

type ImportHeroProps = { projectName?: string; fileName: string; isImporting: boolean; onFileUpload: (file: File | null) => void };

export function ImportHero({ projectName, fileName, isImporting, onFileUpload }: ImportHeroProps) {
  return (
    <section className="border-b border-emerald-300/20 bg-[#173d2b] text-white">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_520px] lg:items-center lg:px-8 lg:py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#dfff64]">Turn source material into accountable work</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-.045em] sm:text-5xl">{projectName ?? "Your project"}, organized<br className="hidden sm:block" /> in one scan.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#e0ebe3]">Add briefs and Telegram exports to this project. TaskGoblin extracts the work and keeps it on this project&apos;s board.</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-[#dfff64]">Add source to this project</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SourceUpload icon={isImporting ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />} title="Project brief" helper="PDF, DOCX, TXT or MD" accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain" disabled={isImporting} onFileUpload={onFileUpload} />
            <SourceUpload icon={isImporting ? <Loader2 className="size-5 animate-spin" /> : <MessagesSquare className="size-5" />} title="Telegram chat" helper="result.json or export ZIP" accept=".json,.zip,application/json,application/zip" disabled={isImporting} onFileUpload={onFileUpload} />
          </div>
          <p className="mt-2 truncate text-xs text-[#d3e0d6]">{fileName === "Demo import" ? "Choose the source type to begin" : fileName}</p>
        </div>
      </div>
    </section>
  );
}

function SourceUpload({ icon, title, helper, accept, disabled, onFileUpload }: { icon: ReactNode; title: string; helper: string; accept: string; disabled: boolean; onFileUpload: (file: File | null) => void }) {
  return (
    <label className={`group flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#8da660] bg-white/8 p-4 transition hover:border-[#dfff64] hover:bg-white/12 ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dfff64] text-[#173d2b]">{icon}</span>
      <span><span className="block text-sm font-black">{title}</span><span className="mt-0.5 block text-[11px] text-[#d3e0d6]">{helper}</span></span>
      <input className="sr-only" type="file" accept={accept} disabled={disabled} onChange={(event) => onFileUpload(event.target.files?.[0] ?? null)} />
    </label>
  );
}

export function ImportStatus({ status, scan }: { status: string; scan: TaskScanResult }) {
  return (
    <div className="border-b border-border bg-muted">
      <div className="mx-auto flex max-w-[1500px] items-start gap-3 px-4 py-3 text-sm sm:items-center sm:px-6 lg:px-8">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#9fbd42] sm:mt-0" />
        <p className="min-w-0 flex-1 text-muted-foreground">{status}</p>
        <span className="hidden shrink-0 text-xs font-bold text-muted-foreground md:block">{scan.tasks.length} tasks · {scan.risks.length} risks · {scan.questions.length} questions</span>
      </div>
    </div>
  );
}

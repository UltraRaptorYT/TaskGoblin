"use client";

import { ArrowRight, FolderKanban, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "./shared";
import {
  LEGACY_DEMO_SCAN_KEY,
  demoProjectScanKey,
  readDemoProjects,
  writeDemoProjects,
  type DemoProjectSummary,
} from "@/lib/demo-projects";

export function DemoProjects() {
  const router = useRouter();
  const [projects, setProjects] = useState<DemoProjectSummary[]>([]);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved = readDemoProjects();
      const legacyScan = window.localStorage.getItem(LEGACY_DEMO_SCAN_KEY);
      if (saved.length === 0 && legacyScan) {
        const now = new Date().toISOString();
        const legacyProject: DemoProjectSummary = {
          id: "acacia-launchpad",
          name: "Acacia Launchpad",
          createdAt: now,
          updatedAt: now,
          taskCount: 0,
        };
        saved = [legacyProject];
        writeDemoProjects(saved);
        window.localStorage.setItem(demoProjectScanKey(legacyProject.id), legacyScan);
        window.localStorage.removeItem(LEGACY_DEMO_SCAN_KEY);
      }
      setProjects(saved);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function createProject() {
    const projectName = name.trim();
    if (!projectName) return;
    const id = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "project"}-${crypto.randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();
    const project: DemoProjectSummary = { id, name: projectName, createdAt: now, updatedAt: now, taskCount: 0 };
    writeDemoProjects([project, ...projects]);
    router.push(`/demo/${id}`);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-[#07140e]/95">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandMark dark />
          <Link href="/" className="text-sm font-bold text-muted-foreground hover:text-foreground">Back to home</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#dfff64]">Demo workspace</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Your projects</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Create a separate board for each project, then add briefs or Telegram chats inside it.</p>
          </div>
          <div className="flex w-full max-w-md gap-2 rounded-2xl border bg-card p-2">
            <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} placeholder="New project name" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={createProject} disabled={!name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#dfff64] px-4 py-2.5 text-sm font-black text-[#17231c] disabled:opacity-40"><Plus className="size-4" /> Create</button>
          </div>
        </div>
        {!ready ? <p className="text-sm text-muted-foreground">Loading projects…</p> : projects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/demo/${project.id}`} className="group rounded-3xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-[#dfff64]/70 hover:shadow-xl hover:shadow-black/20">
                <div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[#dfff64]/10 text-[#dfff64]"><FolderKanban className="size-5" /></span><ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-[#dfff64]" /></div>
                <h2 className="mt-7 text-xl font-black">{project.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{project.taskCount} tasks · Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed bg-card/50 p-8 text-center">
            <div><Sparkles className="mx-auto size-8 text-[#dfff64]" /><h2 className="mt-4 text-xl font-black">Create your first project</h2><p className="mt-2 text-sm text-muted-foreground">Each project gets its own board, source files, and cached changes.</p></div>
          </div>
        )}
      </section>
    </main>
  );
}

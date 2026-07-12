import type { Provider } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight,
  FileText,
  MessageSquareText,
  WandSparkles,
} from "lucide-react";

import { BrandMark } from "./shared";

type LandingPageProps = {
  authMessage: string;
  oauthConfigured: boolean;
  onOAuth: (provider: Provider) => void;
  onDemo: () => void;
};

export function LandingPage({
  authMessage,
  oauthConfigured,
  onOAuth,
  onDemo,
}: LandingPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07140e] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,rgb(223_255_100_/_0.055)_49%,transparent_50%),linear-gradient(25deg,transparent_0%,transparent_48%,rgb(134_92_246_/_0.09)_49%,transparent_50%)] [background-size:420px_280px,520px_360px]" />
      <div className="pointer-events-none fixed left-1/2 top-40 size-[700px] -translate-x-1/2 rounded-full bg-[#5936ba]/20 blur-[150px]" />
      <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandMark dark />
        <nav className="flex items-center gap-2 sm:gap-5">
          <a href="#how-it-works" className="hidden text-sm font-semibold text-white/60 transition hover:text-white sm:block">
            How it works
          </a>
          <a href="/telegram.html" target="_blank" className="hidden text-sm font-semibold text-white/60 transition hover:text-white md:block">
            Demo chat
          </a>
          <a target="_blank" href="/taskgoblin-pitch.html" className="hidden text-sm font-semibold text-white/60 transition hover:text-white sm:block">
            Pitch deck
          </a>
          <button onClick={onDemo} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
            Open demo
          </button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_390px]">
        <div className="max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dfff64]/20 bg-[#dfff64]/8 px-3 py-1.5 text-xs font-bold text-[#dfff64]">
            <WandSparkles className="size-3.5" /> AI project accountability, without the busywork
          </div>
          <h1 className="text-[clamp(3.4rem,7.5vw,7.4rem)] font-black leading-[.9] tracking-[-.07em]">
            Turn project chaos into
            <br />
            <span className="bg-gradient-to-r from-[#dfff64] via-[#63d9b1] to-[#9d72ff] bg-clip-text text-transparent">
              work that gets done.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60 sm:text-xl">
            Upload a project brief or Telegram export. TaskGoblin finds the tasks, owners, deadlines, and risks—then builds your team&apos;s board in seconds.
          </p>
          <div id="how-it-works" className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
            <LandingStep icon={<FileText className="size-4" />} label="Upload a brief" />
            <LandingStep icon={<WandSparkles className="size-4" />} label="AI maps the work" />
            <LandingStep icon={<MessageSquareText className="size-4" />} label="Review and nudge" />
          </div>
        </div>

        <aside className="rounded-3xl border border-white/12 bg-white/[.065] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="mb-6 grid size-12 place-items-center overflow-hidden rounded-2xl border border-[#dfff64]/40 bg-[#dfff64]">
            <Image src="/brand/taskgoblin-logo.png" alt="" width={48} height={48} className="size-12 object-contain" />
          </div>
          <h2 className="text-2xl font-black tracking-[-.035em]">Enter your workspace</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Sign in to save projects, collaborate with your team, and keep every quest moving.
          </p>
          <div className="mt-6 space-y-3">
            <button onClick={() => onOAuth("google")} disabled={!oauthConfigured} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white font-bold text-[#142018] transition hover:bg-[#f0f0ec] disabled:cursor-not-allowed disabled:opacity-50">
              <span className="grid size-5 place-items-center rounded-full border border-[#d5d5d5] text-xs font-black text-[#4285f4]">G</span>
              Continue with Google
            </button>
          </div>
          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-white/30">
            <span className="h-px flex-1 bg-white/10" /> or explore first <span className="h-px flex-1 bg-white/10" />
          </div>
          <button onClick={onDemo} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#dfff64] transition hover:bg-[#dfff64]/8">
            Open demo workspace <ArrowRight className="size-4" />
          </button>
          {!oauthConfigured ? (
            <p className="mt-4 rounded-xl border border-[#ffbd59]/20 bg-[#ffbd59]/8 p-3 text-xs leading-5 text-[#ffd99b]">
              Supabase Auth is not configured yet. Demo mode is available.
            </p>
          ) : null}
          {authMessage ? <p className="mt-4 text-center text-xs leading-5 text-[#ffb4a9]">{authMessage}</p> : null}
          <p className="mt-5 text-center text-[11px] leading-5 text-white/30">
            By continuing, you agree to keep your goblin responsibly supervised.
          </p>
        </aside>
      </section>
    </main>
  );
}

function LandingStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold text-white/70">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#dfff64]/10 text-[#dfff64]">{icon}</span>
      {label}
    </div>
  );
}

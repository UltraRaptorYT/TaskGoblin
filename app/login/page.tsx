import {
  ArrowRight,
  Bot,
  Check,
  LockKeyhole,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandMark } from "@/app/_components/taskgoblin/shared";
import {
  getTelegramWebConfig,
  getTelegramWebIdentity,
} from "@/lib/telegram-web-auth";

export const metadata: Metadata = {
  title: "Sign in with Telegram",
  description:
    "See the TaskGoblin projects and tasks connected to your Telegram account.",
};

const errors: Record<string, string> = {
  cancelled: "Telegram login was cancelled. Nothing was changed.",
  invalid_state: "That login attempt expired or could not be verified. Please try again.",
  login_failed: "Telegram could not verify this login. Please try again.",
  not_configured: "Telegram web login is not configured on this deployment yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const identity = await getTelegramWebIdentity();
  if (identity) redirect("/dashboard");

  const params = await searchParams;
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorKey ? errors[errorKey] ?? errors.login_failed : null;
  const configured = Boolean(getTelegramWebConfig());

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07140e] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 14% 14%, rgba(223,255,100,.13), transparent 28%), radial-gradient(circle at 84% 78%, rgba(39,174,96,.12), transparent 32%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <BrandMark dark />
          {/* <Link
            href="/legacy"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#dfff64]/40 hover:text-white"
          >
            Legacy import
          </Link> */}
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
          <section className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfff64]/25 bg-[#dfff64]/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[.15em] text-[#dfff64]">
              <Sparkles className="size-3.5" />
              Your project memory, from Telegram
            </div>
            <h1 className="text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-6xl lg:text-7xl">
              The work in your chats,
              <span className="block text-[#dfff64]">finally organised.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#b9c9bf]">
              Sign in with the same Telegram account you use in your project
              groups. TaskGoblin will show only the chats, tasks, and decisions
              you already belong to.
            </p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                ["01", "Connect Telegram"],
                ["02", "Verify membership"],
                ["03", "See your work"],
              ].map(([number, label]) => (
                <div
                  key={number}
                  className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
                >
                  <span className="font-mono text-xs text-[#dfff64]/70">
                    {number}
                  </span>
                  <p className="mt-2 text-sm font-bold">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 rotate-2 rounded-[2rem] bg-[#dfff64]/10 blur-xl" />
            <div className="relative rounded-[1.75rem] border border-white/15 bg-[#102219]/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#dfff64] text-[#102219]">
                <MessageCircle className="size-7" strokeWidth={2.5} />
              </div>
              <h2 className="mt-7 text-2xl font-black tracking-[-.035em]">
                Continue with Telegram
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#aabbb0]">
                Telegram verifies who you are. TaskGoblin then matches your
                Telegram user ID against known project group members.
              </p>

              {error ? (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-5 text-amber-100"
                >
                  {error}
                </div>
              ) : null}

              <a
                href={configured ? "/api/auth/telegram/start" : "#setup"}
                aria-disabled={!configured}
                className={`mt-6 flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-base font-black transition ${
                  configured
                    ? "bg-[#dfff64] text-[#102219] shadow-[0_5px_0_#76942e] hover:-translate-y-0.5 hover:bg-[#e8ff8f]"
                    : "cursor-not-allowed bg-white/10 text-white/40"
                }`}
              >
                <Bot className="size-5" />
                Sign in with Telegram
                <ArrowRight className="size-4" />
              </a>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                {[
                  "No password shared with TaskGoblin",
                  "Projects filtered by group membership",
                  "12-hour secure browser session",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 text-sm text-[#b9c9bf]"
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-[#dfff64]/12 text-[#dfff64]">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
              <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-white/40">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                TaskGoblin does not expose chat message history on this
                dashboard. Sign-in grants access only to structured project
                information.
              </p>
            </div>
          </section>
        </div>

        {!configured ? (
          <aside
            id="setup"
            className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/8 px-5 py-4 text-sm text-amber-100"
          >
            Deployment setup needed: add the Telegram OIDC client ID, client
            secret, and a 32+ character web session secret, then redeploy.
          </aside>
        ) : null}
        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>TaskGoblin · Telegram-native project management</p>
          <p>Your group stays the source of truth.</p>
        </footer>
      </div>
    </main>
  );
}

import { LogOut, MessageCircleMore } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/app/_components/taskgoblin/shared";
import { getTelegramWebIdentity } from "@/lib/telegram-web-auth";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getTelegramWebIdentity();
  if (!identity) redirect("/login");

  return (
    <div className="dark min-h-screen bg-[#07140e] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07140e]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandMark dark />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#b9c9bf] transition hover:bg-white/8 hover:text-white sm:flex"
            >
              <MessageCircleMore className="size-4" />
              Projects
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[.055] p-1.5 pr-2">
              <span className="grid size-8 place-items-center rounded-full bg-[#dfff64] text-xs font-black text-[#173d2b]">
                {initials(identity.displayName)}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-bold sm:block">
                {identity.displayName}
              </span>
              <form action="/api/auth/telegram/logout" method="post">
                <button
                  type="submit"
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-[#91a096] transition hover:bg-white/10 hover:text-white"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

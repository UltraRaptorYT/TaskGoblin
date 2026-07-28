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
    <div className="min-h-screen bg-[#f4f1e8] text-[#17231c]">
      <header className="sticky top-0 z-20 border-b border-[#173d2b]/10 bg-[#f4f1e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandMark />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#46574c] transition hover:bg-white/70 sm:flex"
            >
              <MessageCircleMore className="size-4" />
              Projects
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-[#173d2b]/10 bg-white/60 p-1.5 pr-2">
              <span className="grid size-8 place-items-center rounded-full bg-[#173d2b] text-xs font-black text-[#dfff64]">
                {initials(identity.displayName)}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-bold sm:block">
                {identity.displayName}
              </span>
              <form action="/api/auth/telegram/logout" method="post">
                <button
                  type="submit"
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-[#617067] transition hover:bg-[#173d2b]/8 hover:text-[#173d2b]"
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

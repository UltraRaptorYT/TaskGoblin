import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07140e]">
      <div className="flex items-center gap-3 text-sm font-bold text-white/60">
        <Loader2 className="size-5 animate-spin text-[#dfff64]" /> Waking the
        Goblin…
      </div>
    </main>
  );
}

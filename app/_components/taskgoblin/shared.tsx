import Image from "next/image";

export function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <a href="#" className="flex items-center gap-2.5" aria-label="TaskGoblin home">
      <span
        className={`${dark ? "size-10 border border-[#dfff64]/40" : "goblin-shadow-sm size-11 border-2 border-[#173d2b]"} grid place-items-center overflow-hidden rounded-xl bg-[#dfff64]`}
        aria-hidden="true"
      >
        <Image
          src="/brand/taskgoblin-logo.png"
          alt=""
          width={44}
          height={44}
          className="size-full object-contain"
          priority
        />
      </span>
      <span
        className={`text-xl font-black tracking-[-.045em] ${dark ? "text-white" : "text-[#173d2b]"}`}
      >
        Task
        <span className={dark ? "text-[#dfff64]" : "text-[#66852c]"}>
          Goblin
        </span>
      </span>
    </a>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black text-foreground">{value}</p>
    </div>
  );
}

export function priorityClass(priority: string) {
  const base = "rounded-md px-2 py-1 text-[11px] font-semibold capitalize";

  if (priority === "urgent") return `${base} bg-red-100 text-red-700`;
  if (priority === "high") return `${base} bg-amber-100 text-amber-700`;
  if (priority === "medium") return `${base} bg-emerald-100 text-emerald-700`;
  return `${base} bg-stone-200 text-stone-700`;
}

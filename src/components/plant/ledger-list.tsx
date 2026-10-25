import type { LedgerEvent } from "@/lib/db/schema";
import { cx } from "@/components/ui";

export function actorTone(actor: string) {
  if (actor.startsWith("agent:") || actor.startsWith("copilot:")) return "text-blue";
  if (actor === "system") return "text-ink-3";
  return "text-accent";
}

export function LedgerList({ events, dense = true }: { events: LedgerEvent[]; dense?: boolean }) {
  return (
    <ol className="relative space-y-0 border-l border-line pl-4">
      {events.map((e) => (
        <li key={e.id} className={cx("relative", dense ? "py-1.5" : "py-2.5")}>
          <span className={cx("absolute top-[13px] -left-[20.5px] size-2 rounded-full border-2 border-panel bg-current", actorTone(e.actor))} aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="num text-[11px] text-ink-3" suppressHydrationWarning>
              {new Date(e.at).toLocaleString("en-US", {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "America/New_York",
              })}
            </span>
            <span className={cx("num text-[11px] font-semibold", actorTone(e.actor))}>{e.actor}</span>
            <span className="num text-[11px] text-ink-2">{e.kind}</span>
            <span className="num text-[11px] font-semibold">{e.entity}</span>
          </div>
          <div className="text-[12.5px] text-ink-2">{e.summary}</div>
        </li>
      ))}
    </ol>
  );
}

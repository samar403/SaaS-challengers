import { STATIONS, type Station } from "@/lib/db/schema";
import { STATION_HOURS_PER_DAY, STATION_LABEL, type Snapshot } from "@/lib/domain/plant";
import { cx, Meter, type Tone } from "@/components/ui";

/** The production line as a schematic: stations joined by flowing conduit. */
export function LineStrip({ s, compact = false }: { s: Snapshot; compact?: boolean }) {
  const stations = STATIONS.filter((st) => st !== "done");
  const load = (st: Station) => {
    const wos = s.workOrders.filter((w) => w.station === st && w.status !== "done");
    const hours = wos.reduce((a, w) => a + w.hoursRemaining, 0);
    return { wos, hours, days: hours / STATION_HOURS_PER_DAY, blocked: wos.filter((w) => w.status === "blocked").length };
  };
  const loads = stations.map((st) => ({ st, ...load(st) }));
  const max = Math.max(...loads.map((l) => l.days), 1);
  const bottleneck = loads.reduce((a, b) => (b.days > a.days ? b : a));
  return (
    <div className="scroll-thin overflow-x-auto">
      <ol className="flex min-w-[640px] items-stretch">
        {loads.map((l, i) => {
          const tone: Tone = l.blocked ? "critical" : l.st === bottleneck.st ? "serious" : l.days > 2 ? "warning" : "good";
          const assets = s.assets.filter((a) => a.station === l.st);
          return (
            <li key={l.st} className="flex flex-1 items-stretch">
              <div className={cx("relative flex-1 border border-line bg-panel p-3", l.st === bottleneck.st && "border-serious/60")}>
                <div className="flex items-center justify-between">
                  <span className="label">ST-{String(i + 1).padStart(2, "0")}</span>
                  {l.st === bottleneck.st && <span className="font-mono text-[9.5px] font-bold tracking-widest text-serious uppercase">◆ Bottleneck</span>}
                  {l.blocked > 0 && l.st !== bottleneck.st && (
                    <span className="font-mono text-[9.5px] font-bold tracking-widest text-critical uppercase">■ Blocked</span>
                  )}
                </div>
                <div className="mt-1 text-[13px] font-semibold">{STATION_LABEL[l.st]}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="num text-xl font-semibold">{l.days.toFixed(1)}</span>
                  <span className="num text-[11px] text-ink-3">days queued</span>
                </div>
                <Meter className="mt-1.5" value={l.days / max} tone={tone} label={`${STATION_LABEL[l.st]}: ${l.hours.toFixed(0)} hours queued`} />
                {!compact && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
                    <span className="num">
                      {l.wos.length} job{l.wos.length === 1 ? "" : "s"} · {l.hours.toFixed(0)}h
                    </span>
                    <span className="flex gap-1">
                      {assets.map((a) => (
                        <span
                          key={a.code}
                          title={`${a.code} ${a.name}: ${a.status}`}
                          className={cx(
                            "num rounded-[2px] border px-1 text-[9.5px]",
                            a.status === "running" && "border-good/40 text-good",
                            a.status === "idle" && "border-line text-ink-3",
                            a.status === "maintenance" && "border-warning/60 text-warning",
                            a.status === "down" && "border-critical/60 text-critical",
                          )}
                        >
                          {a.code}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              {i < loads.length - 1 && (
                <svg className="w-6 shrink-0 self-center" height="12" viewBox="0 0 24 12" aria-hidden>
                  <line x1="0" y1="6" x2="20" y2="6" stroke="var(--line-strong)" strokeWidth="1.5" className="flow" />
                  <path d="M18 2 L23 6 L18 10" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

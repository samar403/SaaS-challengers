import { Suspense } from "react";
import { getSnapshot } from "@/lib/db/queries";
import { forecastWorkOrders, STATION_LABEL, fmtDays } from "@/lib/domain/plant";
import { STATIONS } from "@/lib/db/schema";
import { advanceWorkOrderAction } from "@/app/actions";
import { cx, Sheet, SkeletonRows, Status, TitleBlock } from "@/components/ui";
import { LineStrip } from "@/components/plant/line-strip";

export const metadata = { title: "Production" };

export default function ProductionPage() {
  return (
    <>
      <TitleBlock
        sheet="02"
        title="Production"
        subtitle="Finite-capacity forecast per station. Every card knows when it will really finish — not when someone hoped it would."
        cells={[
          { k: "Capacity", v: "14 h / station / day" },
          { k: "Shifts", v: "2 × 8h" },
        ]}
      />
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const s = await getSnapshot();
  const fc = forecastWorkOrders(s);
  const done = s.workOrders.filter((w) => w.status === "done");
  return (
    <div className="space-y-4">
      <Sheet fig="FIG. 02-A" title="Line flow">
        <LineStrip s={s} />
      </Sheet>
      <Sheet
        fig="FIG. 02-B"
        title="Work orders by station"
        aside={
          <span className="label">
            {fc.length} active · {done.length} done
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="scroll-thin grid auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto">
          {STATIONS.filter((st) => st !== "done").map((st, i) => {
            const col = fc.filter((f) => f.wo.station === st).sort((a, b) => a.wo.priority - b.wo.priority || a.slackDays - b.slackDays);
            return (
              <div key={st} className={cx("min-h-80 p-3", i > 0 && "border-l border-line")}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{STATION_LABEL[st]}</span>
                  <span className="label">{col.length}</span>
                </div>
                <ul className="space-y-2.5">
                  {col.map((f) => {
                    const item = s.items.find((x) => x.id === f.wo.itemId);
                    const so = s.salesOrders.find((o) => o.id === f.wo.salesOrderId);
                    return (
                      <li key={f.wo.id} className={cx("sheet p-3", f.late && "border-critical/50", f.wo.status === "blocked" && "hatch")}>
                        <div className="flex items-center justify-between">
                          <span className="num text-[12px] font-bold">{f.wo.number}</span>
                          <span
                            className={cx(
                              "num rounded-[2px] px-1.5 text-[10px] font-bold",
                              f.wo.priority === 1 ? "bg-accent text-accent-ink" : "border border-line text-ink-2",
                            )}
                          >
                            P{f.wo.priority}
                          </span>
                        </div>
                        <div className="mt-1 text-[12.5px] leading-snug">
                          {f.wo.qty}× {item?.name}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 font-mono text-[10.5px]">
                          <span>
                            <span className="block text-ink-3">LEFT</span>
                            {f.wo.hoursRemaining.toFixed(0)}h
                          </span>
                          <span>
                            <span className="block text-ink-3">DUE</span>
                            {new Date(f.wo.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}
                          </span>
                          <span className={f.late ? "text-critical" : f.slackDays < 1 ? "text-warning" : "text-good"}>
                            <span className="block text-ink-3">SLACK</span>
                            {fmtDays(f.slackDays)}
                          </span>
                        </div>
                        {f.wo.blockedReason && (
                          <div className="mt-2">
                            <Status tone="critical">{f.wo.blockedReason}</Status>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="label">{so ? so.number : "Stock build"}</span>
                          <form action={advanceWorkOrderAction}>
                            <input type="hidden" name="id" value={f.wo.id} />
                            <button className="font-mono text-[10.5px] font-semibold tracking-wider text-accent uppercase hover:underline">Advance →</button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                  {!col.length && <li className="label py-6 text-center">— clear —</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

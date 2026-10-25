import { Suspense } from "react";
import { getSnapshot } from "@/lib/db/queries";
import { DAY, fmtDays, fmtMoney, forecastWorkOrders, salesOrderRisk } from "@/lib/domain/plant";
import { cx, Sheet, SkeletonRows, Status, TitleBlock } from "@/components/ui";

export const metadata = { title: "Customer orders" };

export default function OrdersPage() {
  return (
    <>
      <TitleBlock
        sheet="05"
        title="Customer orders"
        subtitle="Promise dates checked against the shop floor forecast, not against optimism. The bar is the order's life; the tick is when it will really be ready."
        cells={[
          { k: "Horizon", v: "21 days" },
          { k: "Method", v: "Queue simulation" },
        ]}
      />
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <Orders />
      </Suspense>
    </>
  );
}

async function Orders() {
  const s = await getSnapshot();
  const risks = salesOrderRisk(s);
  const fc = forecastWorkOrders(s);
  const start = s.now - 2 * DAY;
  const span = 21 * DAY;
  const x = (t: number) => `${Math.max(0, Math.min(100, ((t - start) / span) * 100))}%`;
  const today = x(s.now);
  return (
    <Sheet
      fig="FIG. 05-A"
      title="Delivery forecast"
      aside={
        <span className="label">
          {risks.filter((r) => r.risk === "late").length} late · {risks.filter((r) => r.risk === "tight").length} tight
        </span>
      }
    >
      <div className="scroll-thin overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="relative ml-[300px] h-6 border-b border-line">
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className="absolute top-0 h-full border-l border-line" style={{ left: `${(i / 21) * 100}%` }}>
                {i % 3 === 0 && (
                  <span className="num absolute top-0 left-1 text-[10px] whitespace-nowrap text-ink-3">
                    {new Date(start + i * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}
                  </span>
                )}
              </span>
            ))}
          </div>
          <ul>
            {risks.map((r) => {
              const wo = fc.filter((f) => f.wo.salesOrderId === r.so.id);
              const finish = wo.length ? Math.max(...wo.map((f) => f.finishAt)) : null;
              const tone = r.risk === "late" ? "critical" : r.risk === "tight" ? "warning" : "good";
              return (
                <li key={r.so.id} className="grid grid-cols-[300px_1fr] items-center border-b border-line py-2">
                  <div className="flex items-center gap-3 pr-3">
                    <span className={cx("num w-6 text-center text-[10px] font-bold", r.so.priority === 1 ? "text-accent" : "text-ink-3")}>
                      P{r.so.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="num text-[12.5px] font-semibold">{r.so.number}</span>
                        <span className="truncate text-[12.5px]">{r.customer}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Status tone={tone}>{r.risk}</Status>
                        <span className="num text-[11px] text-ink-3">
                          {fmtMoney(r.value)} · slack {r.slackDays === null ? "—" : fmtDays(r.slackDays)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-8">
                    <span className="absolute inset-y-0 border-l-2 border-dashed border-accent/70" style={{ left: today }} title="Now" />
                    <span
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/15"
                      style={{ left: x(+r.so.createdAt), width: `calc(${x(+r.so.dueAt)} - ${x(+r.so.createdAt)})` }}
                    />
                    <span
                      className="absolute top-1/2 h-4 -translate-y-1/2 border-l-2 border-ink"
                      style={{ left: x(+r.so.dueAt) }}
                      title={`Due ${new Date(r.so.dueAt).toDateString()}`}
                    />
                    {finish && (
                      <span
                        className={cx("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-panel", `bg-${tone}`)}
                        style={{ left: x(finish) }}
                        title={`Forecast ready ${new Date(finish).toDateString()}`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 ml-[300px] flex flex-wrap gap-5 font-mono text-[10.5px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-6 rounded-full bg-ink/15" /> order open → due
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 border-l-2 border-ink" /> due date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rotate-45 bg-good" /> forecast ready (colour = risk)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 border-l-2 border-dashed border-accent" /> now
            </span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

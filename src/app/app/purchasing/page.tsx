import { Suspense } from "react";
import { getSnapshot } from "@/lib/db/queries";
import { fmtMoney, OPEN_PO_STATUSES, poValue } from "@/lib/domain/plant";
import { receivePoAction } from "@/app/actions";
import { Meter, Sheet, SkeletonRows, Status, Td, Th, TitleBlock, type Tone } from "@/components/ui";
import { RunAgentsButton } from "@/components/plant/run-agents";

export const metadata = { title: "Purchasing" };

const STATUS_TONE: Record<string, Tone> = { draft: "neutral", sent: "blue", confirmed: "good", received: "neutral", cancelled: "neutral" };

export default function PurchasingPage() {
  return (
    <>
      <TitleBlock
        sheet="04"
        title="Purchasing"
        subtitle="Every PO, who raised it (human or agent), and how far each supplier can be trusted."
        cells={[
          { k: "Approval", v: "Autopilot → human" },
          { k: "3-way match", v: "via Ingest" },
        ]}
        actions={<RunAgentsButton label="Scan for reorders" />}
      />
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <Purchasing />
      </Suspense>
    </>
  );
}

async function Purchasing() {
  const s = await getSnapshot();
  return (
    <div className="grid gap-4 2xl:grid-cols-[1.4fr_1fr]">
      <Sheet fig="FIG. 04-A" title="Purchase orders" bodyClassName="p-0">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr>
                <Th>PO</Th>
                <Th>Supplier</Th>
                <Th>Lines</Th>
                <Th>Status</Th>
                <Th>Expected</Th>
                <Th right>Value</Th>
                <Th>Raised by</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {s.purchaseOrders.map((po) => {
                const sup = s.suppliers.find((x) => x.id === po.supplierId)!;
                const open = OPEN_PO_STATUSES.includes(po.status);
                const overdue = open && +po.expectedAt < s.now;
                const lines = s.poLines.filter((l) => l.poId === po.id);
                return (
                  <tr key={po.id} className="hover:bg-panel-2/60">
                    <Td mono className="font-semibold">
                      {po.number}
                    </Td>
                    <Td>
                      <div>{sup.name}</div>
                      <div className="label !text-[9.5px]">{sup.code}</div>
                    </Td>
                    <Td mono className="text-[11.5px] text-ink-2">
                      {lines.map((l) => (
                        <div key={l.id}>
                          {l.qty}× {s.items.find((i) => i.id === l.itemId)?.sku}
                        </div>
                      ))}
                    </Td>
                    <Td>
                      <Status tone={overdue ? "critical" : (STATUS_TONE[po.status] ?? "neutral")}>{overdue ? "overdue" : po.status}</Status>
                    </Td>
                    <Td mono>{new Date(po.expectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</Td>
                    <Td right mono>
                      {fmtMoney(poValue(s, po.id))}
                    </Td>
                    <Td mono className={po.createdBy.startsWith("user") ? "text-accent" : "text-blue"}>
                      {po.createdBy}
                    </Td>
                    <Td>
                      {open && (
                        <form action={receivePoAction}>
                          <input type="hidden" name="id" value={po.id} />
                          <button className="font-mono text-[10.5px] font-semibold tracking-wider whitespace-nowrap text-accent uppercase hover:underline">
                            Receive ↧
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sheet>
      <Sheet fig="FIG. 04-B" title="Supplier scorecard">
        <ul className="space-y-3">
          {[...s.suppliers]
            .sort((a, b) => a.onTimeRate - b.onTimeRate)
            .map((sup) => {
              const tone: Tone = sup.onTimeRate < 0.8 ? "critical" : sup.onTimeRate < 0.9 ? "warning" : "good";
              return (
                <li key={sup.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <span className="num mr-2 text-[11px] text-ink-3">{sup.code}</span>
                    <span className="text-[13px] font-medium">{sup.name}</span>
                  </div>
                  <span className="num text-[11px] text-ink-2">
                    {sup.country} · {sup.leadTimeDays}d lead
                  </span>
                  <div className="col-span-2 grid grid-cols-[64px_1fr_48px] items-center gap-2">
                    <span className="label">On-time</span>
                    <Meter value={sup.onTimeRate} tone={tone} label={`${sup.name} on-time`} />
                    <span className="num text-right text-[12px]">{Math.round(sup.onTimeRate * 100)}%</span>
                    <span className="label">Quality</span>
                    <Meter value={sup.qualityRate} tone="blue" label={`${sup.name} quality`} />
                    <span className="num text-right text-[12px]">{(sup.qualityRate * 100).toFixed(1)}%</span>
                  </div>
                </li>
              );
            })}
        </ul>
      </Sheet>
    </div>
  );
}

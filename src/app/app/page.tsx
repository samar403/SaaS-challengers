import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getSnapshot, listEvents, listProposals } from "@/lib/db/queries";
import { computeKpis, fmtMoney, type Snapshot } from "@/lib/domain/plant";
import { detectSignals, templateBrief } from "@/lib/domain/signals";
import { writeShiftBrief } from "@/lib/ai/extract";
import { aiMode } from "@/lib/ai/client";
import { getCurrentUser } from "@/lib/auth/session";
import { Sheet, SkeletonRows, StatTile, Status, TitleBlock } from "@/components/ui";
import { LineStrip } from "@/components/plant/line-strip";
import { RunAgentsButton } from "@/components/plant/run-agents";
import { Markdown } from "@/components/markdown";
import { LedgerList } from "@/components/plant/ledger-list";

export const metadata = { title: "Command deck" };

export default function CommandDeck() {
  return (
    <>
      <TitleBlock
        sheet="01"
        title="Command deck"
        subtitle="The whole plant on one sheet. Exceptions surface themselves; agents draft the fix; you approve."
        cells={[
          { k: "Plant", v: "DAY-01" },
          { k: "Scale", v: "1 : 1 live" },
          { k: "Rev", v: "C" },
        ]}
        actions={<RunAgentsButton />}
      />
      <Suspense fallback={<DeckSkeleton />}>
        <Deck />
      </Suspense>
    </>
  );
}

function DeckSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="sheet hatch h-[118px] animate-pulse" />
      ))}
    </div>
  );
}

async function Deck() {
  const [s, user, pending, events] = await Promise.all([getSnapshot(), getCurrentUser(), listProposals("pending"), listEvents(7)]);
  const k = computeKpis(s);
  const signals = detectSignals(s);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Good shift, <span className="font-semibold text-ink">{user.name.split(" ")[0]}</span>. {signals.length} exception{signals.length === 1 ? "" : "s"} need
        eyes, {pending.length} proposal{pending.length === 1 ? "" : "s"} awaiting approval.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          fig="K-01"
          label="Projected OTD"
          value={`${(k.projectedOtd * 100).toFixed(0)}`}
          unit="%"
          tone={k.projectedOtd < 0.9 ? "critical" : "good"}
          note={`${fmtMoney(k.atRiskValue, true)} revenue at risk`}
        />
        <StatTile
          fig="K-02"
          label="Open orders"
          value={fmtMoney(k.openSoValue, true)}
          note={`${s.salesOrders.filter((o) => o.status !== "shipped").length} sales orders`}
        />
        <StatTile
          fig="K-03"
          label="WIP / blocked"
          value={`${k.wip}`}
          unit={`/ ${k.blocked}`}
          tone={k.blocked ? "serious" : "neutral"}
          note="work orders on the floor"
        />
        <StatTile
          fig="K-04"
          label="Avg OEE"
          value={(k.avgOee * 100).toFixed(0)}
          unit="%"
          tone={k.avgOee < 0.75 ? "warning" : "good"}
          note="world-class ≈ 85%"
        />
        <StatTile
          fig="K-05"
          label="Inventory"
          value={fmtMoney(k.inventoryValue, true)}
          note={`${k.criticalItems} critical SKU${k.criticalItems === 1 ? "" : "s"}`}
          tone={k.criticalItems ? "serious" : "neutral"}
        />
        <StatTile
          fig="K-06"
          label="Open POs"
          value={fmtMoney(k.openPoValue, true)}
          note={`${k.overduePos} overdue`}
          tone={k.overduePos ? "warning" : "neutral"}
        />
      </div>

      <Sheet
        fig="FIG. 01-A"
        title="Line flow"
        aside={
          <Link href="/app/production" className="label hover:text-ink">
            Open sheet 02 →
          </Link>
        }
      >
        <LineStrip s={s} />
      </Sheet>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Sheet fig="FIG. 01-B" title="Shift brief" aside={<span className="label">{aiMode() === "claude" ? "Written by Claude" : "Template · offline"}</span>}>
          <Suspense fallback={<SkeletonRows rows={4} />}>
            <ShiftBrief s={s} pending={pending.length} />
          </Suspense>
        </Sheet>
        <Sheet
          fig="FIG. 01-C"
          title="Autopilot queue"
          aside={
            <Link href="/app/autopilot" className="label hover:text-ink">
              Review →
            </Link>
          }
        >
          {pending.length ? (
            <ul className="divide-y divide-line">
              {pending.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{p.title}</div>
                    <div className="label !normal-case !tracking-normal">{p.impact}</div>
                  </div>
                  <span className="num shrink-0 text-[11px] text-ink-3">{Math.round(p.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Queue is empty. Run the agents to scan the plant.</p>
          )}
        </Sheet>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Sheet fig="FIG. 01-D" title="Signals" aside={<span className="label">{signals.length} open</span>}>
          <ul className="divide-y divide-line">
            {signals.slice(0, 7).map((x) => (
              <li key={x.entity + x.title}>
                <Link href={x.href} className="group flex items-start gap-3 py-2.5">
                  <Status tone={x.tone} className="w-20 shrink-0 pt-0.5">
                    {x.tone}
                  </Status>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium group-hover:underline">{x.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">{x.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
        <Sheet
          fig="FIG. 01-E"
          title="Ledger tail"
          aside={
            <Link href="/app/ledger" className="label hover:text-ink">
              Sheet 11 →
            </Link>
          }
        >
          <LedgerList events={events} />
        </Sheet>
      </div>
    </div>
  );
}

async function ShiftBrief({ s, pending }: { s: Snapshot; pending: number }) {
  await connection();
  const k = computeKpis(s);
  const signals = detectSignals(s).slice(0, 8);
  const ai = await writeShiftBrief(JSON.stringify({ kpis: k, signals, pendingProposals: pending }));
  return <Markdown text={ai ?? templateBrief(s, pending)} />;
}

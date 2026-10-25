import { Suspense } from "react";
import { listEvents } from "@/lib/db/queries";
import { Sheet, SkeletonRows, TitleBlock } from "@/components/ui";
import { LedgerList } from "@/components/plant/ledger-list";

export const metadata = { title: "Ledger" };

export default function LedgerPage() {
  return (
    <>
      <TitleBlock
        sheet="11"
        title="Ledger"
        subtitle="Append-only record of every change — by people, by agents, by the copilot. Nothing edits history; corrections are new entries."
        cells={[
          { k: "Retention", v: "∞ · immutable" },
          { k: "Export", v: "SOX / ISO 9001" },
        ]}
      />
      <Suspense fallback={<SkeletonRows rows={12} />}>
        <Ledger />
      </Suspense>
    </>
  );
}

async function Ledger() {
  const events = await listEvents(200);
  const counts = { human: 0, agent: 0, system: 0 };
  for (const e of events) {
    if (e.actor.startsWith("user:")) counts.human++;
    else if (e.actor === "system") counts.system++;
    else counts.agent++;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Sheet fig="FIG. 11-A" title="Event stream" aside={<span className="label">{events.length} entries</span>}>
        <LedgerList events={events} dense={false} />
      </Sheet>
      <Sheet fig="FIG. 11-B" title="Who changed the plant">
        <dl className="space-y-3">
          {[
            ["Humans", counts.human, "text-accent"],
            ["Agents & copilot", counts.agent, "text-blue"],
            ["System", counts.system, "text-ink-3"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="flex items-baseline justify-between border-b border-line pb-2">
              <dt className={`text-[13px] ${c}`}>● {k}</dt>
              <dd className="num text-xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-ink-2">
          Agents never write directly: every agent action in this ledger follows a human approval recorded right before it.
        </p>
      </Sheet>
    </div>
  );
}

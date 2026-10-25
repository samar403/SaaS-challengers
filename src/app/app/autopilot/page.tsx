import { Suspense } from "react";
import { listProposals } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { canApprove } from "@/lib/auth/users";
import { AGENTS } from "@/lib/domain/agents";
import { Empty, Sheet, SkeletonRows, TitleBlock } from "@/components/ui";
import { RunAgentsButton } from "@/components/plant/run-agents";
import { ProposalCard } from "@/components/plant/proposal-card";

export const metadata = { title: "Autopilot" };

export default function AutopilotPage() {
  return (
    <>
      <TitleBlock
        sheet="07"
        title="Autopilot"
        subtitle="Agents watch the plant around the clock and draft the paperwork. Nothing executes until a person with the right role approves it."
        cells={[
          { k: "Mode", v: "Human-in-the-loop" },
          { k: "Agents", v: `${Object.keys(AGENTS).length} + copilot` },
        ]}
        actions={<RunAgentsButton />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Suspense fallback={<SkeletonRows rows={6} />}>
          <Queue />
        </Suspense>
        <Sheet fig="FIG. 07-Z" title="Agent roster" className="self-start">
          <ul className="space-y-3">
            {Object.entries(AGENTS).map(([k, a]) => (
              <li key={k} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{a.label}</span>
                  <span className="num text-[10px] text-good">● armed</span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-2">{a.blurb}</p>
              </li>
            ))}
            <li>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">Copilot drafts</span>
                <span className="num text-[10px] text-blue">● on request</span>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-2">POs, maintenance windows and customer orders drafted from chat and documents.</p>
            </li>
          </ul>
        </Sheet>
      </div>
    </>
  );
}

async function Queue() {
  const [user, all] = await Promise.all([getCurrentUser(), listProposals()]);
  const pending = all.filter((p) => p.status === "pending");
  const decided = all.filter((p) => p.status !== "pending").slice(0, 12);
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="label">Awaiting decision · {pending.length}</h2>
          <span className="label">Signed in as {user.title}</span>
        </div>
        {pending.length ? (
          <div className="space-y-3">
            {pending.map((p) => (
              <ProposalCard key={p.id} p={p} canApprove={canApprove(user.role, p.agent)} />
            ))}
          </div>
        ) : (
          <Empty title="Queue clear">Run the agents to scan inventory, schedules, machines and suppliers for anything that needs a decision.</Empty>
        )}
      </section>
      {decided.length > 0 && (
        <section>
          <h2 className="label mb-2">Recently decided</h2>
          <div className="space-y-3">
            {decided.map((p) => (
              <ProposalCard key={p.id} p={p} canApprove={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

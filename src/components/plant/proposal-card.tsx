"use client";

import { useActionState } from "react";
import { decideAction, type ActionResult } from "@/app/actions";
import { Button, cx, Meter, Stamp } from "@/components/ui";
import type { Proposal } from "@/lib/db/schema";

const AGENT_GLYPH: Record<Proposal["agent"], string> = {
  reorder: "RO",
  expedite: "EX",
  maintenance: "PM",
  supplier: "SR",
  copilot: "CP",
};

export function ProposalCard({ p, canApprove }: { p: Proposal; canApprove: boolean }) {
  const [state, act, pending] = useActionState<ActionResult, FormData>(decideAction, null);
  const decided = p.status !== "pending";
  return (
    <article className={cx("sheet reg rise relative p-4", decided && "opacity-80")}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-line-strong font-mono text-[11px] font-bold text-blue">
          {AGENT_GLYPH[p.agent]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="label">
              AP-{String(p.id).padStart(4, "0")} · agent:{p.agent}
            </span>
          </div>
          <h3 className="mt-0.5 text-[14.5px] leading-snug font-semibold">{p.title}</h3>
          <p className="mt-1.5 text-[13px] text-ink-2">{p.rationale}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="num rounded-[2px] bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold">{p.impact}</span>
            <span className="flex w-44 items-center gap-2">
              <span className="label">Conf.</span>
              <Meter className="flex-1" value={p.confidence} tone="blue" label="Confidence" />
              <span className="num text-[11px]">{Math.round(p.confidence * 100)}%</span>
            </span>
          </div>
        </div>
        {decided && (
          <div className="absolute top-4 right-4">
            <Stamp tone={p.status === "approved" ? "good" : "critical"}>{p.status}</Stamp>
          </div>
        )}
      </div>
      {!decided && (
        <form action={act} className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="agent" value={p.agent} />
          <Button
            variant="primary"
            name="decision"
            value="approve"
            disabled={pending || !canApprove}
            title={canApprove ? undefined : "Your role can't approve this agent's proposals"}
          >
            ✓ Approve &amp; execute
          </Button>
          <Button variant="danger" name="decision" value="reject" disabled={pending}>
            ✕ Reject
          </Button>
          {!canApprove && <span className="font-mono text-[11px] text-warning">▲ Needs plant manager</span>}
          {state && (
            <span role="status" className={cx("font-mono text-[11px]", state.ok ? "text-good" : "text-critical")}>
              {state.message}
            </span>
          )}
        </form>
      )}
      {decided && p.decidedBy && (
        <div className="mt-3 border-t border-line pt-2 font-mono text-[10.5px] text-ink-3">
          {p.status} by {p.decidedBy}
        </div>
      )}
    </article>
  );
}

import { assetRisk, fmtMoney, OPEN_PO_STATUSES, salesOrderRisk, stockPositions, type Snapshot } from "./plant";

export type Signal = {
  tone: "critical" | "serious" | "warning";
  title: string;
  detail: string;
  href: string;
  entity: string;
  weight: number;
};

/** Cross-module anomalies, ranked. This is what a planner used to find by hand in four reports. */
export function detectSignals(s: Snapshot): Signal[] {
  const out: Signal[] = [];
  for (const r of salesOrderRisk(s).filter((r) => r.risk === "late")) {
    const wo = s.workOrders.find((w) => w.salesOrderId === r.so.id);
    out.push({
      tone: "critical",
      title: `${r.so.number} for ${r.customer} will ship late`,
      detail: `${fmtMoney(r.value)} · ${Math.abs(r.slackDays ?? 0).toFixed(1)}d behind${wo?.blockedReason ? ` · ${wo.blockedReason}` : wo ? ` · ${wo.number} at ${wo.station}` : ""}`,
      href: "/app/orders",
      entity: r.so.number,
      weight: 100 + r.value / 1000,
    });
  }
  for (const p of stockPositions(s).filter((p) => p.health === "critical")) {
    out.push({
      tone: "serious",
      title: `${p.item.sku} has ${p.daysOfCover.toFixed(1)} days of cover`,
      detail: `${p.available} ${p.item.uom} available, ${p.inbound} inbound · ${p.item.name}`,
      href: "/app/inventory",
      entity: p.item.sku,
      weight: 80 - p.daysOfCover,
    });
  }
  for (const r of s.assets.map(assetRisk).filter((r) => r.failureRisk >= 0.55)) {
    out.push({
      tone: r.failureRisk > 0.7 ? "serious" : "warning",
      title: `${r.asset.code} failure risk ${Math.round(r.failureRisk * 100)}%`,
      detail: `${r.asset.name} · ${r.reasons.slice(0, 2).join("; ")}`,
      href: "/app/assets",
      entity: r.asset.code,
      weight: 60 + r.failureRisk * 10,
    });
  }
  for (const po of s.purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status) && +p.expectedAt < s.now)) {
    const sup = s.suppliers.find((x) => x.id === po.supplierId);
    out.push({
      tone: "warning",
      title: `${po.number} from ${sup?.name} is overdue`,
      detail: `Expected ${new Date(po.expectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · supplier on-time ${Math.round((sup?.onTimeRate ?? 0) * 100)}%`,
      href: "/app/purchasing",
      entity: po.number,
      weight: 50,
    });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Deterministic shift brief used when Claude is not configured. */
export function templateBrief(s: Snapshot, pending: number): string {
  const sig = detectSignals(s).slice(0, 4);
  const lines = sig.map((x) => `- **${x.title}.** ${x.detail}.`);
  if (pending) lines.push(`- **${pending} autopilot proposal${pending > 1 ? "s" : ""} waiting** for approval on Sheet 07.`);
  return lines.join("\n") || "- No exceptions. The plant is running to plan.";
}

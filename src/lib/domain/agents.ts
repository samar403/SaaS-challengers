import type { Proposal, ProposalPayload } from "@/lib/db/schema";
import { assetRisk, fmtMoney, forecastWorkOrders, OPEN_PO_STATUSES, stockPositions, STATION_LABEL, type Snapshot } from "./plant";

/**
 * Autopilot agents. Each one reads the plant snapshot and returns proposals.
 * Agents never write to the ledger directly: a human approves, then the
 * executor applies the payload. This keeps the system auditable and makes
 * agent behaviour unit-testable without an LLM in the loop.
 */

export type ProposalDraft = Pick<Proposal, "agent" | "title" | "rationale" | "impact" | "confidence" | "dedupeKey"> & {
  payload: ProposalPayload;
};

export function reorderAgent(s: Snapshot): ProposalDraft[] {
  const needs = stockPositions(s).filter((p) => p.item.supplierId && (p.health === "critical" || p.health === "low"));
  const bySupplier = new Map<number, typeof needs>();
  for (const n of needs) {
    const k = n.item.supplierId!;
    bySupplier.set(k, [...(bySupplier.get(k) ?? []), n]);
  }
  const drafts: ProposalDraft[] = [];
  for (const [supplierId, list] of bySupplier) {
    const supplier = s.suppliers.find((x) => x.id === supplierId)!;
    const lines = list.map((p) => {
      const gap = Math.max(0, p.threshold - p.projected);
      // Round to the reorder lot so suppliers get the pack sizes they quote.
      const lots = Math.max(1, Math.ceil(gap / Math.max(1, p.item.reorderQty)));
      return { itemId: p.item.id, qty: lots * p.item.reorderQty, unitCost: p.item.unitCost };
    });
    const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
    const critical = list.filter((p) => p.health === "critical");
    const names = list.map((p) => `${p.item.sku} (${p.daysOfCover.toFixed(1)}d cover)`).join(", ");
    drafts.push({
      agent: "reorder",
      title: `Replenish ${list.length} SKU${list.length > 1 ? "s" : ""} from ${supplier.name}`,
      rationale: `Projected stock is under the lead-time-adjusted reorder threshold for ${names}. ${supplier.name} quotes ${supplier.leadTimeDays}d lead time at ${Math.round(supplier.onTimeRate * 100)}% on-time.`,
      impact: `${fmtMoney(total)} PO${critical.length ? ` · prevents stock-out on ${critical.length} critical SKU${critical.length > 1 ? "s" : ""}` : ""}`,
      confidence: critical.length ? 0.92 : 0.81,
      dedupeKey: `reorder:${supplierId}:${list
        .map((p) => p.item.id)
        .sort()
        .join(",")}`,
      payload: { kind: "create_po", supplierId, lines },
    });
  }
  return drafts;
}

export function expediteAgent(s: Snapshot): ProposalDraft[] {
  return forecastWorkOrders(s)
    .filter((f) => f.late && f.wo.priority > 1 && f.wo.status !== "blocked")
    .map((f) => {
      const item = s.items.find((i) => i.id === f.wo.itemId);
      const so = s.salesOrders.find((o) => o.id === f.wo.salesOrderId);
      return {
        agent: "expedite" as const,
        title: `Expedite ${f.wo.number} at ${STATION_LABEL[f.wo.station]}`,
        rationale: `${f.wo.number} (${f.wo.qty}× ${item?.name ?? "item"}) has ${f.queueHoursAhead.toFixed(0)}h queued ahead of it and finishes ${Math.abs(f.slackDays).toFixed(1)} days after its due date${so ? ` for ${so.number}` : ""}.`,
        impact: `Raise to priority 1 · recovers ~${Math.min(Math.abs(f.slackDays), f.queueHoursAhead / 14).toFixed(1)} days`,
        confidence: 0.77,
        dedupeKey: `expedite:${f.wo.id}`,
        payload: { kind: "expedite_wo" as const, workOrderId: f.wo.id, newPriority: 1 },
      };
    });
}

export function maintenanceAgent(s: Snapshot): ProposalDraft[] {
  return s.assets
    .map(assetRisk)
    .filter((r) => r.failureRisk >= 0.55 && r.asset.status !== "maintenance")
    .map((r) => ({
      agent: "maintenance" as const,
      title: `Schedule preventive maintenance on ${r.asset.code} · ${r.asset.name}`,
      rationale: `Failure risk ${Math.round(r.failureRisk * 100)}%: ${r.reasons.join("; ")}. A planned 4h window now is cheaper than an unplanned breakdown at ${STATION_LABEL[r.asset.station]}.`,
      impact: `4h planned downtime · avoids est. ${Math.round(r.asset.mtbfHours * 0.02)}h unplanned`,
      confidence: Math.min(0.95, 0.5 + r.failureRisk / 2),
      dedupeKey: `maintenance:${r.asset.id}`,
      payload: { kind: "schedule_maintenance" as const, assetId: r.asset.id, hours: 4 },
    }));
}

export function supplierAgent(s: Snapshot): ProposalDraft[] {
  const drafts: ProposalDraft[] = [];
  const openPos = s.purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status));
  for (const sup of s.suppliers) {
    if (sup.onTimeRate >= 0.8) continue;
    const late = openPos.filter((p) => p.supplierId === sup.id && +p.expectedAt < s.now);
    const itemIds = s.items.filter((i) => i.supplierId === sup.id).map((i) => i.id);
    if (!late.length && !itemIds.length) continue;
    // Best alternate: a reliable supplier that already sells the same kind of material
    // (raw stock, components…), ranked by on-time rate; domestic breaks ties.
    const cats = new Set(s.items.filter((i) => i.supplierId === sup.id).map((i) => i.category));
    const overlap = (id: number) => s.items.filter((i) => i.supplierId === id && cats.has(i.category)).length;
    const alt = s.suppliers
      .filter((x) => x.id !== sup.id && x.onTimeRate >= 0.9 && overlap(x.id) > 0)
      .sort((a, b) => b.onTimeRate - a.onTimeRate || Number(b.country === "US") - Number(a.country === "US"))[0];
    if (!alt) continue;
    drafts.push({
      agent: "supplier",
      title: `Dual-source ${itemIds.length} SKUs away from ${sup.name}`,
      rationale: `${sup.name} is at ${Math.round(sup.onTimeRate * 100)}% on-time${late.length ? ` with ${late.length} overdue PO${late.length > 1 ? "s" : ""} (${late.map((p) => p.number).join(", ")})` : ""}. ${alt.name} runs ${Math.round(alt.onTimeRate * 100)}% on-time with a ${alt.leadTimeDays}d lead.`,
      impact: `Moves default supplier for ${itemIds.length} SKUs · lowers supply risk`,
      confidence: 0.68,
      dedupeKey: `supplier:${sup.id}:${alt.id}`,
      payload: { kind: "resource_supplier", fromSupplierId: sup.id, toSupplierId: alt.id, itemIds },
    });
  }
  return drafts;
}

export const AGENTS = {
  reorder: { label: "Reorder", run: reorderAgent, blurb: "Watches projected stock against lead-time-adjusted thresholds and drafts POs." },
  expedite: { label: "Expedite", run: expediteAgent, blurb: "Simulates station queues and flags work orders that will miss their ship date." },
  maintenance: { label: "Maintenance", run: maintenanceAgent, blurb: "Scores asset failure risk from health, MTBF and vibration telemetry." },
  supplier: { label: "Supplier risk", run: supplierAgent, blurb: "Tracks supplier on-time performance and proposes dual-sourcing." },
} as const;

export function runAllAgents(s: Snapshot): ProposalDraft[] {
  return Object.values(AGENTS).flatMap((a) => a.run(s));
}

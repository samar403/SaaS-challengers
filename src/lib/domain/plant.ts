import type { Asset, Item, PurchaseOrder, SalesOrder, Station, Supplier, WorkOrder } from "@/lib/db/schema";

/**
 * Pure planning math. Everything here takes a Snapshot and returns plain data,
 * so the agents, the copilot tools and the UI all agree on the same numbers.
 */

export type PoLine = { id: number; poId: number; itemId: number; qty: number; unitCost: number };
export type SoLine = { id: number; soId: number; itemId: number; qty: number; unitPrice: number };
export type Customer = { id: number; name: string; region: string };

export type Snapshot = {
  now: number;
  items: Item[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: PoLine[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  soLines: SoLine[];
  workOrders: WorkOrder[];
  assets: Asset[];
};

export const DAY = 86_400_000;
/** Productive hours per station per day (two shifts, minus changeovers). */
export const STATION_HOURS_PER_DAY = 14;
export const OPEN_PO_STATUSES: PurchaseOrder["status"][] = ["draft", "sent", "confirmed"];

export const STATION_LABEL: Record<Station, string> = {
  cut: "Cut & form",
  machine: "Machining",
  weld: "Weld",
  finish: "Finish",
  qa: "Inspect",
  done: "Ship",
};

export function inboundQty(s: Snapshot, itemId: number): number {
  const open = new Set(s.purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status)).map((p) => p.id));
  return s.poLines.filter((l) => l.itemId === itemId && open.has(l.poId)).reduce((a, l) => a + l.qty, 0);
}

export type StockPosition = {
  item: Item;
  available: number;
  inbound: number;
  projected: number;
  daysOfCover: number;
  /** Stock needed to survive the supplier lead time plus the reorder point. */
  threshold: number;
  health: "critical" | "low" | "ok" | "excess";
};

export function stockPosition(s: Snapshot, item: Item): StockPosition {
  const supplier = s.suppliers.find((x) => x.id === item.supplierId);
  const lead = supplier?.leadTimeDays ?? 7;
  const available = item.onHand - item.allocated;
  const inbound = inboundQty(s, item.id);
  const projected = available + inbound;
  const daysOfCover = item.dailyUsage > 0 ? available / item.dailyUsage : Infinity;
  const threshold = item.reorderPoint + item.dailyUsage * Math.min(lead, 14) * 0.5;
  let health: StockPosition["health"] = "ok";
  // Finished goods are built to order: zero free stock just means it's all promised.
  if (item.category === "finished") health = available < 0 ? "critical" : "ok";
  else if (available <= 0 || daysOfCover < lead / 2) health = "critical";
  else if (projected < threshold) health = "low";
  else if (item.dailyUsage > 0 && daysOfCover > 90) health = "excess";
  return { item, available, inbound, projected, daysOfCover, threshold, health };
}

export function stockPositions(s: Snapshot): StockPosition[] {
  return s.items.map((i) => stockPosition(s, i));
}

export type WoForecast = {
  wo: WorkOrder;
  queueHoursAhead: number;
  finishAt: number;
  slackDays: number;
  late: boolean;
};

/**
 * Finite-capacity-lite: a work order waits for every higher-priority (or
 * equal-priority, earlier-due) job at its station, then needs its own hours.
 */
export function forecastWorkOrders(s: Snapshot): WoForecast[] {
  const active = s.workOrders.filter((w) => w.status !== "done");
  return active.map((wo) => {
    const ahead = active.filter(
      (o) => o.id !== wo.id && o.station === wo.station && (o.priority < wo.priority || (o.priority === wo.priority && +o.dueAt < +wo.dueAt)),
    );
    const queueHoursAhead = ahead.reduce((a, o) => a + o.hoursRemaining, 0);
    const blockedPenaltyH = wo.status === "blocked" ? STATION_HOURS_PER_DAY : 0;
    const finishAt = s.now + ((queueHoursAhead + wo.hoursRemaining + blockedPenaltyH) / STATION_HOURS_PER_DAY) * DAY;
    const slackDays = (+wo.dueAt - finishAt) / DAY;
    return { wo, queueHoursAhead, finishAt, slackDays, late: slackDays < 0 };
  });
}

export function soValue(s: Snapshot, soId: number): number {
  return s.soLines.filter((l) => l.soId === soId).reduce((a, l) => a + l.qty * l.unitPrice, 0);
}

export function poValue(s: Snapshot, poId: number): number {
  return s.poLines.filter((l) => l.poId === poId).reduce((a, l) => a + l.qty * l.unitCost, 0);
}

export type OrderRisk = { so: SalesOrder; customer: string; value: number; slackDays: number | null; risk: "late" | "tight" | "ok" };

export function salesOrderRisk(s: Snapshot): OrderRisk[] {
  const fc = forecastWorkOrders(s);
  return s.salesOrders
    .filter((o) => o.status !== "shipped" && o.status !== "cancelled")
    .map((so) => {
      const mine = fc.filter((f) => f.wo.salesOrderId === so.id);
      const slack = mine.length ? Math.min(...mine.map((f) => f.slackDays)) : (+so.dueAt - s.now) / DAY;
      const risk: OrderRisk["risk"] = slack < 0 ? "late" : slack < 1 ? "tight" : "ok";
      return {
        so,
        customer: s.customers.find((c) => c.id === so.customerId)?.name ?? "—",
        value: soValue(s, so.id),
        slackDays: Number.isFinite(slack) ? slack : null,
        risk,
      };
    })
    .sort((a, b) => (a.slackDays ?? 99) - (b.slackDays ?? 99));
}

export type Kpis = {
  inventoryValue: number;
  openPoValue: number;
  openSoValue: number;
  projectedOtd: number; // 0..1
  wip: number;
  blocked: number;
  avgOee: number;
  criticalItems: number;
  atRiskValue: number;
  overduePos: number;
};

export function computeKpis(s: Snapshot): Kpis {
  const risks = salesOrderRisk(s);
  const positions = stockPositions(s);
  const openPos = s.purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status));
  return {
    inventoryValue: s.items.reduce((a, i) => a + i.onHand * i.unitCost, 0),
    openPoValue: openPos.reduce((a, p) => a + poValue(s, p.id), 0),
    openSoValue: risks.reduce((a, r) => a + r.value, 0),
    projectedOtd: risks.length ? risks.filter((r) => r.risk !== "late").length / risks.length : 1,
    wip: s.workOrders.filter((w) => w.status !== "done").length,
    blocked: s.workOrders.filter((w) => w.status === "blocked").length,
    avgOee: s.assets.length ? s.assets.reduce((a, x) => a + x.oee, 0) / s.assets.length : 0,
    criticalItems: positions.filter((p) => p.health === "critical").length,
    atRiskValue: risks.filter((r) => r.risk === "late").reduce((a, r) => a + r.value, 0),
    overduePos: openPos.filter((p) => +p.expectedAt < s.now).length,
  };
}

export type AssetRisk = { asset: Asset; failureRisk: number; reasons: string[] };

/** A transparent heuristic, not a black box: every point of risk has a reason. */
export function assetRisk(a: Asset): AssetRisk {
  const reasons: string[] = [];
  let risk = (100 - a.health) / 100;
  const serviceRatio = a.hoursSinceService / a.mtbfHours;
  if (serviceRatio > 0.8) {
    risk += 0.15;
    reasons.push(`${Math.round(serviceRatio * 100)}% of MTBF since last service`);
  }
  if (a.vibration > 6) {
    risk += 0.2;
    reasons.push(`vibration ${a.vibration.toFixed(1)} mm/s (ISO 10816 zone C/D)`);
  } else if (a.vibration > 4) {
    risk += 0.08;
    reasons.push(`vibration ${a.vibration.toFixed(1)} mm/s trending up`);
  }
  if (a.health < 65) reasons.push(`health index ${Math.round(a.health)}`);
  if (a.status === "down") {
    risk = 1;
    reasons.unshift("asset is down");
  }
  return { asset: a, failureRisk: Math.min(1, Math.max(0, risk)), reasons };
}

export function fmtMoney(n: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function fmtDays(d: number): string {
  if (!Number.isFinite(d)) return "∞";
  const sign = d < 0 ? "−" : "+";
  return `${sign}${Math.abs(d).toFixed(1)}d`;
}

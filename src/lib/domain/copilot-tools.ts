import { z } from "zod";
import { assetRisk, computeKpis, forecastWorkOrders, OPEN_PO_STATUSES, poValue, salesOrderRisk, STATION_LABEL, stockPositions, type Snapshot } from "./plant";
import { STATIONS } from "@/lib/db/schema";

/**
 * Read-only copilot tools. Each returns compact JSON-able data — the same
 * functions back Claude's tool calls and the offline intent engine.
 */

const round = (n: number, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const readTools = {
  plant_kpis: {
    description:
      "Headline plant KPIs: inventory value, open PO/SO value, projected on-time delivery, WIP, blocked jobs, average OEE, critical SKUs, revenue at risk. Call first for any 'how are we doing' question.",
    schema: z.object({}),
    run: (s: Snapshot) => {
      const k = computeKpis(s);
      return {
        ...k,
        projectedOtdPct: round(k.projectedOtd * 100),
        avgOeePct: round(k.avgOee * 100),
        inventoryValue: Math.round(k.inventoryValue),
        openPoValue: Math.round(k.openPoValue),
        openSoValue: Math.round(k.openSoValue),
        atRiskValue: Math.round(k.atRiskValue),
      };
    },
  },
  search_inventory: {
    description:
      "Stock positions for items: on hand, allocated, available, inbound on open POs, days of cover and health (critical/low/ok/excess). Filter by free-text query and/or health.",
    schema: z.object({
      query: z.string().optional().describe("Matches SKU, name or category, case-insensitive"),
      health: z.enum(["critical", "low", "ok", "excess", "attention"]).optional().describe("'attention' = critical or low"),
    }),
    run: (s: Snapshot, i: { query?: string; health?: string }) => {
      const q = i.query?.toLowerCase();
      return stockPositions(s)
        .filter((p) => !q || `${p.item.sku} ${p.item.name} ${p.item.category}`.toLowerCase().includes(q))
        .filter((p) => !i.health || (i.health === "attention" ? p.health === "critical" || p.health === "low" : p.health === i.health))
        .slice(0, 25)
        .map((p) => ({
          sku: p.item.sku,
          name: p.item.name,
          uom: p.item.uom,
          onHand: p.item.onHand,
          available: p.available,
          inbound: p.inbound,
          reorderPoint: p.item.reorderPoint,
          daysOfCover: round(p.daysOfCover),
          health: p.health,
          supplier: s.suppliers.find((x) => x.id === p.item.supplierId)?.code ?? null,
          unitCost: p.item.unitCost,
        }));
    },
  },
  list_work_orders: {
    description:
      "Work orders on the shop floor with station, status, priority, hours remaining, forecast finish date and slack vs due date. Use for production, bottleneck and 'will we ship' questions.",
    schema: z.object({
      station: z.enum(STATIONS).optional(),
      late_only: z.boolean().optional().describe("Only jobs forecast to finish after their due date"),
    }),
    run: (s: Snapshot, i: { station?: string; late_only?: boolean }) =>
      forecastWorkOrders(s)
        .filter((f) => !i.station || f.wo.station === i.station)
        .filter((f) => !i.late_only || f.late)
        .map((f) => ({
          number: f.wo.number,
          item: s.items.find((x) => x.id === f.wo.itemId)?.name,
          qty: f.wo.qty,
          station: STATION_LABEL[f.wo.station],
          status: f.wo.status,
          blockedReason: f.wo.blockedReason,
          priority: f.wo.priority,
          hoursRemaining: f.wo.hoursRemaining,
          queueHoursAhead: round(f.queueHoursAhead),
          due: day(+f.wo.dueAt),
          forecastFinish: day(f.finishAt),
          slackDays: round(f.slackDays),
          salesOrder: s.salesOrders.find((o) => o.id === f.wo.salesOrderId)?.number ?? null,
        })),
  },
  list_sales_orders: {
    description: "Open customer orders with value, due date, slack and delivery risk (late/tight/ok).",
    schema: z.object({ at_risk_only: z.boolean().optional() }),
    run: (s: Snapshot, i: { at_risk_only?: boolean }) =>
      salesOrderRisk(s)
        .filter((r) => !i.at_risk_only || r.risk !== "ok")
        .map((r) => ({
          number: r.so.number,
          customer: r.customer,
          value: Math.round(r.value),
          due: day(+r.so.dueAt),
          priority: r.so.priority,
          status: r.so.status,
          slackDays: r.slackDays === null ? null : round(r.slackDays),
          risk: r.risk,
        })),
  },
  list_purchase_orders: {
    description: "Purchase orders with supplier, status, expected date, value and whether overdue.",
    schema: z.object({ open_only: z.boolean().optional(), supplier_code: z.string().optional() }),
    run: (s: Snapshot, i: { open_only?: boolean; supplier_code?: string }) =>
      s.purchaseOrders
        .filter((p) => !i.open_only || OPEN_PO_STATUSES.includes(p.status))
        .map((p) => ({ p, sup: s.suppliers.find((x) => x.id === p.supplierId)! }))
        .filter(({ sup }) => !i.supplier_code || sup.code === i.supplier_code.toUpperCase())
        .map(({ p, sup }) => ({
          number: p.number,
          supplier: `${sup.code} · ${sup.name}`,
          status: p.status,
          expected: day(+p.expectedAt),
          overdue: OPEN_PO_STATUSES.includes(p.status) && +p.expectedAt < s.now,
          value: Math.round(poValue(s, p.id)),
          lines: s.poLines.filter((l) => l.poId === p.id).map((l) => `${l.qty}× ${s.items.find((x) => x.id === l.itemId)?.sku}`),
          createdBy: p.createdBy,
        })),
  },
  supplier_scorecard: {
    description: "Supplier performance: on-time rate, quality rate, lead time, open PO count and overdue POs.",
    schema: z.object({}),
    run: (s: Snapshot) =>
      s.suppliers.map((sup) => {
        const open = s.purchaseOrders.filter((p) => p.supplierId === sup.id && OPEN_PO_STATUSES.includes(p.status));
        return {
          code: sup.code,
          name: sup.name,
          country: sup.country,
          onTimePct: round(sup.onTimeRate * 100),
          qualityPct: round(sup.qualityRate * 100),
          leadTimeDays: sup.leadTimeDays,
          openPos: open.length,
          overduePos: open.filter((p) => +p.expectedAt < s.now).length,
          skus: s.items.filter((i) => i.supplierId === sup.id).length,
        };
      }),
  },
  asset_health: {
    description:
      "Machine health: status, health index, OEE, vibration, temperature, hours since service vs MTBF, and an explainable failure-risk score with reasons.",
    schema: z.object({ min_risk: z.number().optional().describe("0..1, only assets at or above this failure risk") }),
    run: (s: Snapshot, i: { min_risk?: number }) =>
      s.assets
        .map(assetRisk)
        .filter((r) => r.failureRisk >= (i.min_risk ?? 0))
        .sort((a, b) => b.failureRisk - a.failureRisk)
        .map((r) => ({
          code: r.asset.code,
          name: r.asset.name,
          station: STATION_LABEL[r.asset.station],
          status: r.asset.status,
          health: r.asset.health,
          oeePct: round(r.asset.oee * 100),
          vibration: r.asset.vibration,
          temperature: r.asset.temperature,
          hoursSinceService: r.asset.hoursSinceService,
          mtbfHours: r.asset.mtbfHours,
          failureRiskPct: round(r.failureRisk * 100),
          reasons: r.reasons,
        })),
  },
  station_load: {
    description: "Queued hours and days of backlog per production station — use to find the bottleneck.",
    schema: z.object({}),
    run: (s: Snapshot) =>
      STATIONS.filter((st) => st !== "done").map((st) => {
        const wos = s.workOrders.filter((w) => w.station === st && w.status !== "done");
        const hours = wos.reduce((a, w) => a + w.hoursRemaining, 0);
        return {
          station: STATION_LABEL[st],
          jobs: wos.length,
          blocked: wos.filter((w) => w.status === "blocked").length,
          queuedHours: round(hours),
          backlogDays: round(hours / 14),
          assets: s.assets.filter((a) => a.station === st).map((a) => `${a.code} (${a.status})`),
        };
      }),
  },
} as const;

export type ReadToolName = keyof typeof readTools;

export function runReadTool(name: ReadToolName, s: Snapshot, input: unknown) {
  const tool = readTools[name];
  const parsed = tool.schema.parse(input ?? {});
  return (tool.run as (s: Snapshot, i: unknown) => unknown)(s, parsed);
}

import { beforeAll, describe, expect, it } from "vitest";
import { seededSnapshot } from "./fixture";
import { expediteAgent, maintenanceAgent, reorderAgent, runAllAgents, supplierAgent } from "@/lib/domain/agents";
import type { Snapshot } from "@/lib/domain/plant";

let s: Snapshot;
beforeAll(async () => {
  s = await seededSnapshot();
});

describe("reorder agent", () => {
  it("groups replenishment by supplier and rounds to reorder lots", () => {
    const drafts = reorderAgent(s);
    const glss = s.suppliers.find((x) => x.code === "GLSS")!;
    const p = drafts.find((d) => d.payload.kind === "create_po" && d.payload.supplierId === glss.id)!;
    expect(p).toBeDefined();
    const sheet = s.items.find((i) => i.sku === "RM-SHT-10GA")!;
    const line = p.payload.kind === "create_po" ? p.payload.lines.find((l) => l.itemId === sheet.id) : undefined;
    expect(line?.qty).toBe(120);
    expect(p.confidence).toBeGreaterThan(0.9);
  });

  it("does not reorder healthy stock", () => {
    const yellow = s.items.find((i) => i.sku === "CN-PWD-YEL")!;
    const all = reorderAgent(s).flatMap((d) => (d.payload.kind === "create_po" ? d.payload.lines : []));
    expect(all.some((l) => l.itemId === yellow.id)).toBe(false);
  });
});

describe("other agents", () => {
  it("schedules maintenance for the vibrating mill", () => {
    const codes = maintenanceAgent(s).map((d) => d.title);
    expect(codes.some((t) => t.includes("CNC-03"))).toBe(true);
    expect(codes.some((t) => t.includes("CMM-08"))).toBe(false);
  });

  it("never expedites blocked or already-P1 jobs", () => {
    for (const d of expediteAgent(s)) {
      const wo = s.workOrders.find((w) => d.payload.kind === "expedite_wo" && w.id === d.payload.workOrderId)!;
      expect(wo.status).not.toBe("blocked");
      expect(wo.priority).toBeGreaterThan(1);
    }
  });

  it("proposes dual-sourcing away from sub-80% suppliers", () => {
    const titles = supplierAgent(s).map((d) => d.title);
    expect(titles.some((t) => t.includes("Midwest Metals"))).toBe(true);
    expect(titles.some((t) => t.includes("Shenzhen"))).toBe(true);
  });

  it("re-sources to a supplier that already sells the same category", () => {
    const byCode = (c: string) => s.suppliers.find((x) => x.code === c)!.id;
    const mw = supplierAgent(s).find((d) => d.payload.kind === "resource_supplier" && d.payload.fromSupplierId === byCode("MWMS"))!;
    expect(mw.payload.kind === "resource_supplier" && mw.payload.toSupplierId).toBe(byCode("GLSS"));
    const sz = supplierAgent(s).find((d) => d.payload.kind === "resource_supplier" && d.payload.fromSupplierId === byCode("SZMT"))!;
    expect(sz.payload.kind === "resource_supplier" && sz.payload.toSupplierId).not.toBe(byCode("BKIG"));
  });

  it("produces unique dedupe keys", () => {
    const keys = runAllAgents(s).map((d) => d.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { seededSnapshot } from "./fixture";
import { assetRisk, computeKpis, forecastWorkOrders, inboundQty, salesOrderRisk, stockPosition, type Snapshot } from "@/lib/domain/plant";

let s: Snapshot;
beforeAll(async () => {
  s = await seededSnapshot();
});

describe("stock positions", () => {
  it("flags 10ga sheet as critical (16 available, ~1.8 days cover)", () => {
    const item = s.items.find((i) => i.sku === "RM-SHT-10GA")!;
    const p = stockPosition(s, item);
    expect(p.available).toBe(16);
    expect(p.health).toBe("critical");
    expect(p.daysOfCover).toBeCloseTo(16 / 9, 2);
  });

  it("counts inbound only on open purchase orders", () => {
    const bolts = s.items.find((i) => i.sku === "CP-FST-M8")!; // only on a received PO
    const plate = s.items.find((i) => i.sku === "RM-PLT-250")!; // on a confirmed PO
    expect(inboundQty(s, bolts.id)).toBe(0);
    expect(inboundQty(s, plate.id)).toBe(20);
  });
});

describe("work order forecast", () => {
  it("queues a job behind higher-priority work at the same station", () => {
    const fc = forecastWorkOrders(s);
    const wo15 = fc.find((f) => f.wo.number === "WO-8815")!; // P2 at cut, behind P1 WO-8814
    expect(wo15.queueHoursAhead).toBeGreaterThanOrEqual(26);
  });

  it("excludes completed work orders", () => {
    expect(forecastWorkOrders(s).some((f) => f.wo.status === "done")).toBe(false);
  });

  it("marks orders without slack as late or tight", () => {
    const risks = salesOrderRisk(s);
    expect(risks.find((r) => r.so.number === "SO-24184")?.risk).toBe("late"); // blocked machine guards
    expect(risks.every((r) => r.so.status !== "shipped")).toBe(true);
  });
});

describe("kpis + assets", () => {
  it("computes sane headline numbers", () => {
    const k = computeKpis(s);
    expect(k.inventoryValue).toBeGreaterThan(50_000);
    expect(k.projectedOtd).toBeGreaterThan(0);
    expect(k.projectedOtd).toBeLessThan(1);
    expect(k.blocked).toBe(1);
    expect(k.overduePos).toBe(1);
  });

  it("explains asset risk with reasons", () => {
    const cnc = assetRisk(s.assets.find((a) => a.code === "CNC-03")!);
    expect(cnc.failureRisk).toBeGreaterThan(0.6);
    expect(cnc.reasons.join(" ")).toMatch(/vibration/);
    const cmm = assetRisk(s.assets.find((a) => a.code === "CMM-08")!);
    expect(cmm.failureRisk).toBeLessThan(0.1);
  });
});

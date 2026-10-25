"use client";

import { useMemo, useState } from "react";
import { cx, Meter, Sheet, Status, Td, Th, type Tone } from "@/components/ui";

export type InventoryRow = {
  id: number;
  sku: string;
  name: string;
  category: string;
  uom: string;
  location: string;
  onHand: number;
  available: number;
  inbound: number;
  reorderPoint: number;
  daysOfCover: number | null;
  health: "critical" | "low" | "ok" | "excess";
  value: number;
  supplier: string;
  legacyRef: string | null;
};

const HEALTH_TONE: Record<InventoryRow["health"], Tone> = { critical: "critical", low: "warning", ok: "good", excess: "blue" };
const FILTERS = ["all", "attention", "raw", "component", "consumable", "finished"] as const;
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const [sort, setSort] = useState<"cover" | "value" | "sku">("cover");
  const view = useMemo(() => {
    const t = q.toLowerCase();
    return rows
      .filter((r) => !t || `${r.sku} ${r.name} ${r.legacyRef ?? ""} ${r.supplier}`.toLowerCase().includes(t))
      .filter((r) => f === "all" || (f === "attention" ? r.health === "critical" || r.health === "low" : r.category === f))
      .sort((a, b) => (sort === "cover" ? (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9) : sort === "value" ? b.value - a.value : a.sku.localeCompare(b.sku)));
  }, [rows, q, f, sort]);
  const total = view.reduce((a, r) => a + r.value, 0);

  return (
    <Sheet
      fig="FIG. 03-A"
      title="Stock positions"
      aside={
        <span className="num text-[11px] text-ink-2">
          {view.length} SKUs · {money(total)}
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search SKU, description, legacy #, supplier"
          aria-label="Search inventory"
          className="h-8 w-full max-w-xs rounded-[3px] border border-line bg-paper px-2.5 font-mono text-[12px] outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {FILTERS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setF(x)}
              aria-pressed={f === x}
              className={cx(
                "h-7 rounded-[3px] px-2.5 font-mono text-[10.5px] tracking-wider uppercase",
                f === x ? "bg-ink text-paper" : "border border-line text-ink-2 hover:bg-panel-2",
              )}
            >
              {x}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-7 rounded-[3px] border border-line bg-paper px-1.5 text-ink"
          >
            <option value="cover">Days of cover</option>
            <option value="value">Value</option>
            <option value="sku">SKU</option>
          </select>
        </label>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Description</Th>
              <Th right>On hand</Th>
              <Th right>Available</Th>
              <Th right>Inbound</Th>
              <Th right>ROP</Th>
              <Th className="w-44">Days of cover</Th>
              <Th>Health</Th>
              <Th right>Value</Th>
              <Th>Supplier</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className="hover:bg-panel-2/60">
                <Td mono className="font-semibold">
                  {r.sku}
                  {r.legacyRef && <div className="text-[10px] font-normal text-ink-3">legacy {r.legacyRef}</div>}
                </Td>
                <Td>
                  <div className="max-w-64 truncate">{r.name}</div>
                  <div className="label !text-[9.5px]">
                    {r.category} · {r.location}
                  </div>
                </Td>
                <Td right mono>
                  {r.onHand} <span className="text-ink-3">{r.uom}</span>
                </Td>
                <Td right mono className={r.available <= 0 ? "text-critical" : undefined}>
                  {r.available}
                </Td>
                <Td right mono className="text-ink-2">
                  {r.inbound || "—"}
                </Td>
                <Td right mono className="text-ink-2">
                  {r.reorderPoint}
                </Td>
                <Td>
                  <div className="flex items-center gap-2" title={r.daysOfCover === null ? "No usage" : `${r.daysOfCover.toFixed(1)} days`}>
                    <Meter className="flex-1" value={(r.daysOfCover ?? 60) / 60} tone={HEALTH_TONE[r.health]} label={`${r.sku} days of cover`} />
                    <span className="num w-10 text-right text-[11.5px]">{r.daysOfCover === null ? "∞" : r.daysOfCover.toFixed(1)}</span>
                  </div>
                </Td>
                <Td>
                  <Status tone={HEALTH_TONE[r.health]}>{r.health}</Status>
                </Td>
                <Td right mono>
                  {money(r.value)}
                </Td>
                <Td mono className="text-ink-2">
                  {r.supplier}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}

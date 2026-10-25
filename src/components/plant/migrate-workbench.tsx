"use client";

import { useMemo, useState, useTransition } from "react";
import type { MapResponse } from "@/app/api/migrate/route";
import { importItemsAction } from "@/app/actions";
import { parseCsv, TARGET_FIELDS, TARGET_KEYS, transformRows, type Mapping, type TargetField } from "@/lib/domain/migrate";
import { Button, cx, Meter, Sheet, Status, Td, Th } from "@/components/ui";

const SAMPLES = [
  { file: "sap-mm60-export.csv", label: "SAP ECC · MM60", note: "German decimals, padded MATNR" },
  { file: "epicor-part-export.csv", label: "Epicor · Part", note: "quoted fields" },
];

type Step = 1 | 2 | 3;

export function MigrateWorkbench() {
  const [name, setName] = useState<string | null>(null);
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<MapResponse | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function load(text: string, filename: string) {
    setErr(null);
    setDone(null);
    const parsed = parseCsv(text);
    if (!parsed.headers.length || !parsed.rows.length) {
      setErr("That file has no header row or no data rows.");
      return;
    }
    setName(filename);
    setCsv(parsed);
    setBusy(true);
    try {
      const r = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: parsed.headers, sample: parsed.rows.slice(0, 12) }),
      });
      const j = (await r.json()) as MapResponse & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setMap(j);
      setMapping(Object.fromEntries(j.suggestions.filter((s) => s.column).map((s) => [s.field, s.column!])));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Mapping failed");
    } finally {
      setBusy(false);
    }
  }

  const result = useMemo(() => (csv ? transformRows(csv.headers, csv.rows, mapping) : null), [csv, mapping]);
  const missingRequired = TARGET_KEYS.filter((k) => TARGET_FIELDS[k].required && !mapping[k]);
  const step: Step = !csv ? 1 : done ? 3 : 2;

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-3 overflow-hidden rounded-[3px] border border-line font-mono text-[11px] tracking-wider uppercase">
        {["Load export", "Map & validate", "Import"].map((s, i) => (
          <li
            key={s}
            className={cx(
              "flex items-center gap-2 px-3 py-2",
              i > 0 && "border-l border-line",
              step === i + 1 ? "bg-accent-soft text-ink" : step > i + 1 ? "text-good" : "text-ink-3",
            )}
          >
            <span className="num">{step > i + 1 ? "✓" : `0${i + 1}`}</span> {s}
          </li>
        ))}
      </ol>

      <Sheet
        fig="FIG. 10-A"
        title="Source export"
        aside={
          name && (
            <span className="num text-[11px] text-ink-2">
              {name} · {csv?.rows.length} rows
            </span>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              type="button"
              onClick={async () => load(await (await fetch(`/samples/${s.file}`)).text(), s.file)}
              className="rounded-[3px] border border-line px-2.5 py-1.5 text-left hover:border-accent"
            >
              <div className="text-[12.5px] font-medium">{s.label}</div>
              <div className="label !text-[9.5px]">{s.note}</div>
            </button>
          ))}
          <label className="cursor-pointer rounded-[3px] border border-dashed border-line-strong px-3 py-2.5 text-[12.5px] text-ink-2 hover:border-accent">
            ⇪ Upload CSV / TSV export
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) load(await f.text(), f.name);
              }}
            />
          </label>
          {busy && <span className="caret font-mono text-[11.5px] text-ink-3">mapping columns</span>}
          {err && <span className="font-mono text-[11.5px] text-critical">■ {err}</span>}
        </div>
      </Sheet>

      {csv && map && result && (
        <div className="grid gap-4 2xl:grid-cols-[420px_1fr]">
          <Sheet
            fig="FIG. 10-B"
            title="Field mapping"
            aside={
              <span className={cx("label", map.engine === "claude" ? "!text-good" : "!text-warning")}>
                {map.engine === "claude" ? "● Claude-refined" : "▲ Heuristic"}
              </span>
            }
          >
            <ul className="space-y-2">
              {TARGET_KEYS.map((k: TargetField) => {
                const s = map.suggestions.find((x) => x.field === k);
                const auto = s?.column && mapping[k] === s.column;
                return (
                  <li key={k} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                    <div>
                      <div className="text-[12.5px] font-medium">
                        {TARGET_FIELDS[k].label}
                        {TARGET_FIELDS[k].required && <span className="text-critical"> *</span>}
                      </div>
                      {auto && s && (
                        <div className="flex items-center gap-1.5" title={s.reason}>
                          <Meter className="w-12" value={s.confidence} tone={s.confidence > 0.8 ? "good" : "warning"} label="Mapping confidence" />
                          <span className="truncate text-[10.5px] text-ink-3">{s.reason}</span>
                        </div>
                      )}
                    </div>
                    <select
                      value={mapping[k] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [k]: e.target.value || undefined }))}
                      aria-label={`Source column for ${TARGET_FIELDS[k].label}`}
                      className="h-8 rounded-[3px] border border-line bg-paper px-2 font-mono text-[12px]"
                    >
                      <option value="">— not mapped —</option>
                      {csv.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
            {map.notes.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[12px] text-ink-2">
                {map.notes.map((n) => (
                  <li key={n}>▸ {n}</li>
                ))}
              </ul>
            )}
          </Sheet>

          <Sheet
            fig="FIG. 10-C"
            title="Preview"
            aside={
              <span className="flex gap-3">
                <Status tone="good">{result.items.length} ready</Status>
                {result.errors.length > 0 && <Status tone="warning">{result.errors.length} rejected</Status>}
              </span>
            }
            bodyClassName="p-0"
          >
            <div className="scroll-thin max-h-[440px] overflow-auto">
              <table className="w-full min-w-[760px] text-[12.5px]">
                <thead className="sticky top-0 bg-panel">
                  <tr>
                    <Th>SKU</Th>
                    <Th>Description</Th>
                    <Th>Cat.</Th>
                    <Th right>On hand</Th>
                    <Th right>ROP</Th>
                    <Th right>Lot</Th>
                    <Th right>Cost</Th>
                    <Th>Vendor</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((r) => (
                    <tr key={r.sku}>
                      <Td mono className="font-semibold">
                        {r.sku}
                      </Td>
                      <Td>
                        <div className="max-w-60 truncate">{r.name}</div>
                      </Td>
                      <Td className="label">{r.category}</Td>
                      <Td right mono>
                        {r.onHand} {r.uom}
                      </Td>
                      <Td right mono>
                        {r.reorderPoint}
                      </Td>
                      <Td right mono>
                        {r.reorderQty}
                      </Td>
                      <Td right mono>
                        ${r.unitCost.toFixed(2)}
                      </Td>
                      <Td mono>{r.supplierCode ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.errors.length > 0 && (
              <ul className="space-y-0.5 border-t border-line px-4 py-3 font-mono text-[11.5px] text-warning">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    ▲ row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
              <Button
                variant="primary"
                disabled={pending || !!done || missingRequired.length > 0 || !result.items.length}
                onClick={() =>
                  start(async () => {
                    const r = await importItemsAction(result.items);
                    setDone(r?.message ?? "Imported");
                  })
                }
              >
                {done ? "✓ Imported" : `Import ${result.items.length} items`}
              </Button>
              {missingRequired.length > 0 && (
                <span className="font-mono text-[11.5px] text-critical">Map required: {missingRequired.map((k) => TARGET_FIELDS[k].label).join(", ")}</span>
              )}
              {done && <span className="font-mono text-[11.5px] text-good">{done} — see Sheet 03 and the ledger.</span>}
            </div>
          </Sheet>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { IngestResponse } from "@/app/api/ingest/route";
import { commitDocumentAction } from "@/app/actions";
import { Button, cx, Sheet, Status, Td, Th } from "@/components/ui";

const SAMPLES = [
  { file: "invoice-glss.txt", label: "Supplier invoice", note: "price change + freight" },
  { file: "po-ack-szmt.txt", label: "PO acknowledgement", note: "partial + late" },
  { file: "customer-po-email.txt", label: "Customer PO email", note: "free-form" },
];

const DOC_LABEL: Record<string, string> = {
  supplier_invoice: "Supplier invoice",
  po_acknowledgement: "PO acknowledgement",
  customer_po: "Customer purchase order",
  packing_slip: "Packing slip",
  quote: "Quote",
  other: "Other",
};

export function IngestWorkbench() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("pasted.txt");
  const [res, setRes] = useState<IngestResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function loadSample(f: string) {
    const t = await (await fetch(`/samples/${f}`)).text();
    setText(t);
    setFile(null);
    setName(f);
    setRes(null);
    setCommitted(null);
  }

  async function extract() {
    setBusy(true);
    setErr(null);
    setRes(null);
    setCommitted(null);
    const fd = new FormData();
    if (file) fd.set("file", file);
    else fd.set("text", text);
    try {
      const r = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRes(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const x = res?.extraction;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Sheet fig="FIG. 09-A" title="Inbox" aside={<span className="label">PDF · image · text · email</span>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              type="button"
              onClick={() => loadSample(s.file)}
              className="rounded-[3px] border border-line px-2.5 py-1.5 text-left hover:border-accent"
            >
              <div className="text-[12.5px] font-medium">{s.label}</div>
              <div className="label !text-[9.5px]">{s.note}</div>
            </button>
          ))}
        </div>
        <label
          className={cx(
            "mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-[3px] border border-dashed border-line-strong px-3 py-3",
            file && "border-accent bg-accent-soft",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) {
              setFile(f);
              setName(f.name);
            }
          }}
        >
          <span className="text-[12.5px] text-ink-2">
            {file ? `📎 ${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Drop a PDF, scan or .txt/.eml here — or click to choose"}
          </span>
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.eml,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) setName(f.name);
            }}
          />
          {file && (
            <button type="button" className="label hover:text-ink" onClick={(e) => (e.preventDefault(), setFile(null))}>
              clear
            </button>
          )}
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setName("pasted.txt");
          }}
          disabled={!!file}
          wrap="off"
          placeholder="…or paste an invoice, acknowledgement or customer email"
          aria-label="Document text"
          className="scroll-thin h-72 w-full resize-y rounded-[3px] border border-line bg-paper p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-accent disabled:opacity-40"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={extract} disabled={busy || (!file && !text.trim())}>
            {busy ? "Reading document…" : "▶ Extract"}
          </Button>
          {err && <span className="font-mono text-[11.5px] text-critical">■ {err}</span>}
        </div>
      </Sheet>

      <Sheet
        fig="FIG. 09-B"
        title="Extraction & three-way match"
        aside={
          res && (
            <span className={cx("label", res.engine === "claude" ? "!text-good" : "!text-warning")}>
              {res.engine === "claude" ? "● Claude · structured output" : "▲ Offline parser"}
            </span>
          )
        }
      >
        {!x ? (
          <div className="hatch grid h-full min-h-72 place-items-center rounded-[3px] border border-dashed border-line-strong p-6 text-center text-sm text-ink-2">
            {busy ? (
              <span className="caret font-mono">extracting</span>
            ) : (
              "Pick a sample or drop a document. Lathe reads it, matches every line to the item master and checks it against the PO."
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {res.note && <div className="font-mono text-[11px] text-warning">▲ {res.note}</div>}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-line bg-line sm:grid-cols-3">
              {[
                ["Type", DOC_LABEL[x.docType]],
                ["Counterparty", x.counterparty],
                ["Reference", x.reference],
                ["Our PO", res.po ? `${res.po.number} · ${res.po.status}` : (x.relatedPo ?? "—")],
                ["Date", x.date ?? "—"],
                ["Promised", x.promisedDate ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="bg-panel px-3 py-2">
                  <dt className="label">{k}</dt>
                  <dd className="num truncate text-[12.5px]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th>Matched item</Th>
                    <Th right>Qty</Th>
                    <Th right>Price</Th>
                    <Th>vs PO</Th>
                  </tr>
                </thead>
                <tbody>
                  {x.lines.map((l, i) => {
                    const c = res.lines[i];
                    const flags: string[] = [];
                    if (c?.qtyVariance) flags.push(`qty ${c.qtyVariance > 0 ? "+" : ""}${c.qtyVariance}`);
                    if (c?.priceVariancePct && Math.abs(c.priceVariancePct) > 0.5)
                      flags.push(`price ${c.priceVariancePct > 0 ? "+" : ""}${c.priceVariancePct.toFixed(1)}%`);
                    return (
                      <tr key={i}>
                        <Td>
                          <div className="max-w-52 truncate">{l.description}</div>
                          {l.sku && <div className="num text-[10.5px] text-ink-3">{l.sku}</div>}
                        </Td>
                        <Td>
                          {c?.match ? (
                            <>
                              <div className="num text-[12px] font-semibold">{c.match.sku}</div>
                              <div className="label !text-[9.5px]">
                                via {c.match.via} · {Math.round(c.match.score * 100)}%
                              </div>
                            </>
                          ) : (
                            <Status tone="warning">no match</Status>
                          )}
                        </Td>
                        <Td right mono>
                          {l.qty}
                        </Td>
                        <Td right mono>
                          {l.unitPrice != null ? `$${l.unitPrice.toFixed(2)}` : "—"}
                        </Td>
                        <Td>
                          {!res.po ? (
                            <span className="label">—</span>
                          ) : !c?.po ? (
                            <Status tone="serious">not on PO</Status>
                          ) : flags.length ? (
                            <Status tone="warning">{flags.join(" · ")}</Status>
                          ) : (
                            <Status tone="good">matches</Status>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {x.total != null && (
              <div className="num text-right text-[13px]">
                Document total <span className="font-semibold">${x.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> {x.currency}
              </div>
            )}
            <p className="text-[13px] text-ink-2">{x.summary}</p>
            {x.warnings.length > 0 && (
              <ul className="space-y-1 rounded-[3px] border border-warning/40 bg-warning-soft p-3 text-[12.5px]">
                {x.warnings.map((w) => (
                  <li key={w}>▲ {w}</li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3 border-t border-line pt-3">
              <Button
                variant="primary"
                disabled={pending || !!committed}
                onClick={() =>
                  start(async () => {
                    const r = await commitDocumentAction({ filename: name, engine: res.engine, extraction: x });
                    setCommitted(r?.message ?? "Done");
                  })
                }
              >
                {committed ? "✓ Committed" : x.docType === "customer_po" ? "Queue order for approval" : "Commit to ledger"}
              </Button>
              {committed && <span className="font-mono text-[11.5px] text-good">{committed}</span>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

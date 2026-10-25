import { z } from "zod";
import type { Item } from "@/lib/db/schema";

/**
 * Document ingestion: supplier invoices, PO acknowledgements, customer POs
 * and packing slips arrive as PDFs, scans and email bodies. One schema is shared
 * by the Claude extractor (structured outputs) and the offline regex parser.
 */

export const DOC_TYPES = ["supplier_invoice", "po_acknowledgement", "customer_po", "packing_slip", "quote", "other"] as const;

export const ExtractionSchema = z.object({
  docType: z.enum(DOC_TYPES).describe("What kind of business document this is"),
  counterparty: z.string().describe("The other company on the document (supplier or customer)"),
  reference: z.string().describe("The document's own number, e.g. invoice or PO number"),
  relatedPo: z.string().nullable().describe("Our purchase order number referenced on the document, like PO-1041, if any"),
  date: z.string().nullable().describe("Document date as YYYY-MM-DD"),
  promisedDate: z.string().nullable().describe("Ship, delivery or due date as YYYY-MM-DD, if stated"),
  currency: z.string().describe("ISO currency code, e.g. USD"),
  lines: z
    .array(
      z.object({
        description: z.string(),
        sku: z.string().nullable().describe("Part number exactly as printed, if present"),
        qty: z.number(),
        unitPrice: z.number().nullable(),
      }),
    )
    .describe("Every line item on the document"),
  total: z.number().nullable(),
  summary: z.string().describe("One sentence on what this document means for operations"),
  warnings: z.array(z.string()).describe("Anything a buyer or controller should double-check"),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

function isoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const us = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const d = new Date(raw);
  return Number.isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

const money = (s: string) => Number(s.replace(/[$,\s]/g, ""));

/**
 * Deterministic fallback used when no Claude key is configured. It handles
 * cleanly laid-out text documents (like the bundled samples); scans and messy
 * emails are what the Claude path is for.
 */
export function extractOffline(text: string): Extraction {
  const t = text.replace(/\r/g, "");
  const lower = t.toLowerCase();
  const docType: Extraction["docType"] = /invoice/.test(lower)
    ? "supplier_invoice"
    : /acknowledg|order confirmation/.test(lower)
      ? "po_acknowledgement"
      : /packing (slip|list)|ship(ment)? notice/.test(lower)
        ? "packing_slip"
        : /quot(e|ation)/.test(lower)
          ? "quote"
          : /purchase order|p\.?o\.? (no|number|#)/.test(lower)
            ? "customer_po"
            : "other";

  const field = (re: RegExp) => t.match(re)?.[1]?.trim();
  const counterparty =
    field(/^(?:from|vendor|supplier|bill from|customer|buyer)\s*[:\-]\s*(.+)$/im) ??
    t
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ??
    "Unknown";
  const reference = field(/(?:invoice|ack(?:nowledg\w*)?|quote|order|slip)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i) ?? "—";
  const relatedPo = field(/\b(PO-\d{3,6})\b/i)?.toUpperCase() ?? null;
  const date = isoDate(field(/^(?:date|invoice date|issued)\s*[:\-]\s*(.+)$/im));
  const promisedDate = isoDate(field(/(?:ship date|delivery date|due date|promised|required by|need by)\s*[:\-]\s*(.+)$/im));

  const lines: Extraction["lines"] = [];
  // e.g. "RM-SHT-10GA  Steel sheet 10ga 48x96   120   SH   $116.90   $14,028.00"
  const lineRe = /^\s*([A-Z]{2,}-[A-Z0-9\-]+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(?:[A-Z]{2,4}\s+)?\$?([\d,]+\.\d{2})(?:\s+\$?[\d,]+\.\d{2})?\s*$/gm;
  for (const m of t.matchAll(lineRe)) {
    lines.push({ sku: m[1], description: m[2].trim(), qty: Number(m[3]), unitPrice: money(m[4]) });
  }
  const totalRaw = field(/^\s*(?:total|amount due|grand total|invoice total)\s*[:\-]?\s*\$?([\d,]+\.\d{2})/im);
  const total = totalRaw ? money(totalRaw) : null;
  const computed = lines.reduce((a, l) => a + l.qty * (l.unitPrice ?? 0), 0);
  const warnings: string[] = [];
  if (total !== null && lines.length && Math.abs(total - computed) > 1) {
    warnings.push(`Line items sum to ${computed.toFixed(2)} but document total is ${total.toFixed(2)} (tax/freight?)`);
  }
  if (!lines.length) warnings.push("No line items recognised — try Claude extraction for free-form documents");
  return {
    docType,
    counterparty,
    reference,
    relatedPo,
    date,
    promisedDate,
    currency: /€|eur\b/i.test(t) ? "EUR" : "USD",
    lines,
    total,
    summary: `${docType.replace(/_/g, " ")} from ${counterparty} with ${lines.length} line${lines.length === 1 ? "" : "s"}.`,
    warnings,
  };
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[×x](?=\d)/g, " ")
      .split(/[^a-z0-9.]+/)
      .filter((w) => w.length > 1),
  );

export type ItemMatch = { item: Item; score: number; via: "sku" | "legacy" | "description" };

/** Match a document line to the item master: exact SKU, legacy ref, then token overlap. */
export function matchItem(line: { sku: string | null; description: string }, items: Item[]): ItemMatch | null {
  if (line.sku) {
    const sku = line.sku.trim().toUpperCase();
    const exact = items.find((i) => i.sku.toUpperCase() === sku);
    if (exact) return { item: exact, score: 1, via: "sku" };
    const legacy = items.find((i) => i.legacyRef && i.legacyRef === line.sku!.trim());
    if (legacy) return { item: legacy, score: 0.97, via: "legacy" };
  }
  const want = tokens(`${line.description} ${line.sku ?? ""}`);
  let best: ItemMatch | null = null;
  for (const item of items) {
    const have = tokens(`${item.name} ${item.sku}`);
    const inter = [...want].filter((w) => have.has(w)).length;
    const score = inter / Math.max(1, Math.min(want.size, have.size));
    if (!best || score > best.score) best = { item, score, via: "description" };
  }
  return best && best.score >= 0.5 ? { ...best, score: Number(best.score.toFixed(2)) } : null;
}

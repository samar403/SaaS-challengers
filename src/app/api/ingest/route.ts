import { getOptionalUser } from "@/lib/auth/session";
import { extractDocument, type ExtractInput } from "@/lib/ai/extract";
import { getSnapshot } from "@/lib/db/queries";
import { matchItem, type Extraction } from "@/lib/domain/documents";
import type { Snapshot } from "@/lib/domain/plant";

export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export type LineCheck = {
  index: number;
  match: { sku: string; name: string; score: number; via: string } | null;
  po: { qty: number; unitCost: number } | null;
  qtyVariance: number | null;
  priceVariancePct: number | null;
};

export type IngestResponse = {
  engine: "claude" | "offline";
  note?: string;
  extraction: Extraction;
  lines: LineCheck[];
  po: { number: string; supplier: string; status: string } | null;
};

/** Three-way match: document lines vs the referenced PO's lines. */
function check(x: Extraction, s: Snapshot): Pick<IngestResponse, "lines" | "po"> {
  const po = x.relatedPo ? s.purchaseOrders.find((p) => p.number.toUpperCase() === x.relatedPo!.toUpperCase()) : undefined;
  const poLines = po ? s.poLines.filter((l) => l.poId === po.id) : [];
  const lines = x.lines.map((l, index) => {
    const m = matchItem(l, s.items);
    const pl = m ? poLines.find((p) => p.itemId === m.item.id) : undefined;
    return {
      index,
      match: m ? { sku: m.item.sku, name: m.item.name, score: m.score, via: m.via } : null,
      po: pl ? { qty: pl.qty, unitCost: pl.unitCost } : null,
      qtyVariance: pl ? l.qty - pl.qty : null,
      priceVariancePct: pl && l.unitPrice != null ? ((l.unitPrice - pl.unitCost) / pl.unitCost) * 100 : null,
    };
  });
  return {
    lines,
    po: po ? { number: po.number, supplier: s.suppliers.find((v) => v.id === po.supplierId)?.name ?? "", status: po.status } : null,
  };
}

export async function POST(req: Request) {
  const user = await getOptionalUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Expected multipart form data" }, { status: 400 });

  let input: ExtractInput;
  const file = form.get("file");
  const text = form.get("text");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 8 MB" }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (file.type === "application/pdf") input = { kind: "pdf", base64: buf.toString("base64") };
    else if ((IMAGE_TYPES as readonly string[]).includes(file.type))
      input = { kind: "image", base64: buf.toString("base64"), mediaType: file.type as (typeof IMAGE_TYPES)[number] };
    else input = { kind: "text", text: buf.toString("utf8").slice(0, 200_000) };
  } else if (typeof text === "string" && text.trim()) {
    input = { kind: "text", text: text.slice(0, 200_000) };
  } else {
    return Response.json({ error: "Paste a document or attach a file" }, { status: 400 });
  }

  try {
    const result = await extractDocument(input);
    const s = await getSnapshot();
    return Response.json({ ...result, ...check(result.extraction, s) } satisfies IngestResponse);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Extraction failed" }, { status: 422 });
  }
}

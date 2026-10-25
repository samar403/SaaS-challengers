/**
 * Legacy ERP migration: map arbitrary CSV exports (SAP MM60/MARA+MARD, Epicor
 * Part, Oracle EBS MTL_SYSTEM_ITEMS, Dynamics, homegrown Access databases) onto
 * Lathe's item master. The heuristic mapper runs everywhere; Claude refines it
 * when a key is configured.
 */

export const TARGET_FIELDS = {
  sku: { label: "SKU / part number", required: true, type: "string" },
  name: { label: "Description", required: true, type: "string" },
  category: { label: "Category", required: false, type: "category" },
  uom: { label: "Unit of measure", required: false, type: "string" },
  onHand: { label: "On hand", required: false, type: "number" },
  reorderPoint: { label: "Reorder point", required: false, type: "number" },
  reorderQty: { label: "Reorder qty / lot", required: false, type: "number" },
  unitCost: { label: "Unit cost", required: false, type: "number" },
  location: { label: "Bin / location", required: false, type: "string" },
  dailyUsage: { label: "Avg daily usage", required: false, type: "number" },
  supplierCode: { label: "Vendor code", required: false, type: "string" },
} as const;

export type TargetField = keyof typeof TARGET_FIELDS;
export const TARGET_KEYS = Object.keys(TARGET_FIELDS) as TargetField[];

/** Known legacy column names, normalised (lowercase, alphanumerics only). */
const SYNONYMS: Record<TargetField, string[]> = {
  sku: [
    "matnr",
    "material",
    "materialnumber",
    "partnum",
    "partnumber",
    "part",
    "itemnumber",
    "item",
    "itemno",
    "segment1",
    "sku",
    "itemid",
    "productcode",
    "partno",
    "articlenumber",
  ],
  name: [
    "maktx",
    "materialdescription",
    "description",
    "partdescription",
    "desc",
    "itemdescription",
    "name",
    "shortdescription",
    "longdescription",
    "productname",
    "descr",
  ],
  category: ["mtart", "materialtype", "classid", "class", "category", "itemtype", "producttype", "typecode", "parttype", "itemclass"],
  uom: ["meins", "baseunit", "uom", "ium", "unitofmeasure", "primaryuomcode", "unit", "stockingunit", "um"],
  onHand: [
    "labst",
    "unrestricted",
    "unrestrictedstock",
    "onhandqty",
    "onhand",
    "qtyonhand",
    "quantity",
    "qty",
    "stock",
    "onhandquantity",
    "available",
    "inventory",
  ],
  reorderPoint: ["minbe", "reorderpoint", "rop", "minonhand", "minqty", "minimum", "minminmaxquantity", "safetystock", "eisbe", "reorderlevel"],
  reorderQty: ["bstrf", "bstmi", "lotsize", "reorderqty", "minorderqty", "orderqty", "fixedlotmultiplier", "eoq", "minimumorderquantity", "lot"],
  unitCost: ["stprs", "verpr", "standardprice", "unitcost", "cost", "avgcost", "standardcost", "itemcost", "price", "lastcost"],
  location: ["lgpbe", "lgort", "storagebin", "bin", "location", "warehouse", "binnum", "subinventory", "whse"],
  dailyUsage: ["avgdailyusage", "dailyusage", "usageperday", "avgusage", "consumption", "dailydemand"],
  supplierCode: ["lifnr", "vendor", "vendorid", "vendornum", "supplier", "suppliercode", "vendorcode", "primaryvendor", "supplierid"],
};

export function normalise(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type Mapping = Partial<Record<TargetField, string>>;
export type MappingSuggestion = { field: TargetField; column: string | null; confidence: number; reason: string };

/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF, and ; or tab delimiters. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t", "|"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  const [headers = [], ...body] = rows;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

function looksNumeric(values: string[]): number {
  const v = values.filter((x) => x.trim() !== "");
  if (!v.length) return 0;
  return v.filter((x) => !Number.isNaN(parseNumber(x))).length / v.length;
}

/** Handles "1.234,50", "1,234.50", "$12", "12-" (SAP trailing minus). */
export function parseNumber(raw: string): number {
  let s = raw.trim().replace(/[$€£\s]/g, "");
  let neg = false;
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (s === "" || !/^-?\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}

export function suggestMapping(headers: string[], sample: string[][]): MappingSuggestion[] {
  const used = new Set<string>();
  const col = (h: string) => sample.map((r) => r[headers.indexOf(h)] ?? "");
  return TARGET_KEYS.map((field) => {
    let best: { column: string; score: number; reason: string } | null = null;
    for (const h of headers) {
      if (used.has(h)) continue;
      const n = normalise(h);
      const syn = SYNONYMS[field];
      let score = 0;
      let reason = "";
      if (syn.includes(n)) {
        score = 0.95;
        reason = `"${h}" is a known legacy field name`;
      } else {
        const partial = syn.find((x) => x.length > 3 && (n.includes(x) || x.includes(n)));
        if (partial && n.length > 2) {
          score = 0.7;
          reason = `"${h}" resembles "${partial}"`;
        }
      }
      if (score > 0 && TARGET_FIELDS[field].type === "number") {
        const numeric = looksNumeric(col(h));
        score *= 0.5 + numeric / 2;
        if (numeric < 0.6) reason += " but values are not numeric";
      }
      if (!best || score > best.score) best = { column: h, score, reason };
    }
    if (best && best.score >= 0.4) {
      used.add(best.column);
      return { field, column: best.column, confidence: Number(best.score.toFixed(2)), reason: best.reason };
    }
    return { field, column: null, confidence: 0, reason: "No matching column" };
  });
}

export type ImportedItem = {
  sku: string;
  name: string;
  category: "raw" | "component" | "finished" | "consumable";
  uom: string;
  onHand: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  location: string;
  dailyUsage: number;
  supplierCode: string | null;
};

const CATEGORY_HINTS: [RegExp, ImportedItem["category"]][] = [
  [/^(roh|raw|rm|mat|stock)/i, "raw"],
  [/^(fert|fg|fin|prod|sell)/i, "finished"],
  [/^(halb|comp|cp|sub|purch|part)/i, "component"],
  [/^(hibe|cons|cn|supp|mro|ops)/i, "consumable"],
];

export function coerceCategory(raw: string | undefined, sku: string): ImportedItem["category"] {
  for (const [re, cat] of CATEGORY_HINTS) if (raw && re.test(raw.trim())) return cat;
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(sku)) return cat;
  return "component";
}

export type TransformResult = { items: ImportedItem[]; errors: { row: number; message: string }[] };

export function transformRows(headers: string[], rows: string[][], mapping: Mapping): TransformResult {
  const idx = (f: TargetField) => (mapping[f] ? headers.indexOf(mapping[f]!) : -1);
  const get = (r: string[], f: TargetField) => {
    const i = idx(f);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const num = (r: string[], f: TargetField) => {
    const v = get(r, f);
    if (!v) return 0;
    const n = parseNumber(v);
    return Number.isNaN(n) ? 0 : n;
  };
  const items: ImportedItem[] = [];
  const errors: TransformResult["errors"] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const sku = get(r, "sku").replace(/^0+(?=\d{4,})/, ""); // SAP pads MATNR with zeros
    const name = get(r, "name");
    if (!sku) return errors.push({ row: i + 2, message: "Missing SKU" });
    if (!name) return errors.push({ row: i + 2, message: `Missing description for ${sku}` });
    if (seen.has(sku)) return errors.push({ row: i + 2, message: `Duplicate SKU ${sku}` });
    seen.add(sku);
    items.push({
      sku,
      name,
      category: coerceCategory(get(r, "category"), sku),
      uom: (get(r, "uom") || "EA").toUpperCase().slice(0, 4),
      onHand: Math.max(0, num(r, "onHand")),
      reorderPoint: Math.max(0, num(r, "reorderPoint")),
      reorderQty: Math.max(0, num(r, "reorderQty")),
      unitCost: Math.max(0, num(r, "unitCost")),
      location: get(r, "location") || "WH-A",
      dailyUsage: Math.max(0, num(r, "dailyUsage")),
      supplierCode: get(r, "supplierCode") || null,
    });
  });
  return { items, errors };
}

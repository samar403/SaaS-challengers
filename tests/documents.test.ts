import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ExtractionSchema, extractOffline, matchItem } from "@/lib/domain/documents";
import { seededSnapshot } from "./fixture";
import type { Item } from "@/lib/db/schema";

const invoice = fs.readFileSync(path.join(__dirname, "..", "public", "samples", "invoice-glss.txt"), "utf8");
let items: Item[];
beforeAll(async () => {
  items = (await seededSnapshot()).items;
});

describe("offline extraction", () => {
  it("reads the sample supplier invoice", () => {
    const x = extractOffline(invoice);
    expect(ExtractionSchema.parse(x)).toBeTruthy();
    expect(x.docType).toBe("supplier_invoice");
    expect(x.relatedPo).toBe("PO-1041");
    expect(x.lines.length).toBe(2);
    expect(x.lines[0]).toMatchObject({ sku: "RM-PLT-250", qty: 20 });
    expect(x.warnings.join(" ")).toMatch(/sum/);
  });
});

describe("item matching", () => {
  it("prefers exact SKU, then legacy ref, then description", () => {
    expect(matchItem({ sku: "rm-plt-250", description: "" }, items)?.via).toBe("sku");
    expect(matchItem({ sku: "100-2231", description: "" }, items)?.item.sku).toBe("RM-SHT-10GA");
    expect(matchItem({ sku: null, description: "6204-2RS ball bearing" }, items)?.item.sku).toBe("CP-BRG-6204");
    expect(matchItem({ sku: null, description: "unicorn glitter" }, items)).toBeNull();
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, parseNumber, suggestMapping, transformRows, type Mapping } from "@/lib/domain/migrate";

const sap = fs.readFileSync(path.join(__dirname, "..", "public", "samples", "sap-mm60-export.csv"), "utf8");
const epicor = fs.readFileSync(path.join(__dirname, "..", "public", "samples", "epicor-part-export.csv"), "utf8");

describe("csv + numbers", () => {
  it("parses quoted cells with delimiters and escaped quotes", () => {
    const { headers, rows } = parseCsv('a,b\n"x, y","he said ""hi"""\n1,2\r\n');
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([
      ["x, y", 'he said "hi"'],
      ["1", "2"],
    ]);
  });

  it("detects semicolon delimiters", () => {
    expect(parseCsv("a;b\n1;2").rows).toEqual([["1", "2"]]);
  });

  it("handles European decimals, thousands and SAP trailing minus", () => {
    expect(parseNumber("1.234,50")).toBe(1234.5);
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber("$12")).toBe(12);
    expect(parseNumber("15-")).toBe(-15);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(Number.isNaN(parseNumber("n/a"))).toBe(true);
  });
});

describe("mapping legacy exports", () => {
  it("maps SAP MM field names", () => {
    const { headers, rows } = parseCsv(sap);
    const m = Object.fromEntries(suggestMapping(headers, rows).map((x) => [x.field, x.column]));
    expect(m).toMatchObject({ sku: "MATNR", name: "MAKTX", uom: "MEINS", onHand: "LABST", reorderPoint: "MINBE", unitCost: "STPRS", supplierCode: "LIFNR" });
  });

  it("maps Epicor-style headers", () => {
    const { headers, rows } = parseCsv(epicor);
    const m = Object.fromEntries(suggestMapping(headers, rows).map((x) => [x.field, x.column]));
    expect(m.sku).toBe("PartNum");
    expect(m.name).toBe("PartDescription");
    expect(m.onHand).toBe("OnHandQty");
  });

  it("transforms rows, strips SAP zero padding and reports bad rows", () => {
    const { headers, rows } = parseCsv(sap);
    const mapping = Object.fromEntries(suggestMapping(headers, rows).map((x) => [x.field, x.column ?? undefined])) as Mapping;
    const { items, errors } = transformRows(headers, rows, mapping);
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((i) => !/^0{3,}/.test(i.sku))).toBe(true);
    expect(items.find((i) => i.sku.includes("4711"))?.unitCost).toBeCloseTo(1234.5);
    expect(errors.some((e) => /Duplicate|Missing/.test(e.message))).toBe(true);
  });
});

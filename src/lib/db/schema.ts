import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Lathe data model — a deliberately small, legible ERP core:
 * items ⇄ suppliers ⇄ purchase orders, customers ⇄ sales orders ⇄ work orders,
 * plant assets, agent proposals and an append-only event ledger.
 */

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  email: text("email").notNull(),
  leadTimeDays: integer("lead_time_days").notNull(),
  onTimeRate: real("on_time_rate").notNull(), // 0..1
  qualityRate: real("quality_rate").notNull(), // 0..1
});

export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    category: text("category", { enum: ["raw", "component", "finished", "consumable"] }).notNull(),
    uom: text("uom").notNull().default("EA"),
    onHand: real("on_hand").notNull().default(0),
    allocated: real("allocated").notNull().default(0),
    reorderPoint: real("reorder_point").notNull().default(0),
    reorderQty: real("reorder_qty").notNull().default(0),
    dailyUsage: real("daily_usage").notNull().default(0),
    unitCost: real("unit_cost").notNull().default(0),
    location: text("location").notNull().default("WH-A"),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    legacyRef: text("legacy_ref"),
  },
  (t) => [index("items_supplier_idx").on(t.supplierId)],
);

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull().unique(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  status: text("status", { enum: ["draft", "sent", "confirmed", "received", "cancelled"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expectedAt: integer("expected_at", { mode: "timestamp_ms" }).notNull(),
  createdBy: text("created_by").notNull(),
  notes: text("notes"),
});

export const poLines = sqliteTable("po_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poId: integer("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  qty: real("qty").notNull(),
  unitCost: real("unit_cost").notNull(),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  region: text("region").notNull(),
});

export const salesOrders = sqliteTable("sales_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  status: text("status", { enum: ["open", "in_production", "shipped", "cancelled"] }).notNull(),
  priority: integer("priority").notNull().default(2), // 1 = hot, 3 = low
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
});

export const soLines = sqliteTable("so_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  soId: integer("so_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  qty: real("qty").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const STATIONS = ["cut", "machine", "weld", "finish", "qa", "done"] as const;
export type Station = (typeof STATIONS)[number];

export const workOrders = sqliteTable("work_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull().unique(),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  salesOrderId: integer("sales_order_id").references(() => salesOrders.id),
  qty: real("qty").notNull(),
  station: text("station", { enum: STATIONS }).notNull(),
  status: text("status", { enum: ["queued", "running", "blocked", "done"] }).notNull(),
  priority: integer("priority").notNull().default(2),
  hoursRemaining: real("hours_remaining").notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
  blockedReason: text("blocked_reason"),
});

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  station: text("station", { enum: STATIONS }).notNull(),
  status: text("status", { enum: ["running", "idle", "down", "maintenance"] }).notNull(),
  health: real("health").notNull(), // 0..100
  runHours: real("run_hours").notNull(),
  mtbfHours: real("mtbf_hours").notNull(),
  hoursSinceService: real("hours_since_service").notNull(),
  vibration: real("vibration").notNull(), // mm/s RMS
  temperature: real("temperature").notNull(), // °C
  oee: real("oee").notNull(), // 0..1
});

export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agent: text("agent", { enum: ["reorder", "expedite", "maintenance", "supplier", "copilot"] }).notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  impact: text("impact").notNull(),
  confidence: real("confidence").notNull(),
  payload: text("payload", { mode: "json" }).$type<ProposalPayload>().notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  decidedBy: text("decided_by"),
});

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    actor: text("actor").notNull(), // "user:dana" | "agent:reorder" | "system"
    kind: text("kind").notNull(), // po.created, wo.advanced, proposal.approved …
    entity: text("entity").notNull(), // "PO-1042"
    summary: text("summary").notNull(),
  },
  (t) => [index("events_at_idx").on(t.at)],
);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  docType: text("doc_type").notNull(),
  engine: text("engine").notNull(), // "claude" | "offline"
  extracted: text("extracted", { mode: "json" }).notNull(),
  status: text("status", { enum: ["review", "committed", "discarded"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProposalPayload =
  | { kind: "create_po"; supplierId: number; lines: { itemId: number; qty: number; unitCost: number }[] }
  | { kind: "expedite_wo"; workOrderId: number; newPriority: number }
  | { kind: "schedule_maintenance"; assetId: number; hours: number }
  | { kind: "resource_supplier"; fromSupplierId: number; toSupplierId: number; itemIds: number[] }
  | {
      kind: "book_sales_order";
      customer: string;
      reference: string;
      dueAt: string | null;
      lines: { itemId: number; qty: number; unitPrice: number }[];
    };

export type Item = typeof items.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type LedgerEvent = typeof events.$inferSelect;

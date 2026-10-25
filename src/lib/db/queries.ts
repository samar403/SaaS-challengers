import "server-only";
import { connection } from "next/server";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb, type DB } from "./client";
import * as t from "./schema";
import type { Snapshot } from "@/lib/domain/plant";
import { STATIONS, type ProposalPayload, type Station } from "./schema";
import type { ProposalDraft } from "@/lib/domain/agents";
import type { ImportedItem } from "@/lib/domain/migrate";

/** Every read below is request-time data: opt the caller out of prerendering. */
async function readDb() {
  await connection();
  return getDb();
}

export async function getSnapshot(): Promise<Snapshot> {
  const db = await readDb();
  const [items, suppliers, purchaseOrders, poLines, customers, salesOrders, soLines, workOrders, assets] = await Promise.all([
    db.select().from(t.items).orderBy(t.items.sku),
    db.select().from(t.suppliers).orderBy(t.suppliers.name),
    db.select().from(t.purchaseOrders).orderBy(desc(t.purchaseOrders.createdAt)),
    db.select().from(t.poLines),
    db.select().from(t.customers),
    db.select().from(t.salesOrders).orderBy(t.salesOrders.dueAt),
    db.select().from(t.soLines),
    db.select().from(t.workOrders).orderBy(t.workOrders.priority, t.workOrders.dueAt),
    db.select().from(t.assets).orderBy(t.assets.code),
  ]);
  return { now: Date.now(), items, suppliers, purchaseOrders, poLines, customers, salesOrders, soLines, workOrders, assets };
}

export async function logEvent(actor: string, kind: string, entity: string, summary: string, db?: DB) {
  const d = db ?? (await getDb());
  await d.insert(t.events).values({ at: new Date(), actor, kind, entity, summary });
}

export async function listEvents(limit = 50) {
  const db = await readDb();
  return db.select().from(t.events).orderBy(desc(t.events.at), desc(t.events.id)).limit(limit);
}

export async function listProposals(status?: t.Proposal["status"]) {
  const db = await readDb();
  const q = db.select().from(t.proposals);
  return (status ? q.where(eq(t.proposals.status, status)) : q).orderBy(desc(t.proposals.createdAt), desc(t.proposals.id));
}

/** Insert agent drafts, skipping any that duplicate a still-pending proposal. */
export async function upsertProposals(drafts: ProposalDraft[]): Promise<number> {
  if (!drafts.length) return 0;
  const db = await getDb();
  const pending = await db
    .select({ key: t.proposals.dedupeKey })
    .from(t.proposals)
    .where(
      and(
        eq(t.proposals.status, "pending"),
        inArray(
          t.proposals.dedupeKey,
          drafts.map((d) => d.dedupeKey),
        ),
      ),
    );
  const seen = new Set(pending.map((p) => p.key));
  const fresh = drafts.filter((d) => !seen.has(d.dedupeKey));
  if (fresh.length) {
    await db.insert(t.proposals).values(fresh.map((d) => ({ ...d, status: "pending" as const, createdAt: new Date() })));
  }
  return fresh.length;
}

async function nextNumber(db: DB, table: typeof t.purchaseOrders, prefix: string, base: number) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(table);
  return `${prefix}-${base + Number(row.n) + 1}`;
}

export async function createPurchaseOrder(supplierId: number, lines: { itemId: number; qty: number; unitCost: number }[], actor: string, notes?: string) {
  const db = await getDb();
  const supplier = (await db.select().from(t.suppliers).where(eq(t.suppliers.id, supplierId)))[0];
  if (!supplier) throw new Error(`Unknown supplier ${supplierId}`);
  const number = await nextNumber(db, t.purchaseOrders, "PO", 1040);
  const [po] = await db
    .insert(t.purchaseOrders)
    .values({
      number,
      supplierId,
      status: "sent",
      createdAt: new Date(),
      expectedAt: new Date(Date.now() + supplier.leadTimeDays * 86_400_000),
      createdBy: actor,
      notes: notes ?? null,
    })
    .returning();
  await db.insert(t.poLines).values(lines.map((l) => ({ ...l, poId: po.id })));
  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
  await logEvent(actor, "po.created", number, `PO to ${supplier.name} · ${lines.length} line(s) · $${total.toFixed(0)}`, db);
  return po;
}

async function execute(payload: ProposalPayload, actor: string) {
  const db = await getDb();
  switch (payload.kind) {
    case "create_po":
      return (await createPurchaseOrder(payload.supplierId, payload.lines, actor, "Drafted by Lathe Autopilot")).number;
    case "expedite_wo": {
      const [wo] = await db.update(t.workOrders).set({ priority: payload.newPriority }).where(eq(t.workOrders.id, payload.workOrderId)).returning();
      await logEvent(actor, "wo.expedited", wo.number, `Priority raised to P${payload.newPriority}`, db);
      return wo.number;
    }
    case "schedule_maintenance": {
      const [a] = await db.update(t.assets).set({ status: "maintenance" }).where(eq(t.assets.id, payload.assetId)).returning();
      await logEvent(actor, "asset.maintenance", a.code, `${payload.hours}h preventive maintenance window opened`, db);
      return a.code;
    }
    case "resource_supplier": {
      if (payload.itemIds.length) {
        await db.update(t.items).set({ supplierId: payload.toSupplierId }).where(inArray(t.items.id, payload.itemIds));
      }
      const [to] = await db.select().from(t.suppliers).where(eq(t.suppliers.id, payload.toSupplierId));
      await logEvent(actor, "supplier.resourced", to.code, `${payload.itemIds.length} SKUs re-sourced to ${to.name}`, db);
      return to.code;
    }
    case "book_sales_order": {
      let [cust] = await db
        .select()
        .from(t.customers)
        .where(like(t.customers.name, `%${payload.customer.split(" ")[0]}%`));
      if (!cust) [cust] = await db.insert(t.customers).values({ name: payload.customer, region: "—" }).returning();
      const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(t.salesOrders);
      const number = `SO-${24180 + Number(n) + 1}`;
      const due = payload.dueAt ? new Date(payload.dueAt) : new Date(Date.now() + 21 * 86_400_000);
      const [so] = await db
        .insert(t.salesOrders)
        .values({ number, customerId: cust.id, status: "open", priority: 2, createdAt: new Date(), dueAt: due })
        .returning();
      if (payload.lines.length) await db.insert(t.soLines).values(payload.lines.map((l) => ({ ...l, soId: so.id })));
      await logEvent(actor, "so.booked", number, `Booked ${cust.name} PO ${payload.reference} · ${payload.lines.length} line(s)`, db);
      return number;
    }
  }
}

export async function decideProposal(id: number, decision: "approved" | "rejected", actor: string) {
  const db = await getDb();
  const [p] = await db.select().from(t.proposals).where(eq(t.proposals.id, id));
  if (!p) throw new Error("Proposal not found");
  if (p.status !== "pending") return { ok: false as const, message: `Already ${p.status}` };
  // Claim the proposal first so double-clicks can't execute it twice.
  const claimed = await db
    .update(t.proposals)
    .set({ status: decision, decidedAt: new Date(), decidedBy: actor })
    .where(and(eq(t.proposals.id, id), eq(t.proposals.status, "pending")))
    .returning();
  if (!claimed.length) return { ok: false as const, message: "Already decided" };
  if (decision === "rejected") {
    await logEvent(actor, "proposal.rejected", `AP-${id}`, p.title, db);
    return { ok: true as const, message: "Rejected" };
  }
  const ref = await execute(p.payload, actor);
  await logEvent(actor, "proposal.approved", `AP-${id}`, `${p.title} → ${ref}`, db);
  return { ok: true as const, message: `Executed → ${ref}` };
}

export async function advanceWorkOrder(id: number, actor: string) {
  const db = await getDb();
  const [wo] = await db.select().from(t.workOrders).where(eq(t.workOrders.id, id));
  if (!wo || wo.station === "done") return null;
  const next = STATIONS[STATIONS.indexOf(wo.station) + 1] as Station;
  const done = next === "done";
  // Rough remaining-hours burn-down: each station is ~1/5th of the routing.
  const hours = done ? 0 : Math.max(0, wo.hoursRemaining * 0.72);
  const [updated] = await db
    .update(t.workOrders)
    .set({ station: next, status: done ? "done" : "queued", hoursRemaining: hours, blockedReason: null })
    .where(eq(t.workOrders.id, id))
    .returning();
  await logEvent(actor, done ? "wo.completed" : "wo.advanced", wo.number, done ? "Completed and staged to ship" : `Moved to ${next}`, db);
  return updated;
}

export async function receivePurchaseOrder(id: number, actor: string) {
  const db = await getDb();
  const [po] = await db.select().from(t.purchaseOrders).where(eq(t.purchaseOrders.id, id));
  if (!po || po.status === "received" || po.status === "cancelled") return null;
  const lines = await db.select().from(t.poLines).where(eq(t.poLines.poId, id));
  for (const l of lines) {
    await db
      .update(t.items)
      .set({ onHand: sql`${t.items.onHand} + ${l.qty}` })
      .where(eq(t.items.id, l.itemId));
  }
  await db.update(t.purchaseOrders).set({ status: "received" }).where(eq(t.purchaseOrders.id, id));
  await logEvent(actor, "po.received", po.number, `Received ${lines.length} line(s) into stock`, db);
  return po;
}

export async function searchItems(query: string) {
  const db = await readDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(t.items)
    .where(or(like(t.items.sku, q), like(t.items.name, q), like(t.items.legacyRef, q)))
    .limit(25);
}

export async function importItems(rows: ImportedItem[], actor: string) {
  const db = await getDb();
  const sups = await db.select().from(t.suppliers);
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const code = r.supplierCode?.toUpperCase();
    const supplierId = code ? (sups.find((s) => s.code === code)?.id ?? null) : null;
    const values = {
      sku: r.sku,
      name: r.name,
      category: r.category,
      uom: r.uom,
      onHand: r.onHand,
      reorderPoint: r.reorderPoint,
      reorderQty: r.reorderQty,
      unitCost: r.unitCost,
      location: r.location,
      dailyUsage: r.dailyUsage,
      supplierId,
      legacyRef: r.sku,
    };
    const existing = await db.select({ id: t.items.id }).from(t.items).where(eq(t.items.sku, r.sku));
    if (existing.length) {
      const { sku: _sku, ...rest } = values;
      void _sku;
      await db.update(t.items).set(rest).where(eq(t.items.id, existing[0].id));
      updated++;
    } else {
      await db.insert(t.items).values(values);
      created++;
    }
  }
  await logEvent(actor, "migration.completed", "LEGACY", `Imported ${created} new and updated ${updated} item masters`, db);
  return { created, updated };
}

export async function saveDocument(doc: Omit<typeof t.documents.$inferInsert, "createdAt">) {
  const db = await getDb();
  const [row] = await db
    .insert(t.documents)
    .values({ ...doc, createdAt: new Date() })
    .returning();
  return row;
}

export async function listDocuments(limit = 8) {
  const db = await readDb();
  return db.select().from(t.documents).orderBy(desc(t.documents.createdAt)).limit(limit);
}

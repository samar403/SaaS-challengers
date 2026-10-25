"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findUser, canApprove } from "@/lib/auth/users";
import { SESSION_COOKIE, sessionSecret, signSession } from "@/lib/auth/token";
import { getCurrentUser } from "@/lib/auth/session";
import {
  advanceWorkOrder,
  createPurchaseOrder,
  decideProposal,
  getSnapshot,
  importItems,
  logEvent,
  receivePurchaseOrder,
  saveDocument,
  upsertProposals,
} from "@/lib/db/queries";
import { runAllAgents } from "@/lib/domain/agents";
import type { Extraction } from "@/lib/domain/documents";
import { matchItem } from "@/lib/domain/documents";
import type { ImportedItem } from "@/lib/domain/migrate";

export type ActionResult = { ok: boolean; message: string } | null;

export async function signIn(formData: FormData) {
  const user = findUser(String(formData.get("user") ?? ""));
  if (!user) redirect("/login?error=unknown");
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.LATHE_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  await logEvent(`user:${user.id}`, "session.started", user.id.toUpperCase(), `${user.name} signed in as ${user.title}`);
  redirect("/app");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function runAgentsAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const drafts = runAllAgents(await getSnapshot());
  const created = await upsertProposals(drafts);
  await logEvent(`user:${user.id}`, "autopilot.run", "AGENTS", `Agents scanned the plant: ${drafts.length} findings, ${created} new proposals`);
  revalidatePath("/app", "layout");
  return { ok: true, message: created ? `${created} new proposal${created > 1 ? "s" : ""} queued` : "No new findings — queue is current" };
}

export async function decideAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const id = Number(formData.get("id"));
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  const agent = String(formData.get("agent")) as Parameters<typeof canApprove>[1];
  if (decision === "approved" && !canApprove(user.role, agent)) {
    return { ok: false, message: `${user.title}s can't approve ${agent} proposals — segregation of duties` };
  }
  try {
    const res = await decideProposal(id, decision, `user:${user.id}`);
    revalidatePath("/app", "layout");
    return res;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed" };
  }
}

export async function advanceWorkOrderAction(formData: FormData) {
  const user = await getCurrentUser();
  await advanceWorkOrder(Number(formData.get("id")), `user:${user.id}`);
  revalidatePath("/app", "layout");
}

export async function receivePoAction(formData: FormData) {
  const user = await getCurrentUser();
  await receivePurchaseOrder(Number(formData.get("id")), `user:${user.id}`);
  revalidatePath("/app", "layout");
}

/** Commit a reviewed document: link to PO, or turn a customer PO into a draft proposal. */
export async function commitDocumentAction(payload: { filename: string; engine: "claude" | "offline"; extraction: Extraction }): Promise<ActionResult> {
  const user = await getCurrentUser();
  const { extraction: x } = payload;
  const s = await getSnapshot();
  await saveDocument({ filename: payload.filename, docType: x.docType, engine: payload.engine, extracted: x, status: "committed" });
  const actor = `user:${user.id}`;

  if (x.docType === "supplier_invoice" || x.docType === "po_acknowledgement" || x.docType === "packing_slip") {
    const po = s.purchaseOrders.find((p) => p.number === x.relatedPo);
    const summary = `${x.docType.replace(/_/g, " ")} ${x.reference} from ${x.counterparty}${po ? ` matched to ${po.number}` : " — no PO match"}`;
    await logEvent(actor, `document.${x.docType}`, po?.number ?? x.reference, summary);
    revalidatePath("/app", "layout");
    return { ok: true, message: po ? `Filed against ${po.number}` : "Filed — no matching PO, flagged for buyer" };
  }

  if (x.docType === "quote") {
    const sup = s.suppliers.find((v) => x.counterparty.toLowerCase().includes(v.name.toLowerCase().split(" ")[0]));
    const lines = x.lines
      .map((l) => ({ m: matchItem(l, s.items), l }))
      .filter((r) => r.m)
      .map((r) => ({ itemId: r.m!.item.id, qty: r.l.qty, unitCost: r.l.unitPrice ?? r.m!.item.unitCost }));
    if (sup && lines.length) {
      const po = await createPurchaseOrder(sup.id, lines, actor, `From quote ${x.reference}`);
      revalidatePath("/app", "layout");
      return { ok: true, message: `Quote converted to ${po.number}` };
    }
  }

  await logEvent(actor, `document.${x.docType}`, x.reference, `${x.docType.replace(/_/g, " ")} from ${x.counterparty} filed for review`);
  if (x.docType === "customer_po") {
    const lines = x.lines
      .map((l) => ({ m: matchItem(l, s.items), l }))
      .filter((r) => r.m)
      .map((r) => ({ itemId: r.m!.item.id, qty: r.l.qty, unitPrice: r.l.unitPrice ?? r.m!.item.unitCost * 1.8 }));
    await upsertProposals([
      {
        agent: "copilot",
        title: `Book customer PO ${x.reference} from ${x.counterparty}`,
        rationale: `Extracted ${x.lines.length} line(s), ${lines.length} matched to the item master${x.promisedDate ? `, required by ${x.promisedDate}` : ""}. ${x.summary}`,
        impact: `$${lines.reduce((a, l) => a + l.qty * l.unitPrice, 0).toFixed(0)} revenue`,
        confidence: lines.length === x.lines.length ? 0.86 : 0.6,
        dedupeKey: `custpo:${x.reference}`,
        payload: { kind: "book_sales_order", customer: x.counterparty, reference: x.reference, dueAt: x.promisedDate, lines },
      },
    ]);
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: x.docType === "customer_po" ? "Queued for order entry approval" : "Filed" };
}

export async function importItemsAction(rows: ImportedItem[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!rows.length) return { ok: false, message: "Nothing to import" };
  if (rows.length > 5000) return { ok: false, message: "Import up to 5,000 rows at a time" };
  const r = await importItems(rows, `user:${user.id}`);
  revalidatePath("/app", "layout");
  return { ok: true, message: `Imported ${r.created} new, updated ${r.updated}` };
}

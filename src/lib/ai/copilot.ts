import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { MODEL, withFallback, describeAiError, getClaude } from "./client";
import { COPILOT_SYSTEM } from "./prompts";
import { readTools, runReadTool, type ReadToolName } from "@/lib/domain/copilot-tools";
import { getSnapshot, upsertProposals } from "@/lib/db/queries";
import { runOffline } from "./offline";
import type { DemoUser } from "@/lib/auth/users";

export type CopilotEvent =
  | { type: "mode"; mode: "claude" | "offline"; model?: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_end"; id: string; name: string; summary: string; ok: boolean }
  | { type: "proposal"; title: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatTurn = { role: "user" | "assistant"; content: string };
type Emit = (e: CopilotEvent) => void;

function summarise(name: string, result: unknown): string {
  if (Array.isArray(result)) return `${result.length} row${result.length === 1 ? "" : "s"}`;
  if (result && typeof result === "object" && "proposal" in result) return "drafted for approval";
  return name === "plant_kpis" ? "KPIs loaded" : "ok";
}

function buildTools(emit: Emit, user: DemoUser) {
  const reads = (Object.keys(readTools) as ReadToolName[]).map((name) =>
    betaZodTool({
      name,
      description: readTools[name].description,
      inputSchema: readTools[name].schema,
      eager_input_streaming: true,
      run: async (input, ctx) => {
        const result = runReadTool(name, await getSnapshot(), input);
        emit({ type: "tool_end", id: ctx?.toolUse.id ?? name, name, summary: summarise(name, result), ok: true });
        return JSON.stringify(result);
      },
    }),
  );

  const actor = `copilot:${user.id}`;
  const draftPo = betaZodTool({
    name: "draft_purchase_order",
    description:
      "Draft a purchase order for human approval in the Autopilot queue. Use SKUs and supplier codes exactly as returned by other tools. Never claims the PO is sent.",
    inputSchema: z.object({
      supplier_code: z.string(),
      lines: z.array(z.object({ sku: z.string(), qty: z.number().positive() })).min(1),
      reason: z.string().describe("One sentence on why — shown to the approver"),
    }),
    eager_input_streaming: true,
    run: async (input, ctx) => {
      const s = await getSnapshot();
      const sup = s.suppliers.find((x) => x.code === input.supplier_code.toUpperCase());
      if (!sup) throw new Error(`Unknown supplier code ${input.supplier_code}`);
      const lines = input.lines.map((l) => {
        const item = s.items.find((i) => i.sku === l.sku.toUpperCase());
        if (!item) throw new Error(`Unknown SKU ${l.sku}`);
        return { itemId: item.id, qty: l.qty, unitCost: item.unitCost };
      });
      const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
      const title = `Copilot PO: ${input.lines.map((l) => `${l.qty}× ${l.sku}`).join(", ")} from ${sup.name}`;
      await upsertProposals([
        {
          agent: "copilot",
          title,
          rationale: `${input.reason} (requested by ${user.name} via copilot)`,
          impact: `$${total.toFixed(0)} PO`,
          confidence: 0.75,
          dedupeKey: `copilot-po:${sup.id}:${input.lines.map((l) => `${l.sku}x${l.qty}`).join(",")}`,
          payload: { kind: "create_po", supplierId: sup.id, lines },
        },
      ]);
      emit({ type: "tool_end", id: ctx?.toolUse.id ?? "draft", name: "draft_purchase_order", summary: "drafted for approval", ok: true });
      emit({ type: "proposal", title });
      return JSON.stringify({ proposal: title, status: "pending_approval", total: Math.round(total), drafted_by: actor });
    },
  });

  const draftMaintenance = betaZodTool({
    name: "draft_maintenance",
    description: "Draft a preventive-maintenance window on an asset for human approval in the Autopilot queue.",
    inputSchema: z.object({ asset_code: z.string(), hours: z.number().positive().max(24), reason: z.string() }),
    eager_input_streaming: true,
    run: async (input, ctx) => {
      const s = await getSnapshot();
      const asset = s.assets.find((a) => a.code === input.asset_code.toUpperCase());
      if (!asset) throw new Error(`Unknown asset ${input.asset_code}`);
      const title = `Copilot: ${input.hours}h maintenance on ${asset.code} · ${asset.name}`;
      await upsertProposals([
        {
          agent: "copilot",
          title,
          rationale: `${input.reason} (requested by ${user.name} via copilot)`,
          impact: `${input.hours}h planned downtime`,
          confidence: 0.7,
          dedupeKey: `copilot-maint:${asset.id}`,
          payload: { kind: "schedule_maintenance", assetId: asset.id, hours: input.hours },
        },
      ]);
      emit({ type: "tool_end", id: ctx?.toolUse.id ?? "draft", name: "draft_maintenance", summary: "drafted for approval", ok: true });
      emit({ type: "proposal", title });
      return JSON.stringify({ proposal: title, status: "pending_approval" });
    },
  });

  return [...reads, draftPo, draftMaintenance];
}

/**
 * Streams a copilot turn. Uses the SDK tool runner (it owns the
 * call → tool → result loop) with streaming, so text and tool activity reach
 * the browser as they happen.
 */
export async function runCopilot(history: ChatTurn[], user: DemoUser, emit: Emit, signal?: AbortSignal) {
  const client = getClaude();
  if (!client) {
    emit({ type: "mode", mode: "offline" });
    await runOffline(history, emit);
    emit({ type: "done" });
    return;
  }
  emit({ type: "mode", mode: "claude", model: MODEL });

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  // Who is asking changes what's useful (a buyer wants POs, a controller wants dollars).
  const last = messages[messages.length - 1];
  if (last?.role === "user" && typeof last.content === "string") {
    last.content = `[${user.name}, ${user.title}]\n${last.content}`;
  }

  const runner = client.beta.messages.toolRunner(
    {
      model: MODEL,
      max_tokens: 64000,
      system: [{ type: "text", text: COPILOT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
      tools: buildTools(emit, user),
      output_config: { effort: "medium" },
      max_iterations: 8,
      thread: false,
      stream: true,
      ...withFallback(),
    },
    { signal },
  );

  try {
    for await (const messageStream of runner) {
      for await (const event of messageStream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          emit({ type: "tool_start", id: event.content_block.id, name: event.content_block.name });
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          emit({ type: "text", delta: event.delta.text });
        }
      }
      const message = await messageStream.finalMessage();
      if (message.stop_reason === "refusal") {
        emit({ type: "text", delta: "\n\n_I can't help with that request._" });
        break;
      }
      if (message.stop_reason === "max_tokens" && message.content.some((b) => b.type === "tool_use")) {
        emit({ type: "error", message: "The response was cut off mid tool call. Try a narrower question." });
        break;
      }
    }
    emit({ type: "done" });
  } catch (err) {
    if (signal?.aborted) return;
    emit({ type: "error", message: describeAiError(err) });
  }
}

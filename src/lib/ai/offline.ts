import "server-only";
import { runReadTool, type ReadToolName } from "@/lib/domain/copilot-tools";
import { getSnapshot } from "@/lib/db/queries";
import { fmtMoney } from "@/lib/domain/plant";
import type { ChatTurn, CopilotEvent } from "./copilot";

/**
 * Offline copilot: a deterministic intent router over the same tools Claude
 * uses. It keeps the product fully demoable without an API key and is honest
 * about what it is.
 */

type Row = Record<string, unknown>;

const INTENTS: { re: RegExp; tools: ReadToolName[]; input?: Row; render: (r: Row[][]) => string }[] = [
  {
    re: /(stock|inventory|short|reorder|run out|stock-?out|cover|material)/i,
    tools: ["search_inventory"],
    input: { health: "attention" },
    render: ([rows]) =>
      rows.length
        ? `**${rows.length} SKUs need attention.** Lowest cover first:\n\n| SKU | Available | Inbound | Cover | Health |\n|---|---:|---:|---:|---|\n${(
            rows as Row[]
          )
            .sort((a, b) => Number(a.daysOfCover) - Number(b.daysOfCover))
            .map((r) => `| ${r.sku} | ${r.available} ${r.uom} | ${r.inbound} | ${r.daysOfCover}d | ${r.health} |`)
            .join("\n")}\n\nRun **Autopilot → Reorder** to draft the POs.`
        : "Every SKU is above its lead-time-adjusted threshold.",
  },
  {
    re: /(machine|asset|maint|vibration|breakdown|oee|downtime|spindle)/i,
    tools: ["asset_health"],
    render: ([rows]) =>
      `**Highest failure risk:**\n\n${(rows as Row[])
        .slice(0, 4)
        .map(
          (r) =>
            `- **${r.code} ${r.name}** — ${r.failureRiskPct}% risk, OEE ${r.oeePct}%${(r.reasons as string[]).length ? ` · ${(r.reasons as string[]).join("; ")}` : ""}`,
        )
        .join("\n")}`,
  },
  {
    re: /(supplier|vendor|purchase|po\b|buy|procure)/i,
    tools: ["supplier_scorecard"],
    render: ([rows]) =>
      `**Supplier scorecard** (worst on-time first):\n\n| Code | Supplier | On-time | Quality | Lead | Overdue POs |\n|---|---|---:|---:|---:|---:|\n${(
        rows as Row[]
      )
        .sort((a, b) => Number(a.onTimePct) - Number(b.onTimePct))
        .map((r) => `| ${r.code} | ${r.name} | ${r.onTimePct}% | ${r.qualityPct}% | ${r.leadTimeDays}d | ${r.overduePos} |`)
        .join("\n")}`,
  },
  {
    re: /(bottleneck|station|capacity|load|queue|production|wip|work order|wo\b)/i,
    tools: ["station_load"],
    render: ([rows]) => {
      const sorted = [...(rows as Row[])].sort((a, b) => Number(b.backlogDays) - Number(a.backlogDays));
      return `**Bottleneck: ${sorted[0].station}** with ${sorted[0].queuedHours}h queued (${sorted[0].backlogDays} days).\n\n| Station | Jobs | Blocked | Queued h | Backlog |\n|---|---:|---:|---:|---:|\n${sorted
        .map((r) => `| ${r.station} | ${r.jobs} | ${r.blocked} | ${r.queuedHours} | ${r.backlogDays}d |`)
        .join("\n")}`;
    },
  },
  {
    re: /(late|ship|on.?time|deliver|customer|due|risk|order)/i,
    tools: ["list_sales_orders"],
    input: { at_risk_only: true },
    render: ([rows]) =>
      rows.length
        ? `**${rows.length} customer orders are at risk.**\n\n| SO | Customer | Value | Due | Slack | Risk |\n|---|---|---:|---|---:|---|\n${(rows as Row[])
            .map((r) => `| ${r.number} | ${r.customer} | ${fmtMoney(Number(r.value))} | ${r.due} | ${r.slackDays}d | ${r.risk} |`)
            .join("\n")}\n\nOpen **Production** to see which stations are holding them.`
        : "All open orders are forecast to ship on time.",
  },
];

const FALLBACK_INTENT = {
  tools: ["plant_kpis"] as ReadToolName[],
  render: ([k]: Row[][]) => {
    const kpi = k as unknown as Row;
    return `**Plant at a glance**\n\n- Projected on-time delivery **${kpi.projectedOtdPct}%** · ${fmtMoney(Number(kpi.atRiskValue))} of orders at risk\n- ${kpi.wip} jobs in WIP, **${kpi.blocked} blocked**\n- ${kpi.criticalItems} critical SKUs · inventory ${fmtMoney(Number(kpi.inventoryValue))}\n- Average OEE **${kpi.avgOeePct}%** · ${kpi.overduePos} overdue POs\n\nTry: *"what's going to ship late?"*, *"where's the bottleneck?"*, *"which machines need maintenance?"*`;
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runOffline(history: ChatTurn[], emit: (e: CopilotEvent) => void) {
  const q = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const intent = INTENTS.find((i) => i.re.test(q)) ?? FALLBACK_INTENT;
  const s = await getSnapshot();
  const results: Row[][] = [];
  for (const [n, name] of intent.tools.entries()) {
    const id = `offline-${n}`;
    emit({ type: "tool_start", id, name });
    await sleep(180);
    const r = runReadTool(name, s, "input" in intent ? intent.input : {});
    results.push(r as Row[]);
    emit({ type: "tool_end", id, name, summary: Array.isArray(r) ? `${r.length} rows` : "ok", ok: true });
  }
  const text = `${intent.render(results)}\n\n<sub>Offline mode — deterministic answer. Add \`ANTHROPIC_API_KEY\` for the full Claude copilot.</sub>`;
  // Stream in word-sized chunks so the UI behaves the same in both modes.
  for (const chunk of text.match(/[\s\S]{1,24}/g) ?? []) {
    emit({ type: "text", delta: chunk });
    await sleep(8);
  }
}

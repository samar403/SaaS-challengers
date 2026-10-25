"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CopilotEvent } from "@/lib/ai/copilot";
import { Markdown } from "@/components/markdown";
import { Button, cx, Kbd } from "@/components/ui";

type ToolCall = { id: string; name: string; summary?: string; done: boolean };
type Msg = { role: "user" | "assistant"; content: string; tools?: ToolCall[]; proposals?: string[]; error?: string; mode?: string };

const SUGGESTIONS = [
  "What's going to ship late, and what's the root cause?",
  "Where's the bottleneck and what would you do about it?",
  "Draft POs for anything that will stock out within its lead time.",
  "Which machine is most likely to fail this week? Show your reasoning.",
  "Rank suppliers by risk to our open orders.",
];

const TOOL_LABEL: Record<string, string> = {
  plant_kpis: "Reading plant KPIs",
  search_inventory: "Checking stock positions",
  list_work_orders: "Simulating station queues",
  list_sales_orders: "Checking customer orders",
  list_purchase_orders: "Reading purchase orders",
  supplier_scorecard: "Scoring suppliers",
  asset_health: "Reading machine telemetry",
  station_load: "Measuring station load",
  draft_purchase_order: "Drafting a PO for approval",
  draft_maintenance: "Drafting a maintenance window",
};

export function CopilotChat() {
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef<string | null>(null);

  const patchLast = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      const history = [...msgs.filter((m) => m.content && !m.error), { role: "user" as const, content: q }].map(({ role, content }) => ({ role, content }));
      setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", tools: [], proposals: [] }]);
      setBusy(true);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const f of frames) {
            const line = f.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const e = JSON.parse(line.slice(6)) as CopilotEvent;
            patchLast((m) => {
              switch (e.type) {
                case "mode":
                  return { ...m, mode: e.mode === "claude" ? `Claude · ${e.model}` : "Offline engine" };
                case "text":
                  // Text after tool calls means those calls have finished, even if one errored.
                  return { ...m, content: m.content + e.delta, tools: m.tools?.map((t) => ({ ...t, done: true })) };
                case "tool_start":
                  return { ...m, tools: [...(m.tools ?? []), { id: e.id, name: e.name, done: false }] };
                case "tool_end":
                  return { ...m, tools: m.tools?.map((t) => (t.id === e.id ? { ...t, done: true, summary: e.summary } : t)) };
                case "proposal":
                  return { ...m, proposals: [...(m.proposals ?? []), e.title] };
                case "error":
                  return { ...m, error: e.message };
                case "done":
                  return { ...m, tools: m.tools?.map((t) => ({ ...t, done: true })) };
              }
            });
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) patchLast((m) => ({ ...m, error: err instanceof Error ? err.message : "Request failed" }));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, msgs],
  );

  useEffect(() => {
    const q = params.get("q");
    if (q && asked.current !== q) {
      asked.current = q;
      send(q);
    }
  }, [params, send]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  return (
    <div className="sheet reg flex min-h-[calc(100vh-17rem)] flex-col">
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {msgs.length === 0 && (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="label">Copilot · read-only tools + draft actions</div>
            <h2 className="display mt-2 text-2xl">Ask the plant anything.</h2>
            <p className="mt-2 text-sm text-ink-2">
              It reads live inventory, schedules, machines and suppliers through the same functions the agents use, and can draft — never execute — POs and
              maintenance.
            </p>
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[13px] hover:border-accent hover:bg-accent-soft"
                >
                  <span className="mr-1 font-mono text-accent">&gt;</span> {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-[3px] bg-ink px-3.5 py-2 text-[13.5px] text-paper">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="max-w-3xl">
              <div className="label mb-1.5 flex items-center gap-2">
                <span className="text-accent">◉</span> Lathe {m.mode && <span className="opacity-70">· {m.mode}</span>}
              </div>
              {!!m.tools?.length && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {m.tools.map((t) => (
                    <li
                      key={t.id}
                      className={cx(
                        "flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10.5px]",
                        t.done ? "border-line text-ink-2" : "border-blue/50 text-blue",
                      )}
                    >
                      <span className={cx(!t.done && "animate-spin")}>{t.done ? "✓" : "◌"}</span>
                      {TOOL_LABEL[t.name] ?? t.name}
                      {t.summary && <span className="text-ink-3">· {t.summary}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {m.content ? <Markdown text={m.content} /> : !m.error && <div className="caret font-mono text-[12px] text-ink-3">thinking</div>}
              {!!m.proposals?.length && (
                <div className="mt-3 rounded-[3px] border border-accent/40 bg-accent-soft p-3 text-[12.5px]">
                  <div className="label mb-1 !text-accent">Drafted for approval</div>
                  {m.proposals.map((p) => (
                    <div key={p}>▸ {p}</div>
                  ))}
                  <Link href="/app/autopilot" className="mt-1 inline-block font-mono text-[11px] font-semibold text-accent uppercase hover:underline">
                    Review in Autopilot →
                  </Link>
                </div>
              )}
              {m.error && <div className="mt-2 font-mono text-[12px] text-critical">■ {m.error}</div>}
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <span className="pb-2 font-mono text-accent">&gt;</span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask about stock, schedules, machines, suppliers…"
          aria-label="Message the copilot"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-ink-3"
        />
        {busy ? (
          <Button type="button" variant="ghost" onClick={() => abort.current?.abort()}>
            ■ Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!input.trim()}>
            Send <Kbd>↵</Kbd>
          </Button>
        )}
      </form>
    </div>
  );
}

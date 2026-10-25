"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cx, Kbd } from "@/components/ui";

const ASKS = [
  "What's going to ship late this week, and why?",
  "Where is the bottleneck right now?",
  "Which SKUs will stock out before the next delivery?",
  "Which machines need maintenance?",
  "How are our suppliers performing?",
];

type Entry = { id: string; label: string; hint: string; tag: string; run: () => void };

/** ⌘K console — jump to any sheet or hand a question straight to the copilot. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lathe:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lathe:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      setQ("");
      router.push(href);
    };
    const term = q.trim().toLowerCase();
    const nav = NAV.filter((n) => !term || `${n.label} ${n.hint} ${n.sheet}`.toLowerCase().includes(term)).map((n) => ({
      id: n.href,
      label: n.label,
      hint: n.hint,
      tag: `Sheet ${n.sheet}`,
      run: go(n.href),
    }));
    const asks = (term ? [q.trim()] : ASKS).map((a, i) => ({
      id: `ask-${i}`,
      label: a,
      hint: "Ask the copilot",
      tag: "Ask",
      run: go(`/app/copilot?q=${encodeURIComponent(a)}`),
    }));
    return term ? [...asks, ...nav] : [...nav, ...asks];
  }, [q, router]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal aria-label="Command console" className="sheet reg w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="font-mono text-accent">&gt;</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(entries.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") entries[sel]?.run();
            }}
            placeholder="Jump to a sheet, or ask the plant a question…"
            className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-ink-3"
            aria-label="Command"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="scroll-thin max-h-[52vh] overflow-y-auto py-1" role="listbox">
          {entries.map((e, i) => (
            <li key={e.id} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={e.run}
                className={cx("flex w-full items-center gap-3 px-4 py-2 text-left", i === sel && "bg-accent-soft")}
              >
                <span className="label w-16 shrink-0">{e.tag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{e.label}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">{e.hint}</span>
                </span>
                {i === sel && <span className="font-mono text-[11px] text-accent">↵</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("lathe:palette"))}
      className="flex h-8 w-full max-w-md items-center gap-2 rounded-[3px] border border-line bg-panel px-3 text-left font-mono text-[12px] text-ink-3 hover:border-line-strong"
    >
      <span className="text-accent">&gt;</span>
      <span className="caret flex-1 truncate">Ask the plant or jump to a sheet</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}

"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("lathe-theme", next);
        } catch {}
        listeners.forEach((l) => l());
      }}
      className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-line px-2.5 font-mono text-[10.5px] tracking-widest text-ink-2 uppercase hover:bg-panel-2 hover:text-ink"
      aria-label={`Switch to ${next === "dark" ? "blueprint" : "drafting"} theme`}
      title={`Switch to ${next === "dark" ? "blueprint (dark)" : "drafting (light)"}`}
    >
      <span
        aria-hidden
        className="inline-block size-3 rounded-full border border-current"
        style={{ background: theme === "dark" ? "transparent" : "currentColor" }}
      />
      {theme === "dark" ? "Blueprint" : "Drafting"}
    </button>
  );
}

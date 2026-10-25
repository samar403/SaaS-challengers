"use client";

import { useEffect, useState } from "react";

/** CAD-style status line: live cursor coordinates, snap/grid indicators, plant clock. */
export function StatusBar({ children }: { children?: React.ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [clock, setClock] = useState("");
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: Math.round(e.clientX / 4) * 4, y: Math.round(e.clientY / 4) * 4 });
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }));
    tick();
    const t = setInterval(tick, 1000);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      clearInterval(t);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  const pad = (n: number) => String(n).padStart(4, "0");
  return (
    <footer className="sticky bottom-0 z-30 flex h-7 items-center gap-4 overflow-hidden border-t border-line bg-panel/90 px-3 font-mono text-[10.5px] tracking-wider text-ink-3 uppercase backdrop-blur">
      <span className="hidden sm:inline">
        X <span className="text-ink-2">{pad(pos.x)}</span> Y <span className="text-ink-2">{pad(pos.y)}</span>
      </span>
      <span className="hidden md:inline">Snap ✓</span>
      <span className="hidden md:inline">Grid 16</span>
      <span className="hidden lg:inline">Ortho ✓</span>
      <span className="truncate">Plant DAY-01 · Halvorsen Fabrication</span>
      <span className="ml-auto flex items-center gap-4">
        {children}
        <span suppressHydrationWarning>EST {clock}</span>
      </span>
    </footer>
  );
}

"use client";

import { useState } from "react";
import { SheetIndex } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-[3px] border border-line px-2.5 font-mono text-[10.5px] tracking-widest uppercase"
        aria-expanded={open}
      >
        Sheets
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30" onClick={() => setOpen(false)}>
          <div className="sheet h-full w-72 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <SheetIndex onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

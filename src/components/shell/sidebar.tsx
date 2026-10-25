"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cx } from "@/components/ui";

export function SheetIndex({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Sheet index" className="flex flex-col">
      <div className="label px-4 pt-4 pb-2">Sheet index</div>
      <ul>
        {NAV.map((n) => {
          const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex items-center gap-3 border-l-2 px-4 py-[7px] text-[13px] transition",
                  active ? "border-accent bg-accent-soft font-semibold text-ink" : "border-transparent text-ink-2 hover:bg-panel-2 hover:text-ink",
                )}
              >
                <span className={cx("num w-5 text-[11px]", active ? "text-accent" : "text-ink-3")}>{n.sheet}</span>
                <span className="truncate">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

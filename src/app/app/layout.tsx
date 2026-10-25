import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SheetIndex } from "@/components/shell/sidebar";
import { CommandPalette, PaletteButton } from "@/components/shell/command-palette";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { StatusBar } from "@/components/shell/status-bar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Wordmark } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { aiMode, MODEL } from "@/lib/ai/client";
import { signOut } from "@/app/actions";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-line bg-paper/85 px-3 backdrop-blur sm:px-4">
        <MobileNav />
        <Link href="/app" className="shrink-0" aria-label="Lathe home">
          <Wordmark />
        </Link>
        <span className="label hidden border-l border-line pl-3 md:inline">Halvorsen Fabrication · DAY-01</span>
        <div className="flex flex-1 justify-center px-2">
          <PaletteButton />
        </div>
        <ThemeToggle />
        <Suspense fallback={<div className="h-8 w-28 animate-pulse rounded-[3px] bg-panel-2" />}>
          <UserMenu />
        </Suspense>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-12 hidden h-[calc(100vh-3rem-1.75rem)] w-56 shrink-0 overflow-y-auto border-r border-line bg-paper/60 lg:block">
          <SheetIndex />
          <div className="mx-4 mt-6 border-t border-line pt-3">
            <div className="label">Revision</div>
            <div className="num text-[11px] text-ink-2">REV C · Lathe v0.1</div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6">{children}</main>
      </div>
      <StatusBar>
        <Suspense fallback={<span>AI …</span>}>
          <AiBadge />
        </Suspense>
      </StatusBar>
      <CommandPalette />
    </div>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-[3px] border border-line px-2 hover:bg-panel-2">
        <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[10px] font-bold text-paper">{user.initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[12px] font-semibold">{user.name}</span>
          <span className="label block !text-[9px]">{user.title}</span>
        </span>
      </summary>
      <div className="sheet absolute right-0 mt-2 w-56 p-2">
        <div className="label px-2 pb-1">Signed in as</div>
        <div className="px-2 pb-2 text-sm">{user.name}</div>
        <Link href="/login" className="block rounded-[3px] px-2 py-1.5 text-sm hover:bg-panel-2">
          Switch persona
        </Link>
        <form action={signOut}>
          <button className="w-full rounded-[3px] px-2 py-1.5 text-left text-sm text-critical hover:bg-critical-soft">Sign out</button>
        </form>
      </div>
    </details>
  );
}

async function AiBadge() {
  await connection();
  const mode = aiMode();
  return (
    <span className={mode === "claude" ? "text-good" : "text-warning"} title={mode === "claude" ? MODEL : "Set ANTHROPIC_API_KEY to enable Claude"}>
      {mode === "claude" ? "● AI online" : "▲ AI offline mode"}
      <span className="ml-1 text-ink-3">{mode === "claude" ? MODEL : "deterministic"}</span>
    </span>
  );
}

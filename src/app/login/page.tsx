import Link from "next/link";
import { USERS } from "@/lib/auth/users";
import { signIn } from "@/app/actions";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export const metadata = { title: "Enter the demo plant" };

const BLURB: Record<string, string> = {
  dana: "Owns the floor. Sees everything, approves every agent — maintenance and expedites included.",
  marcus: "Keeps material flowing. Approves reorder and supplier proposals, drafts POs with the copilot.",
  priya: "Watches cash. Approves spend on purchasing proposals, audits the ledger.",
};

export default function Login() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col justify-center py-10">
        <div className="label">Sheet 00 · Access</div>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Enter Halvorsen Fabrication.</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          A 140-person metal fabricator in Dayton, Ohio, mid-migration off a 2004-era ERP. Pick a persona — permissions follow the role, so what you can approve
          changes.
        </p>
        <form action={signIn} className="mt-8 grid gap-4 md:grid-cols-3">
          {USERS.map((u, i) => (
            <button
              key={u.id}
              name="user"
              value={u.id}
              className="sheet reg group flex flex-col items-start gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="flex w-full items-center justify-between">
                <span className="grid size-10 place-items-center rounded-full bg-ink font-mono text-sm font-bold text-paper">{u.initials}</span>
                <span className="label">P-0{i + 1}</span>
              </div>
              <div>
                <div className="text-lg font-semibold">{u.name}</div>
                <div className="label">{u.title}</div>
              </div>
              <p className="text-sm text-ink-2">{BLURB[u.id]}</p>
              <span className="mt-auto font-mono text-[11px] font-semibold tracking-widest text-accent uppercase group-hover:underline">Sign in →</span>
            </button>
          ))}
        </form>
        <p className="mt-6 font-mono text-[11px] text-ink-3">
          Demo authentication · signed, HTTP-only session cookie · swap for SSO (OIDC/SAML) in production.
        </p>
      </main>
    </div>
  );
}

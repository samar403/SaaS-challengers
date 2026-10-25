import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="sheet reg max-w-md p-8 text-center">
        <div className="label">Sheet not found · 404</div>
        <h1 className="display mt-2 text-3xl">This drawing isn&apos;t in the set.</h1>
        <p className="mt-2 text-sm text-ink-2">The sheet you asked for was never issued, or it was superseded by a later revision.</p>
        <Link
          href="/app"
          className="mt-6 inline-flex h-9 items-center rounded-[3px] bg-accent px-4 font-mono text-[11.5px] font-semibold tracking-wider text-accent-ink uppercase"
        >
          Back to the command deck
        </Link>
      </div>
    </main>
  );
}

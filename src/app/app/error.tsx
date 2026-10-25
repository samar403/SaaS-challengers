"use client";

import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="sheet reg mx-auto mt-10 max-w-lg p-8">
      <div className="label text-critical">■ Stop condition</div>
      <h1 className="display mt-2 text-2xl">This sheet failed to render.</h1>
      <p className="mt-2 text-sm text-ink-2">
        Nothing was written — reads and writes are separate. Try again; if it repeats, the ledger and server logs carry reference{" "}
        <code className="num">{error.digest ?? "n/a"}</code>.
      </p>
      <Button variant="primary" className="mt-5" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}

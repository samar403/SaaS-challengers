"use client";

import { useActionState } from "react";
import { runAgentsAction, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui";

export function RunAgentsButton({ label = "Run agents" }: { label?: string }) {
  const [state, run, pending] = useActionState<ActionResult>(runAgentsAction, null);
  return (
    <form action={run} className="flex items-center gap-3">
      <Button variant="primary" disabled={pending}>
        {pending ? "Scanning plant…" : `▶ ${label}`}
      </Button>
      {state && (
        <span role="status" className="font-mono text-[11px] text-ink-2">
          {state.message}
        </span>
      )}
    </form>
  );
}

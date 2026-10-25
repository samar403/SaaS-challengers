<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (Lathe)

- Domain logic lives in `src/lib/domain` and must stay pure (no Next, DB or network imports) — add Vitest coverage in `tests/` for changes there.
- All plant reads go through `src/lib/db/queries.ts` (which calls `connection()`); all writes must log to the `events` ledger.
- Agents and the copilot may only create proposals; execution happens in `decideProposal` after `canApprove`.
- Claude calls live only in `src/lib/ai`; each needs an offline path. Default model `claude-opus-5-5` with `withFallback()`.
- After editing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.
- Run `npm run check` before committing.

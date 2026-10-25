<div align="center">

# ◎ Lathe

### Rip out the ERP. Keep the factory.

**The AI-native operating system for industrial companies** — a working answer to Y Combinator's Request for Startups:
_“SaaS challengers: AI-native replacements for old ERPs and industrial software.”_

[![CI](https://github.com/samar403/SaaS-challengers/actions/workflows/ci.yml/badge.svg)](https://github.com/samar403/SaaS-challengers/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-0f1f3d) ![Claude](https://img.shields.io/badge/AI-Claude%20Opus%205.5-ff5a1f) ![SQLite / libSQL](https://img.shields.io/badge/DB-SQLite%20%2F%20libSQL-1557c0) ![License: MIT](https://img.shields.io/badge/license-MIT-3e4a63)

</div>

---

Mid-market manufacturers run on ERPs designed before the cloud: 12–24 month implementations, per-seat pricing, integrator day rates, and a
“real ERP” that lives in Excel. Lathe replaces that with a system that **reads** the paperwork of the physical world (legacy exports,
invoices, acknowledgements, customer emails), **reasons** across modules (a short sheet of steel → a blocked job → a late customer order),
and **acts with permission** (agents draft the PO, the expedite, the maintenance window — a person approves, the ledger records).

The whole product is designed as an **engineering drawing set**: every screen is a numbered sheet with a title block, registration marks,
dimension lines and rubber-stamp approvals, in a _drafting-vellum_ light theme and a _blueprint_ dark theme.

> 📄 **The idea, explained:** [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) · 🏗 **How it's built:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## What's in the box

| Sheet | Module              | What it does                                                                                                                                         |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| —     | **Landing**         | The pitch as a drawing set: a self-drafting part drawing annotated with live ERP data, NCR-style problem statements, routing card, revision history. |
| 01    | **Command deck**    | KPI row, line-flow schematic with bottleneck detection, ranked cross-module signals, Claude-written shift brief, autopilot queue, ledger tail.       |
| 02    | **Production**      | Finite-capacity forecast per station; kanban of work orders with real slack vs due date; advance jobs through the routing.                           |
| 03    | **Inventory**       | Stock net of allocations and inbound POs, lead-time-adjusted thresholds, days-of-cover meters, legacy part numbers.                                  |
| 04    | **Purchasing**      | POs (raised by people _or_ agents), receiving into stock, supplier on-time/quality scorecard.                                                        |
| 05    | **Customer orders** | Delivery-forecast timeline: order life, due date and simulated ready date per order.                                                                 |
| 06    | **Assets**          | Machine health, OEE, vibration (ISO 10816), service vs MTBF — explainable failure-risk scores.                                                       |
| 07    | **Autopilot**       | Four agents (reorder, expedite, maintenance, supplier risk) + copilot drafts → human approval with **segregation of duties**.                        |
| 08    | **Copilot**         | Streaming chat grounded in 8 read tools; can _draft_ POs and maintenance windows, never execute.                                                     |
| 09    | **Ingest**          | PDF / image / text → structured extraction (Claude structured outputs) → item matching → **three-way match** vs the PO → commit.                     |
| 10    | **Migrate**         | Drop an SAP MM60 / Epicor / Oracle export: legacy-field mapping (MATNR, MINBE, LIFNR…), number/format repair, row rejection, upsert.                 |
| 11    | **Ledger**          | Append-only audit trail of every human, agent and system change.                                                                                     |

Plus: ⌘K command console, persona-based auth with role permissions, CAD-style status bar, light/dark themes, responsive down to 390px.

## Five-minute demo script

1. Open the landing page, then **Enter the demo plant** and pick **Marcus (buyer)**.
2. **Sheet 07 → Run agents.** Ten proposals appear. Approve a reorder — a real PO is created (Sheet 04) and logged (Sheet 11).
   Try approving the CNC-03 maintenance proposal: blocked — buyers can't approve maintenance.
3. **Sheet 09 → Supplier invoice → Extract.** Lines are matched to the item master and checked against PO-1041:
   the plate price is flagged (+1.7%) and the 10ga sheet is “not on PO”. Commit it.
4. **Sheet 10 → SAP ECC · MM60.** Cryptic SAP fields map automatically; German decimals and zero-padded MATNRs are repaired; a duplicate and
   a blank description are rejected with row numbers. Import.
5. **⌘K → “What's going to ship late?”** — the copilot answers with SO numbers, slack and root cause.
6. Sign in as **Dana (plant manager)** and approve the maintenance window. Toggle **Blueprint** mode.

## AI architecture

Claude is used where language is the hard part; deterministic code is used where numbers must be exact.

| Capability           | Claude API feature                                                                                                        | Fallback without a key                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Copilot              | SDK **tool runner** (`betaZodTool`, streaming, eager input streaming), 10 tools, `effort: "medium"`, cached system prompt | Deterministic intent router over the same tools |
| Document extraction  | **Structured outputs** (`messages.parse` + Zod schema), PDF `document` and `image` blocks                                 | Regex parser for well-formed text docs          |
| Legacy field mapping | Structured outputs refining a heuristic first pass; validated against real headers                                        | Synonym dictionary + type sniffing              |
| Shift brief          | Short low-effort generation from a JSON snapshot                                                                          | Template from ranked signals                    |

- **Model:** `claude-opus-5-5` (override with `LATHE_MODEL`). Every request opts into **server-side refusal fallback**
  (`fallbacks: "default"`) so a false-positive classifier decline doesn't break an operator's workflow; `stop_reason` is checked before use.
- **Agents never write.** Read tools are pure functions over a plant snapshot; write tools only create _proposals_. Execution happens in
  `decideProposal` after a role check, and every step lands in the append-only ledger.
- **Offline mode** keeps the whole product usable — and the CI deterministic — with no API key.

## Stack & layout

Next.js 16 (App Router, Cache Components, Partial Prerendering, Server Actions, `proxy.ts`) · React 19 · TypeScript (strict) ·
Tailwind CSS 4 · Drizzle ORM on SQLite/libSQL (Turso-ready) · Anthropic TypeScript SDK · Zod 4 · Vitest · ESLint · Prettier ·
Docker · GitHub Actions. Fonts are self-hosted (Archivo variable-width + JetBrains Mono); no runtime CDN calls.

The repo follows a universal starter layout — UI, domain logic, data and AI are separate layers, and the domain layer has no framework imports:

```
src/
  app/                 routes: landing, login, /app/* sheets, /api/{copilot,ingest,migrate}, server actions
  components/          ui kit (sheet, title block, stat tile, meter, stamp), shell, plant widgets, landing
  lib/
    domain/            pure planning math, agents, signals, migration mapper, document schema  ← unit-tested
    db/                Drizzle schema, client (auto-migrate + seed), queries & executors
    ai/                Claude client, prompts, copilot runner, extraction/mapping/brief, offline engine
    auth/              signed session tokens, personas, segregation-of-duties matrix
  proxy.ts             auth gate for /app and /api
drizzle/               SQL migrations (generated)
tests/                 Vitest suites run against a migrated + seeded in-memory database
public/samples/        legacy exports and documents for the demo
docs/                  product brief and architecture
```

## Getting started

```bash
git clone https://github.com/samar403/SaaS-challengers.git lathe && cd lathe
npm install
cp .env.example .env.local      # optional: add ANTHROPIC_API_KEY for the full AI experience
npm run dev                     # http://localhost:3000 — the database is created and seeded on first request
```

**Docker:** `docker compose up --build` (data persists in a named volume; pass `ANTHROPIC_API_KEY` through your shell).

| Script                            | Purpose                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Develop, build, serve                                                 |
| `npm run check`                   | Lint + typecheck + tests (what CI runs, minus build)                  |
| `npm test`                        | Vitest: planning math, agents, migration mapper, extraction, sessions |
| `npm run db:generate`             | Generate a migration after editing `src/lib/db/schema.ts`             |
| `npm run db:reset`                | Delete the local database; it re-seeds on next start                  |
| `npm run format`                  | Prettier                                                              |

### Environment

| Variable                 | Default                | Notes                                                             |
| ------------------------ | ---------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | —                      | Enables Claude. Without it Lathe runs in Offline mode.            |
| `LATHE_MODEL`            | `claude-opus-5-5`      | Any Messages-API model id.                                        |
| `DATABASE_URL`           | `file:./data/lathe.db` | Use `libsql://…` for Turso in serverless deployments.             |
| `DATABASE_AUTH_TOKEN`    | —                      | Turso token.                                                      |
| `SESSION_SECRET`         | demo value             | **Set ≥32 random chars in production.**                           |
| `LATHE_INSECURE_COOKIES` | —                      | `1` to allow session cookies over plain HTTP (local Docker only). |

## Deploying

- **Vercel / serverless:** set `DATABASE_URL` to a Turso database (local SQLite files don't persist on serverless), plus `SESSION_SECRET`
  and `ANTHROPIC_API_KEY`. Migrations and seed run automatically on first request.
- **Container:** the Dockerfile builds a standalone server (`NEXT_OUTPUT=standalone`), runs as a non-root user, and keeps SQLite in `/app/data`.

## Security notes

Signed, HTTP-only, `SameSite=Lax` session cookies (HMAC-SHA256, constant-time compare, expiry); auth enforced in `proxy.ts` _and_ in
the data-access layer; role checks on every approval; API bodies validated with Zod and size-capped; uploads limited to 8 MB; model output
rendered through an escaping markdown renderer; security headers (`X-Frame-Options`, `nosniff`, referrer and permissions policy).
The persona picker is demo auth — swap in OIDC/SAML for production.

## Roadmap

Quality (NCR/CAPA) · costing & GL · EDI 850/855/810 · multi-plant MRP · OPC-UA live telemetry · supplier portal · evals for the copilot and extractor.

## License

[MIT](LICENSE) © samar403. Demo company, people and data are fictional.

# Lathe — product brief

> **The prompt.** Build an AI-native replacement for the legacy ERP and industrial software that runs mid-market manufacturers.
> It must earn trust on day one by reading the data and documents the customer already has, prove value inside the first week
> without a big-bang migration, and keep humans in control of every consequential action. It should feel like a tool built
> by people who have stood on a shop floor — not like another enterprise form-builder.

This document explains the idea behind the repository: who it is for, why it can win now, and how the demo maps to a company.

## 1. The opportunity

Y Combinator's Request for Startups lists **“SaaS challengers: AI-native replacements for old ERPs and industrial software.”**
The thesis: a generation of vertical systems of record (ERP, MRP, MES, CMMS, QMS) was built for clerks typing into forms. Large
language models change what the software can do on its own — so the winning products in these categories will be rebuilt around AI,
not bolted onto it.

Industrial ERP is the hardest and most valuable version of that bet:

- **Huge, sticky spend.** Every manufacturer, distributor and job shop runs on one, typically for 10–20 years.
- **Hated incumbents.** Long implementations, consultants, per-seat pricing, and UIs that push planners into spreadsheets.
- **Clerical work everywhere.** Buyers re-key invoices and acknowledgements; planners build the “real” schedule in Excel;
  maintenance lives on whiteboards. This is precisely the work LLMs now do well.

## 2. Customer

**Ideal customer profile:** discrete manufacturers and fabricators, 50–500 employees, $10M–$250M revenue, one to five plants, running an
aging on-prem or hosted ERP (SAP ECC/Business One, Epicor, Infor, Sage, Dynamics GP/NAV, JobBOSS, or something homegrown).

**Buyers and users** (the demo personas):

| Persona              | Pain today                                                 | What Lathe gives them                                                            |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Plant manager (Dana) | Learns about late orders from the customer                 | Ranked signals, true slack per order, one-click expedite / maintenance approvals |
| Buyer (Marcus)       | Retypes invoices, chases suppliers, guesses reorder points | Agent-drafted POs, document ingestion with three-way match, supplier risk        |
| Controller (Priya)   | Can't trust inventory value or who changed what            | Live valuation, approval controls, immutable ledger                              |

## 3. The wedge: migration as the product

ERP replacement fails at the start: the migration. Lathe flips it — **the migration is the onboarding**.

1. Customer exports what their old ERP already produces (SAP MM60, Epicor Part, item masters, open POs).
2. Lathe maps cryptic legacy fields (MATNR, MINBE, LIFNR…), repairs formats (decimal commas, zero padding, trailing minus signs),
   rejects bad rows with reasons, and loads a usable item master in an afternoon.
3. Lathe **shadow-runs** next to the old system: agents and the copilot start finding late orders and stock-outs in week one, while the
   legacy ERP stays the system of record.
4. Modules flip over one at a time (purchasing first, then production, then finance) as trust is earned.

## 4. Product principles

1. **Read before you write.** The fastest path to value is ingesting what exists — exports, PDFs, emails — not new forms.
2. **Deterministic where numbers matter, generative where language matters.** Stock positions, capacity forecasts and risk scores are
   explainable code; Claude reads documents, maps schemas, answers questions and writes briefs.
3. **Agents draft, humans decide.** Every agent output is a proposal with a rationale, impact and confidence. Execution requires a person
   whose role allows it (segregation of duties), and both steps are written to an append-only ledger.
4. **Works without the model.** Offline mode keeps the plant running if the AI is unavailable or not yet approved by IT.
5. **A UI with a point of view.** Manufacturing people read drawings. The product is a drawing set: sheets, title blocks, dimension
   lines, revision stamps — calm, dense and legible on the shop floor.

## 5. Why now

- Models reliably extract structured data from messy documents and map unfamiliar schemas — the two tasks that made ERP projects slow.
- Tool use lets a model answer cross-module questions through audited functions instead of hallucinating numbers.
- Incumbents are mid-way through forced cloud migrations (e.g. SAP ECC end of mainstream maintenance), so customers are re-evaluating anyway.

## 6. Business model

Priced **per plant, not per seat** — everyone on the floor gets access, which is how the copilot becomes habit.

| Plan  | Price                  | Notes                                                                |
| ----- | ---------------------- | -------------------------------------------------------------------- |
| Pilot | $0 / 30 days           | Migration sprint + shadow run on one plant                           |
| Plant | $2,900 / plant / month | All modules, unlimited seats, SSO, audit export                      |
| Group | Custom                 | Multi-plant MRP, private model deployment, forward-deployed engineer |

## 7. Moat

- **Process data:** every approval, rejection and correction becomes labelled data on how this plant actually runs.
- **Connectors and parsers** for the long tail of legacy exports, supplier document formats and machine telemetry.
- **Switching costs, earned the right way:** a system of record people choose to stay in.

## 8. Risks & mitigations

| Risk                      | Mitigation                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| “AI in our ERP” fear      | Drafts-only agents, role-gated approvals, explainable scores, offline mode, full audit trail |
| Long sales cycles         | Free pilot that starts from exports; value in week one while the old ERP keeps running       |
| Model errors on documents | Structured outputs + schema validation + item matching + three-way match + human commit      |
| Data residency            | Self-hostable (Docker, SQLite/libSQL), model selectable per deployment                       |

## 9. What the demo proves

The repo implements a working slice of the company: a seeded 140-person fabricator, eleven connected modules, four agents, a tool-using
copilot, document ingestion with three-way match, legacy migration from SAP/Epicor exports, role-based approvals and an immutable ledger —
running with or without an API key.

## 10. Metrics that would matter

Time from first export to first accepted proposal · proposals accepted per week · invoices processed without re-keying ·
projected vs actual on-time delivery · weekly active users per plant · modules cut over from the legacy ERP.

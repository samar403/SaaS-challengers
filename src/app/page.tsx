import Link from "next/link";
import { Wordmark, LatheMark } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { HeroDrawing } from "@/components/landing/hero-drawing";
import { NAV } from "@/lib/nav";

const NCRS = [
  {
    id: "NCR-001",
    title: "Implementations measured in years",
    body: "Legacy ERP rollouts at mid-market manufacturers routinely run past a year, need an army of integrators, and freeze the business process in the shape of 1998.",
    disposition: "Scrap",
  },
  {
    id: "NCR-002",
    title: "The real ERP is a spreadsheet",
    body: "Planners export to Excel because the system can't answer “what ships late and why?”. The truth lives in shadow files, whiteboards and a scheduler's head.",
    disposition: "Rework",
  },
  {
    id: "NCR-003",
    title: "People working as middleware",
    body: "Buyers retype invoices, re-key acknowledgements and chase suppliers by email. Every document is read by a human and re-entered by a human.",
    disposition: "Automate",
  },
];

const OPS = [
  {
    op: "10",
    name: "Ingest",
    time: "an afternoon",
    body: "Point Lathe at the exports your old ERP already produces — SAP MM60, Epicor Part, Oracle items, Access dumps. Claude maps MATNR, MINBE and LIFNR; bad rows are rejected with reasons.",
  },
  {
    op: "20",
    name: "Understand",
    time: "continuous",
    body: "One live model of the plant: stock net of allocations and inbound, finite-capacity station queues, machine health and supplier reliability — all computed, not typed.",
  },
  {
    op: "30",
    name: "Operate",
    time: "every shift",
    body: "Ask anything in plain language. The copilot answers through the same audited functions the agents use, and cites the WO, PO or SKU so you can act.",
  },
  {
    op: "40",
    name: "Autopilot",
    time: "24 / 7",
    body: "Agents draft the reorder, the expedite, the maintenance window, the supplier switch. A person with the right role approves. The ledger records both.",
  },
];

const COMPARE = [
  ["Time to first value", "12–24 months of blueprinting", "Days: load your exports, start operating"],
  ["Data entry", "Clerks re-key every document", "Invoices, acks and emails extracted & matched"],
  ["Answers", "Canned reports + Excel", "Ask in English, grounded in live data"],
  ["Exceptions", "Found by a planner, eventually", "Detected, ranked and drafted by agents"],
  ["Control", "Batch jobs nobody understands", "Human approval, segregation of duties, ledger"],
  ["Interface", "Green screens & 40-tab forms", "One drawing set, one command line"],
  ["Pricing", "Per seat, plus integrator day rates", "Per plant, unlimited seats"],
];

const TRUST = [
  ["Drafts, never actions", "Agents and the copilot can only propose. Execution happens on human approval."],
  ["Segregation of duties", "Buyers approve purchasing, plant managers approve maintenance and expedites."],
  ["Append-only ledger", "Every change by a person, agent or the system is an immutable entry."],
  ["Explainable scores", "Risk, cover and slack show their working — no black-box numbers."],
  ["Works without a model", "Offline mode runs deterministic engines, so the plant never stops."],
  ["Your data, exportable", "Plain SQLite / libSQL schema. Leave whenever you want — unlike last time."],
];

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Lathe">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-5 font-mono text-[11px] tracking-widest text-ink-2 uppercase md:flex">
            <a href="#problem" className="hover:text-ink">
              Problem
            </a>
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#modules" className="hover:text-ink">
              Modules
            </a>
            <a href="#trust" className="hover:text-ink">
              Trust
            </a>
            <a href="#pricing" className="hover:text-ink">
              Pricing
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-[3px] bg-accent px-3 font-mono text-[11px] font-semibold tracking-wider text-accent-ink uppercase hover:brightness-105"
            >
              Demo plant →
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
        <div className="rise">
          <div className="inline-flex items-center gap-2 rounded-[3px] border border-line-strong bg-panel px-2.5 py-1 font-mono text-[10.5px] tracking-widest uppercase">
            <span className="text-accent">◆</span> YC Request for Startups · SaaS challengers
          </div>
          <h1 className="display mt-5 text-[42px] leading-[1.02] sm:text-6xl">
            Rip out the ERP.
            <br />
            <span className="text-accent">Keep the factory.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Lathe is the AI-native operating system for industrial companies. It reads your legacy exports, invoices and emails, runs the plant with agents, and
            asks a human before it acts. Live in days — not after an 18-month implementation.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-accent px-5 font-mono text-[12.5px] font-semibold tracking-wider text-accent-ink uppercase shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] hover:brightness-105"
            >
              Enter the demo plant →
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center rounded-[3px] border border-line-strong px-5 font-mono text-[12.5px] font-semibold tracking-wider uppercase hover:bg-panel-2"
            >
              How it works
            </a>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 border-t border-line pt-5">
            {[
              ["11", "sheets, one system"],
              ["4", "autopilot agents"],
              ["0", "green screens"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="num text-3xl font-semibold">{n}</dt>
                <dd className="label mt-1">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="sheet reg relative p-3 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">FIG. 00 · Bracket HB-40, as Lathe sees it</span>
            <span className="label">Scale 1:2</span>
          </div>
          <HeroDrawing />
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead
            sheet="A"
            kicker="The incumbents"
            title="Old ERPs failed inspection."
            sub="Industrial companies run on software built before the cloud, sold by seat, installed by consultants. We wrote it up the way a quality engineer would."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {NCRS.map((n) => (
              <article key={n.id} className="sheet reg relative p-5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="num text-[12px] font-bold">{n.id}</span>
                  <span className="label">Non-conformance report</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{n.title}</h3>
                <p className="mt-2 text-[14px] text-ink-2">{n.body}</p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                  <span className="label">Disposition</span>
                  <span className="stamp text-critical">{n.disposition}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WHY NOW */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead
          sheet="B"
          kicker="Why now"
          title="Models can finally read the mess."
          sub="The hard part of an ERP was never the database. It was turning PDFs, scans, emails and 20-year-old exports into clean records — and knowing what to do next. That is exactly what large language models are good at."
        />
        <div className="mt-10 grid gap-px overflow-hidden rounded-[3px] border border-line bg-line md:grid-cols-3">
          {[
            ["Read", "Invoices, acknowledgements, customer POs and legacy exports become structured, validated records with confidence scores."],
            ["Reason", "Connect causes across modules: a short sheet of steel → a blocked job → a late customer order → revenue at risk."],
            ["Act — with permission", "Draft the PO, the expedite, the maintenance window. Humans approve; the ledger remembers."],
          ].map(([t, b], i) => (
            <div key={t} className="bg-panel p-6">
              <div className="num text-accent">0{i + 1}</div>
              <h3 className="display mt-2 text-xl">{t}</h3>
              <p className="mt-2 text-[14px] text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead sheet="C" kicker="Routing card" title="From legacy export to autopilot in four operations." />
          <div className="sheet reg mt-10 overflow-hidden">
            <div className="hidden grid-cols-[80px_180px_1fr_140px] border-b border-line-strong md:grid">
              {["Op", "Operation", "Description", "Cycle time"].map((h) => (
                <div key={h} className="label px-4 py-2">
                  {h}
                </div>
              ))}
            </div>
            {OPS.map((o) => (
              <div key={o.op} className="grid gap-1 border-b border-line px-4 py-5 last:border-0 md:grid-cols-[80px_180px_1fr_140px] md:gap-0 md:px-0">
                <div className="num text-2xl font-semibold text-accent md:px-4">{o.op}</div>
                <div className="display text-lg md:px-4">{o.name}</div>
                <p className="text-[14px] text-ink-2 md:px-4">{o.body}</p>
                <div className="num text-[12px] md:px-4">{o.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead sheet="D" kicker="The drawing set" title="Every module is a sheet. Every sheet talks to the others." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="sheet reg group p-5 transition hover:-translate-y-0.5 hover:border-accent">
              <div className="flex items-center justify-between">
                <span className="num text-3xl font-semibold text-ink-3 group-hover:text-accent">{n.sheet}</span>
                <span className="label">Sheet</span>
              </div>
              <div className="mt-6 text-[15px] font-semibold">{n.label}</div>
              <div className="text-[13px] text-ink-2">{n.hint}</div>
            </Link>
          ))}
          <div className="sheet hatch flex flex-col justify-between p-5">
            <span className="label">Next revision</span>
            <div className="text-[13px] text-ink-2">Quality / NCR, costing & GL, EDI 850/855/810, multi-plant MRP, OPC-UA live telemetry.</div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead sheet="E" kicker="Revision history" title="Rev A was the mainframe. Rev B was client-server. This is Rev C." />
          <div className="sheet reg scroll-thin mt-10 overflow-x-auto">
            <table className="w-full min-w-[680px] text-[14px]">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="label px-5 py-3 text-left" />
                  <th className="label px-5 py-3 text-left">Legacy ERP</th>
                  <th className="label px-5 py-3 text-left !text-accent">Lathe</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold">{k}</td>
                    <td className="px-5 py-3 text-ink-3 line-through decoration-critical/50">{a}</td>
                    <td className="px-5 py-3">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead
          sheet="F"
          kicker="Tolerances"
          title="AI in a factory has to be boring in the right places."
          sub="An ERP is a system of record. We hold the AI to the same tolerances as the rest of the shop."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.map(([t, b], i) => (
            <div key={t} className="flex gap-4 border-t border-line-strong pt-4">
              <span className="num text-[12px] text-accent">±0.0{i + 1}</span>
              <div>
                <div className="font-semibold">{t}</div>
                <p className="mt-1 text-[14px] text-ink-2">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead sheet="G" kicker="Quote" title="Priced per plant. Everyone on the floor gets a seat." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                name: "Pilot",
                price: "$0",
                per: "for 30 days",
                feats: ["Migration sprint from your exports", "One plant, all sheets", "Shadow-run beside the old ERP"],
                cta: "Start a pilot",
              },
              {
                name: "Plant",
                price: "$2,900",
                per: "per plant / month",
                feats: ["Unlimited seats", "Copilot, Ingest & Autopilot", "SSO, audit export, SLAs"],
                cta: "Talk to us",
                featured: true,
              },
              {
                name: "Group",
                price: "Custom",
                per: "multi-plant",
                feats: ["Cross-plant MRP & transfers", "Private model deployment", "Dedicated forward-deployed engineer"],
                cta: "Contact sales",
              },
            ].map((p) => (
              <div key={p.name} className={`sheet reg flex flex-col p-6 ${p.featured ? "border-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="display text-xl">{p.name}</span>
                  {p.featured && <span className="stamp text-accent">Most plants</span>}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="num text-4xl font-semibold">{p.price}</span>
                  <span className="label">{p.per}</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2 text-[14px] text-ink-2">
                  {p.feats.map((f) => (
                    <li key={f}>▸ {f}</li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 inline-flex h-10 items-center justify-center rounded-[3px] font-mono text-[12px] font-semibold tracking-wider uppercase ${p.featured ? "bg-accent text-accent-ink" : "border border-line-strong hover:bg-panel-2"}`}
                >
                  {p.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <LatheMark className="mx-auto size-14 text-ink" />
        <h2 className="display mx-auto mt-6 max-w-3xl text-4xl sm:text-5xl">Walk the floor of a plant that runs on Lathe.</h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-2">Pick a persona, run the agents, approve a PO, feed it an invoice, migrate an SAP export. No signup.</p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-12 items-center rounded-[3px] bg-accent px-6 font-mono text-[13px] font-semibold tracking-wider text-accent-ink uppercase shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] hover:brightness-105"
        >
          Enter the demo plant →
        </Link>
      </section>

      {/* FOOTER TITLE BLOCK */}
      <footer className="border-t border-line-strong">
        <div className="mx-auto grid max-w-7xl grid-cols-2 font-mono text-[11px] sm:grid-cols-6">
          {[
            ["Drawn by", "Lathe"],
            ["Checked", "YC RFS"],
            ["Title", "AI-native ERP"],
            ["Scale", "1 : 1"],
            ["Rev", "C"],
            ["Sheet", "1 of 1"],
          ].map(([k, v]) => (
            <div key={k} className="border-r border-b border-line px-4 py-3 last:border-r-0">
              <div className="label">{k}</div>
              <div className="mt-0.5 text-ink">{v}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto max-w-7xl px-4 py-4 text-[12px] text-ink-3 sm:px-6">© {2026} Lathe. Demo data is fictional. Built with Next.js and Claude.</p>
      </footer>
    </div>
  );
}

function SectionHead({ sheet, kicker, title, sub }: { sheet: string; kicker: string; title: string; sub?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-[120px_1fr]">
      <div>
        <div className="label">Detail</div>
        <div className="num text-4xl font-semibold text-accent">{sheet}</div>
      </div>
      <div>
        <div className="label">{kicker}</div>
        <h2 className="display mt-1 max-w-3xl text-3xl leading-tight sm:text-4xl">{title}</h2>
        {sub && <p className="mt-3 max-w-2xl text-[15px] text-ink-2">{sub}</p>}
      </div>
    </div>
  );
}

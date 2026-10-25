export const NAV = [
  { href: "/app", sheet: "01", label: "Command deck", hint: "KPIs, signals, shift brief" },
  { href: "/app/production", sheet: "02", label: "Production", hint: "Line flow & work orders" },
  { href: "/app/inventory", sheet: "03", label: "Inventory", hint: "Stock positions & cover" },
  { href: "/app/purchasing", sheet: "04", label: "Purchasing", hint: "POs & supplier scorecard" },
  { href: "/app/orders", sheet: "05", label: "Customer orders", hint: "Promise dates & risk" },
  { href: "/app/assets", sheet: "06", label: "Assets", hint: "Machine health & OEE" },
  { href: "/app/autopilot", sheet: "07", label: "Autopilot", hint: "Agent proposals to approve" },
  { href: "/app/copilot", sheet: "08", label: "Copilot", hint: "Ask the plant anything" },
  { href: "/app/ingest", sheet: "09", label: "Ingest", hint: "Invoices, acks, emails → data" },
  { href: "/app/migrate", sheet: "10", label: "Migrate", hint: "Legacy ERP export → Lathe" },
  { href: "/app/ledger", sheet: "11", label: "Ledger", hint: "Append-only audit trail" },
] as const;

export const SHEET_COUNT = NAV.length;

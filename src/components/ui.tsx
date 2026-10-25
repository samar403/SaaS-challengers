import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** A drawing sheet: panel with registration marks and an optional figure label. */
export function Sheet({
  fig,
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  fig?: string;
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("sheet reg rise", className)}>
      {(fig || title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-3">
            {fig && <span className="label shrink-0">{fig}</span>}
            {title && <h2 className="truncate text-[13px] font-semibold tracking-tight">{title}</h2>}
          </div>
          {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
        </header>
      )}
      <div className={cx("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Engineering-drawing title block used as every page header. */
export function TitleBlock({
  sheet,
  title,
  subtitle,
  cells,
  actions,
}: {
  sheet: string;
  title: string;
  subtitle?: ReactNode;
  cells?: { k: string; v: ReactNode }[];
  actions?: ReactNode;
}) {
  return (
    <div className="sheet reg mb-5 grid grid-cols-1 md:grid-cols-[auto_1fr_auto]">
      <div className="flex items-center justify-center border-b border-line px-5 py-4 md:border-r md:border-b-0">
        <div className="text-center">
          <div className="label">Sheet</div>
          <div className="num text-3xl font-bold text-accent">{sheet}</div>
        </div>
      </div>
      <div className="min-w-0 px-5 py-4">
        <h1 className="display text-2xl leading-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {cells && cells.length > 0 && (
        <dl className="grid grid-cols-2 border-t border-line md:grid-cols-1 md:border-t-0 md:border-l">
          {cells.map((c, i) => (
            <div key={c.k} className={cx("min-w-36 px-4 py-2", i > 0 && "border-line md:border-t", i % 2 === 1 && "border-l md:border-l-0")}>
              <dt className="label">{c.k}</dt>
              <dd className="num truncate text-[13px] font-medium">{c.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "accent" | "blue";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-ink-2",
  accent: "text-accent",
  blue: "text-blue",
};
const TONE_BG: Record<Tone, string> = {
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
  neutral: "bg-ink-3",
  accent: "bg-accent",
  blue: "bg-blue",
};
const TONE_ICON: Record<Tone, string> = {
  good: "●",
  warning: "▲",
  serious: "◆",
  critical: "■",
  neutral: "○",
  accent: "◉",
  blue: "◇",
};

/** Status is never color alone: glyph + label + color. */
export function Status({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide uppercase", TONE_TEXT[tone], className)}>
      <span aria-hidden className="text-[9px]">
        {TONE_ICON[tone]}
      </span>
      <span className="text-ink-2">{children}</span>
    </span>
  );
}

export function Stamp({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx("stamp", TONE_TEXT[tone])}>{children}</span>;
}

/** Stat tile with a dimension line under the value. */
export function StatTile({
  label,
  value,
  unit,
  note,
  tone = "neutral",
  fig,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: Tone;
  fig?: string;
}) {
  return (
    <div className="sheet reg rise flex flex-col justify-between gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {fig && <span className="label opacity-60">{fig}</span>}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={cx("num text-[28px] leading-none font-semibold tracking-tight", tone !== "neutral" && TONE_TEXT[tone])}>{value}</span>
          {unit && <span className="num text-xs text-ink-3">{unit}</span>}
        </div>
        <div className="dim mt-2.5" aria-hidden />
        {note && <div className="mt-1.5 text-[12px] text-ink-2">{note}</div>}
      </div>
    </div>
  );
}

/** Ratio against a limit: one track, one fill, label beside. */
export function Meter({ value, tone = "blue", label, className }: { value: number; tone?: Tone; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cx("flex items-center gap-2", className)} title={label}>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cx("absolute inset-y-0 left-0 rounded-full", TONE_BG[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Button({ variant = "ghost", className, ...props }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[3px] px-3 py-1.5 font-mono text-[11.5px] font-semibold tracking-wider uppercase transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)] hover:brightness-105 active:translate-y-px",
        variant === "ghost" && "border border-line-strong text-ink hover:bg-panel-2",
        variant === "danger" && "border border-critical/50 text-critical hover:bg-critical-soft",
        variant === "quiet" && "text-ink-2 hover:bg-panel-2 hover:text-ink",
        className,
      )}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-line-strong bg-panel px-1.5 py-px font-mono text-[10px] text-ink-2">{children}</kbd>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="hatch flex flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="display text-base">{title}</div>
      {children && <div className="max-w-md text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="hatch h-7 animate-pulse rounded-[2px] border border-line" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return (
    <th className={cx("label border-b border-line-strong px-3 py-2 font-medium whitespace-nowrap", right ? "text-right" : "text-left", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, right, mono }: { children?: ReactNode; className?: string; right?: boolean; mono?: boolean }) {
  return <td className={cx("border-b border-line px-3 py-2 align-middle", right && "text-right", mono && "num text-[12.5px]", className)}>{children}</td>;
}

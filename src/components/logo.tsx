/** Lathe mark: a three-jaw chuck seen end-on, drawn as line art. */
export function LatheMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="16" cy="16" r="13" />
      <circle cx="16" cy="16" r="4" className="text-accent" stroke="var(--accent)" />
      {[0, 120, 240].map((a) => (
        <rect key={a} x="14" y="4.5" width="4" height="6.5" rx="0.8" transform={`rotate(${a} 16 16)`} />
      ))}
      <path d="M16 1v3M16 28v3M1 16h3M28 16h3" strokeWidth="1" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LatheMark className="size-7 text-ink" />
      <span className="display text-[19px] leading-none">Lathe</span>
    </span>
  );
}

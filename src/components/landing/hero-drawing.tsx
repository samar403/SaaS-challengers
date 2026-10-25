/**
 * Hero: a part drawing (hydraulic bracket HB-40) that drafts itself, then gets
 * annotated by Lathe — the product's thesis in one picture: the AI reads the
 * physical world's paperwork and ties it to live operations.
 */
const d = (s: number) => ({ animationDelay: `${s}s` });

function Arrow({ x, y, dir }: { x: number; y: number; dir: "l" | "r" | "u" | "d" }) {
  const p = {
    l: `M${x + 7} ${y - 3} L${x} ${y} L${x + 7} ${y + 3}`,
    r: `M${x - 7} ${y - 3} L${x} ${y} L${x - 7} ${y + 3}`,
    u: `M${x - 3} ${y + 7} L${x} ${y} L${x + 3} ${y + 7}`,
    d: `M${x - 3} ${y - 7} L${x} ${y} L${x + 3} ${y - 7}`,
  }[dir];
  return <path d={p} fill="none" />;
}

export function HeroDrawing() {
  return (
    <svg viewBox="0 0 560 440" className="draft h-auto w-full" role="img" aria-label="Technical drawing of bracket HB-40 annotated with live ERP data">
      <g fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round">
        {/* front view */}
        <path pathLength={1} d="M70 60 H130 V250 H310 V310 H70 Z" style={d(0.1)} />
        <path pathLength={1} d="M70 60 H130 V250 H310 V310 H70 Z" transform="translate(6 6)" stroke="var(--line-strong)" strokeWidth="1" style={d(0.3)} />
        {[
          [100, 105],
          [100, 185],
          [250, 280],
        ].map(([cx, cy], i) => (
          <circle key={i} pathLength={1} cx={cx} cy={cy} r="11" style={d(0.9 + i * 0.15)} />
        ))}
        {/* side view */}
        <path pathLength={1} d="M380 250 H520 V310 H380 Z" style={d(0.6)} />
        <path pathLength={1} d="M380 60 H400 V250" style={d(0.7)} />
        <path pathLength={1} d="M380 60 V250" style={d(0.75)} />
        <path pathLength={1} d="M430 268 H470 A12 12 0 0 1 470 292 H430 A12 12 0 0 1 430 268 Z" style={d(1.2)} />
      </g>

      {/* centerlines + projection lines */}
      <g className="late" stroke="var(--blue)" strokeWidth="0.8" strokeDasharray="10 3 2 3" style={d(1.4)}>
        <path d="M100 88 V202 M84 105 H116 M84 185 H116 M250 263 V297 M233 280 H267 M450 258 V302" />
        <path d="M310 250 H372 M310 310 H372" strokeDasharray="3 4" opacity="0.6" />
      </g>

      {/* dimensions */}
      <g className="late" stroke="var(--blue)" strokeWidth="1" fill="var(--blue)" style={d(1.7)}>
        <path d="M70 318 V352 M310 318 V352 M70 344 H310" fill="none" />
        <Arrow x={70} y={344} dir="l" />
        <Arrow x={310} y={344} dir="r" />
        <text x="190" y="338" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" stroke="none">
          240.0
        </text>
        <path d="M62 60 H32 M62 310 H32 M40 60 V310" fill="none" />
        <Arrow x={40} y={60} dir="u" />
        <Arrow x={40} y={310} dir="d" />
        <text x="30" y="190" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" stroke="none" transform="rotate(-90 30 190)">
          250.0
        </text>
        <path d="M528 250 H546 M528 310 H546 M540 250 V310" fill="none" />
        <text x="552" y="284" fontSize="10" fontFamily="var(--font-mono)" stroke="none" transform="rotate(-90 552 284)" textAnchor="middle">
          60
        </text>
      </g>

      {/* Lathe annotations */}
      <g className="late" style={d(2.2)} fontFamily="var(--font-mono)" fontSize="10.5">
        <path d="M111 105 L138 67 H150" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        <circle cx="111" cy="105" r="2.5" fill="var(--accent)" />
        <rect x="150" y="52" width="215" height="30" rx="2" fill="var(--panel)" stroke="var(--accent)" />
        <text x="158" y="64" fill="var(--accent)" fontWeight="700">
          Ø22 THRU ×3
        </text>
        <text x="158" y="76" fill="var(--ink-2)">
          drill on CNC-03 · risk 83%
        </text>
      </g>
      <g className="late" style={d(2.6)} fontFamily="var(--font-mono)" fontSize="10.5">
        <path d="M390 150 L372 117 H365" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        <circle cx="390" cy="150" r="2.5" fill="var(--accent)" />
        <rect x="150" y="96" width="215" height="42" rx="2" fill="var(--panel)" stroke="var(--accent)" />
        <text x="158" y="109" fill="var(--accent)" fontWeight="700">
          MATL A36 PLATE 1/4&quot;
        </text>
        <text x="158" y="121" fill="var(--ink-2)">
          legacy 100-2240 → RM-PLT-250
        </text>
        <text x="158" y="133" fill="var(--warning)">
          ▲ invoice +$7.00/SH vs PO
        </text>
      </g>
      <g className="late" style={d(3)} fontFamily="var(--font-mono)" fontSize="10.5">
        <path d="M200 250 L215 194" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        <circle cx="200" cy="250" r="2.5" fill="var(--accent)" />
        <rect x="150" y="152" width="215" height="42" rx="2" fill="var(--panel)" stroke="var(--accent)" />
        <text x="158" y="165" fill="var(--accent)" fontWeight="700">
          WO-8812 · 48 pcs · MACHINING
        </text>
        <text x="158" y="177" fill="var(--ink-2)">
          forecast Oct 27 · slack +2.4d
        </text>
        <text x="158" y="189" fill="var(--good)">
          ● on time for SO-24182
        </text>
      </g>

      {/* title block */}
      <g className="late" style={d(1.9)} fontFamily="var(--font-mono)">
        <rect x="330" y="372" width="222" height="60" fill="var(--panel)" stroke="var(--ink)" strokeWidth="1.2" />
        <path d="M330 392 H552 M418 372 V432 M490 392 V432" stroke="var(--ink)" strokeWidth="0.8" />
        <text x="338" y="386" fontSize="9" fill="var(--ink-3)">
          PART
        </text>
        <text x="372" y="386" fontSize="11" fontWeight="700" fill="var(--ink)">
          HB-40
        </text>
        <text x="426" y="386" fontSize="9" fill="var(--ink-3)">
          HYD. MTG BRACKET
        </text>
        <text x="338" y="406" fontSize="9" fill="var(--ink-3)">
          MATL
        </text>
        <text x="338" y="422" fontSize="11" fill="var(--ink)">
          A36
        </text>
        <text x="426" y="406" fontSize="9" fill="var(--ink-3)">
          REV
        </text>
        <text x="426" y="422" fontSize="11" fill="var(--ink)">
          C
        </text>
        <text x="498" y="406" fontSize="9" fill="var(--ink-3)">
          DRAWN
        </text>
        <text x="498" y="422" fontSize="11" fill="var(--accent)" fontWeight="700">
          LATHE
        </text>
      </g>
    </svg>
  );
}

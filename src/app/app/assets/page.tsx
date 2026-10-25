import { Suspense } from "react";
import { getSnapshot } from "@/lib/db/queries";
import { assetRisk, STATION_LABEL } from "@/lib/domain/plant";
import { Meter, Sheet, SkeletonRows, Stamp, TitleBlock, type Tone } from "@/components/ui";

export const metadata = { title: "Assets" };

const STATUS: Record<string, Tone> = { running: "good", idle: "neutral", maintenance: "warning", down: "critical" };

export default function AssetsPage() {
  return (
    <>
      <TitleBlock
        sheet="06"
        title="Assets"
        subtitle="Machine health from telemetry and service history. Every risk score shows its working."
        cells={[
          { k: "Vibration std", v: "ISO 10816-3" },
          { k: "Telemetry", v: "OPC-UA · 1 min" },
        ]}
      />
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <Assets />
      </Suspense>
    </>
  );
}

async function Assets() {
  const s = await getSnapshot();
  const risks = s.assets.map(assetRisk).sort((a, b) => b.failureRisk - a.failureRisk);
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {risks.map(({ asset: a, failureRisk, reasons }, i) => {
        const riskTone: Tone = failureRisk > 0.7 ? "critical" : failureRisk > 0.5 ? "serious" : failureRisk > 0.3 ? "warning" : "good";
        return (
          <Sheet key={a.id} fig={`FIG. 06-${String.fromCharCode(65 + i)}`} title={`${a.code} · ${a.name}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="label">{STATION_LABEL[a.station]}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`num text-3xl font-semibold text-${riskTone}`}>{Math.round(failureRisk * 100)}</span>
                  <span className="num text-xs text-ink-3">% failure risk</span>
                </div>
              </div>
              <Stamp tone={STATUS[a.status]}>{a.status}</Stamp>
            </div>
            <dl className="mt-4 grid grid-cols-[84px_1fr_56px] items-center gap-x-2 gap-y-2">
              <dt className="label">Health</dt>
              <Meter value={a.health / 100} tone={a.health < 65 ? "serious" : "good"} label="Health index" />
              <dd className="num text-right text-[12px]">{a.health}</dd>
              <dt className="label">OEE</dt>
              <Meter value={a.oee} tone="blue" label="OEE" />
              <dd className="num text-right text-[12px]">{Math.round(a.oee * 100)}%</dd>
              <dt className="label">Svc / MTBF</dt>
              <Meter
                value={a.hoursSinceService / a.mtbfHours}
                tone={a.hoursSinceService / a.mtbfHours > 0.8 ? "warning" : "blue"}
                label="Hours since service vs MTBF"
              />
              <dd className="num text-right text-[12px]">{Math.round((a.hoursSinceService / a.mtbfHours) * 100)}%</dd>
            </dl>
            <div className="mt-3 grid grid-cols-3 border-t border-line pt-3 text-center">
              <div>
                <div className="label">Vibration</div>
                <div className={`num text-[13px] ${a.vibration > 6 ? "text-critical" : a.vibration > 4 ? "text-warning" : ""}`}>{a.vibration} mm/s</div>
              </div>
              <div>
                <div className="label">Temp</div>
                <div className="num text-[13px]">{a.temperature}°C</div>
              </div>
              <div>
                <div className="label">Run hrs</div>
                <div className="num text-[13px]">{(a.runHours / 1000).toFixed(1)}k</div>
              </div>
            </div>
            {reasons.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] text-ink-2">
                {reasons.map((r) => (
                  <li key={r}>▸ {r}</li>
                ))}
              </ul>
            )}
          </Sheet>
        );
      })}
    </div>
  );
}

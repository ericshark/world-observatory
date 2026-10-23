import { formatEntry, type CatalogEntry } from "../../lib/catalog";
import { heatColor, type HeatScale } from "../../lib/heat-map";
import HudPanel from "./HudPanel";

const BINS = 24;
const SCALE_LABEL = {
  log: "Logarithmic",
  linear: "Linear",
  clipped: "Linear · clipped 5–90th pct",
};

/** How countries spread across the map's color scale: the legend, with a shape. */
export default function SignalDistribution({
  entry,
  scale,
  values,
  years,
  missing,
}: {
  entry: CatalogEntry;
  scale: HeatScale;
  values: number[];
  years: [number, number] | null;
  missing: number;
}) {
  const counts = Array.from({ length: BINS }, () => 0);
  for (const value of values)
    counts[Math.min(BINS - 1, Math.floor(scale.position(value) * BINS))]++;
  const peak = Math.max(1, ...counts);
  const tickLabel = (value: number, index: number) => {
    const label = formatEntry(entry, value);
    if (index === 0 && scale.clippedLow) return `≤${label}`;
    if (index === scale.ticks.length - 1 && scale.clippedHigh)
      return `≥${label}`;
    return label;
  };
  return (
    <HudPanel
      code="03"
      title="Signal distribution"
      tone="cyan"
      order={2}
      className="distribution-panel"
      actions={<span className="hud-meta">{scale.count} countries</span>}
    >
      {scale.count ? (
        <>
          <div
            className="histogram"
            role="img"
            aria-label={`Distribution of ${scale.count} countries across the ${SCALE_LABEL[scale.kind].toLowerCase()} color scale`}
          >
            {counts.map((count, i) => (
              <span
                key={i}
                style={{
                  height: `${count ? Math.max(6, (count / peak) * 100) : 0}%`,
                  background: heatColor((i + 0.5) / BINS),
                }}
                title={`${count} ${count === 1 ? "country" : "countries"}`}
              />
            ))}
          </div>
          <div
            className="heat-bar"
            style={{
              background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(heatColor).join(", ")})`,
            }}
          />
          <div
            className={`heat-ticks ${scale.ticks.length === 1 ? "single" : ""}`}
          >
            {scale.ticks.map((tick, i) => (
              <span key={i}>{tickLabel(tick, i)}</span>
            ))}
          </div>
          <p className="distribution-meta">
            <span>{SCALE_LABEL[scale.kind]} scale</span>
            <span>
              <i className="missing-swatch" aria-hidden="true" /> No current
              data · {missing}
            </span>
            {years && (
              <span>
                Source years{" "}
                {years[0] === years[1] ? years[0] : `${years[0]}–${years[1]}`}
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="empty-note">No current country data for this signal.</p>
      )}
    </HudPanel>
  );
}

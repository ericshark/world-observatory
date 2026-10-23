import {
  CATEGORIES,
  formatEntry,
  type CatalogEntry,
  type Reading,
} from "../../lib/catalog";
import { formatNumber, perSecondFor } from "../../lib/metrics";
import MetricCounter from "../MetricCounter";
import HudPanel from "./HudPanel";
import { MetricIcon } from "./icons";

function provenance(entry: CatalogEntry, reading: Reading | null) {
  if (!reading || reading.year === null) return "No published observation";
  if (reading.historical)
    return `Historical observation, ${reading.year} · no current estimate`;
  const year = `${reading.year}${reading.forecast ? " IMF forecast" : " source year"}`;
  return entry.kind === "live" && entry.counter
    ? `Modelled estimate · ${year}`
    : year;
}

export default function ActiveReadout({
  entry,
  scopeName,
  reading,
  now,
  sourceLabel,
}: {
  entry: CatalogEntry;
  scopeName: string;
  reading: Reading | null;
  now: number;
  sourceLabel: string;
}) {
  const model = reading?.model ?? null;
  const selection = entry.kind === "live" ? entry.selection : null;
  const counting =
    entry.kind === "live" && entry.counter && !!model && !model.historical;
  const currency = selection?.metric === "gdp" || selection?.metric === "debt";
  const perSecond = counting && model ? perSecondFor(model, now) : null;
  const category = CATEGORIES.find((c) => c.id === entry.category)!;
  return (
    <HudPanel
      code="01"
      title="Active signal"
      tone="cyan"
      order={0}
      className={`readout-panel cat-${entry.category}`}
      actions={<span className="hud-meta">{category.code}</span>}
    >
      <div className="readout-scope">
        <span className="nav-icon">
          <MetricIcon id={entry.icon} />
        </span>
        <span>
          <small>{scopeName}</small>
          <strong>{entry.label}</strong>
        </span>
      </div>
      <div className="readout-value" aria-live="off">
        {counting && selection ? (
          <>
            {currency ? "$" : ""}
            <MetricCounter
              key={`${entry.id}-${scopeName}-${selection.period === "today" ? new Date(now).toISOString().slice(0, 10) : new Date(now).getUTCFullYear()}`}
              model={model}
              selection={selection}
            />
          </>
        ) : (
          formatEntry(entry, reading?.value ?? null, false)
        )}
      </div>
      <p className="readout-unit">
        {entry.unit}
        {perSecond !== null && Math.abs(perSecond) > 0 && (
          <span>
            {" "}
            · {perSecond > 0 ? "+" : "−"}
            {formatNumber(
              Math.abs(perSecond),
              false,
              Math.abs(perSecond) < 10 ? 2 : 0,
            )}
            /s
          </span>
        )}
      </p>
      <p className="readout-meta">
        <span>{provenance(entry, reading)}</span>
        <span>{sourceLabel}</span>
      </p>
      <p className="readout-note">{entry.description}</p>
    </HudPanel>
  );
}

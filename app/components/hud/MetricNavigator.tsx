import {
  CATALOG,
  CATEGORIES,
  formatChange,
  formatEntry,
  type CatalogEntry,
  type latestChange,
} from "../../lib/catalog";
import HudPanel from "./HudPanel";
import { MetricIcon } from "./icons";

export interface EntrySummary {
  value: number | null;
  change: ReturnType<typeof latestChange>;
}

export default function MetricNavigator({
  active,
  summaries,
  onPick,
}: {
  active: CatalogEntry;
  /** World value and latest annual change per catalog id. */
  summaries: Map<string, EntrySummary>;
  onPick: (id: string) => void;
}) {
  return (
    <HudPanel
      code="02"
      title="Signal library"
      tone="cyan"
      order={1}
      className="navigator-panel"
      actions={<span className="hud-meta">World · YoY</span>}
    >
      {CATEGORIES.map((category) => (
        <div
          key={category.id}
          className={`nav-group cat-${category.id}`}
          role="group"
          aria-label={category.label}
        >
          <h3>
            <span>{category.code}</span>
            {category.label}
          </h3>
          {CATALOG.filter((entry) => entry.category === category.id).map(
            (entry) => {
              const summary = summaries.get(entry.id);
              const direction = !summary?.change
                ? ""
                : summary.change.change > 0
                  ? "▲"
                  : summary.change.change < 0
                    ? "▼"
                    : "■";
              return (
                <button
                  key={entry.id}
                  className="nav-row"
                  aria-pressed={entry.id === active.id}
                  onClick={() => onPick(entry.id)}
                  title={
                    summary?.change
                      ? `${entry.label}: world change ${summary.change.from}→${summary.change.to}${summary.change.forecast ? " (forecast)" : ""}`
                      : entry.label
                  }
                >
                  <span className="nav-icon">
                    <MetricIcon id={entry.icon} />
                  </span>
                  <span className="nav-text">
                    <strong>{entry.label}</strong>
                    <small>{formatEntry(entry, summary?.value ?? null)}</small>
                  </span>
                  <span className="nav-delta">
                    <span aria-hidden="true">{direction}</span>
                    {formatChange(entry, summary?.change ?? null)}
                    {summary?.change && (
                      <small>
                        {String(summary.change.from).slice(2)}→
                        {String(summary.change.to).slice(2)}
                        {summary.change.forecast ? "f" : ""}
                      </small>
                    )}
                  </span>
                </button>
              );
            },
          )}
        </div>
      ))}
    </HudPanel>
  );
}

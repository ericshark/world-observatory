"use client";

import { useState } from "react";
import {
  formatEntry,
  type CatalogEntry,
  type HistoryPoint,
} from "../../lib/catalog";
import HudPanel from "./HudPanel";

const W = 320;
const H = 112;
const PAD = { top: 12, right: 10, bottom: 18, left: 10 };

export default function TrendPanel({
  entry,
  scopeName,
  points,
}: {
  entry: CatalogEntry;
  scopeName: string;
  points: HistoryPoint[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const usable = points.length >= 2;
  const minYear = usable ? points[0].year : 0;
  const maxYear = usable ? points[points.length - 1].year : 1;
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.abs(high) || 1;
  const lo = low - span * 0.12;
  const hi = high + span * 0.12;
  const x = (year: number) =>
    PAD.left +
    ((year - minYear) / Math.max(1, maxYear - minYear)) *
      (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - (value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  // Consecutive years only: a missing year breaks the line rather than bridging it.
  const segments = points.slice(1).flatMap((point, i) => {
    const previous = points[i];
    return point.year === previous.year + 1 ? [{ previous, point }] : [];
  });
  const area = usable
    ? `M${x(points[0].year)},${H - PAD.bottom} ${points.map((p) => `L${x(p.year)},${y(p.value)}`).join(" ")} L${x(maxYear)},${H - PAD.bottom}Z`
    : "";
  const active = hover === null ? points[points.length - 1] : points[hover];
  return (
    <HudPanel
      code="05"
      title="Trend vector"
      tone="magenta"
      order={1}
      className="trend-panel"
      actions={<span className="hud-meta">{scopeName}</span>}
    >
      {usable ? (
        <>
          <div className="trend-readout">
            <span>
              {active.year}
              {active.forecast ? " · IMF forecast" : ""}
            </span>
            <strong>{formatEntry(entry, active.value)}</strong>
          </div>
          <svg
            key={`${entry.id}-${scopeName}`}
            className="trend-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${entry.label} for ${scopeName}, ${minYear} to ${maxYear}. Dashed segments are IMF forecasts.`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const year =
                minYear +
                (((event.clientX - bounds.left) / bounds.width) * W -
                  PAD.left) /
                  ((W - PAD.left - PAD.right) / Math.max(1, maxYear - minYear));
              let nearest = 0;
              points.forEach((p, i) => {
                if (
                  Math.abs(p.year - year) <
                  Math.abs(points[nearest].year - year)
                )
                  nearest = i;
              });
              setHover(nearest);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0"
                  stopColor="var(--magenta)"
                  stopOpacity="0.35"
                />
                <stop offset="1" stopColor="var(--magenta)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                className="trend-grid"
                x1={PAD.left}
                x2={W - PAD.right}
                y1={PAD.top + (H - PAD.top - PAD.bottom) * f}
                y2={PAD.top + (H - PAD.top - PAD.bottom) * f}
              />
            ))}
            <path d={area} fill="url(#trend-fill)" className="trend-area" />
            {segments.map(({ previous, point }) => (
              <line
                key={point.year}
                className="trend-line"
                x1={x(previous.year)}
                y1={y(previous.value)}
                x2={x(point.year)}
                y2={y(point.value)}
                strokeDasharray={point.forecast ? "4 4" : undefined}
              />
            ))}
            {points.map((p, i) => (
              <circle
                key={p.year}
                className={`trend-dot ${p.forecast ? "is-forecast" : ""}`}
                cx={x(p.year)}
                cy={y(p.value)}
                r={hover === i ? 4.5 : 2.6}
              />
            ))}
            {hover !== null && (
              <line
                className="trend-cursor"
                x1={x(points[hover].year)}
                x2={x(points[hover].year)}
                y1={PAD.top}
                y2={H - PAD.bottom}
              />
            )}
            <text x={PAD.left} y={H - 4} className="trend-axis">
              {minYear}
            </text>
            <text
              x={W - PAD.right}
              y={H - 4}
              className="trend-axis"
              textAnchor="end"
            >
              {maxYear}
            </text>
          </svg>
          <details className="trend-table">
            <summary>Annual data</summary>
            <table>
              <tbody>
                {points.map((p) => (
                  <tr key={p.year}>
                    <th scope="row">{p.year}</th>
                    <td>{formatEntry(entry, p.value, false)}</td>
                    <td>{p.forecast ? "Forecast" : "Published / derived"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="empty-note">
          Not enough annual observations for {scopeName} to draw a trend.
        </p>
      )}
    </HudPanel>
  );
}

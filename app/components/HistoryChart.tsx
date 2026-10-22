"use client";

import { formatNumber, historyFor } from "../lib/metrics";
import type { Entity, MetricSelection } from "../lib/metrics-types";
export const COMPARE_COLORS = ["#4d86d9", "#cd9650", "#b67bb0"];

export default function HistoryChart({
  entities,
  selection,
  forecastFrom,
  now,
  small = false,
}: {
  entities: Entity[];
  selection: MetricSelection;
  forecastFrom: number;
  now: number;
  small?: boolean;
}) {
  const series = entities.map((entity) => ({
    entity,
    points: historyFor(entity, selection, forecastFrom, now),
  }));
  const points = series.flatMap((s) => s.points);
  if (points.length < 2)
    return (
      <p className="empty-note">Not enough annual observations for a trend.</p>
    );
  const minYear = Math.min(...points.map((p) => p.year));
  const maxYear = Math.max(...points.map((p) => p.year));
  const max = Math.max(...points.map((p) => p.value));
  const min = small ? Math.min(...points.map((p) => p.value)) * 0.95 : 0;
  const height = small ? 92 : 160;
  const x = (year: number) =>
    6 + ((year - minYear) / Math.max(1, maxYear - minYear)) * 488;
  const y = (value: number) =>
    height - 12 - ((value - min) / Math.max(1, max - min)) * (height - 26);
  const unit =
    selection.metric === "homicides"
      ? "per 100,000 people"
      : selection.metric === "gdp" || selection.metric === "debt"
        ? "USD"
        : selection.metric === "co2"
          ? "tonnes"
          : "people";
  return (
    <div className="history-chart">
      <svg
        viewBox={`0 0 500 ${height}`}
        role="img"
        aria-label={`Annual ${selection.metric} history, ${minYear} to ${maxYear}, ${unit}. Dashed lines indicate IMF forecasts.`}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2="500"
            y1={height * f}
            y2={height * f}
            stroke="var(--border)"
            strokeDasharray="2 5"
          />
        ))}
        {series.map(({ entity, points }, index) => (
          <g
            key={entity.iso2}
            style={{
              color:
                entities.length === 1 ? "var(--accent)" : COMPARE_COLORS[index],
            }}
          >
            {points.map((point, i) => {
              const previous = points[i - 1];
              return (
                <g key={point.year}>
                  {previous && point.year === previous.year + 1 && (
                    <line
                      x1={x(previous.year)}
                      y1={y(previous.value)}
                      x2={x(point.year)}
                      y2={y(point.value)}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={point.forecast ? "5 4" : undefined}
                    />
                  )}
                  <circle
                    cx={x(point.year)}
                    cy={y(point.value)}
                    r={small ? 2 : 3}
                    fill={point.forecast ? "var(--surface)" : "currentColor"}
                    stroke="currentColor"
                  >
                    <title>{`${entity.name}: ${point.year} · ${formatNumber(point.value)} ${unit}${point.forecast ? " · forecast" : ""}`}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{minYear}</span>
        <span>{unit} · annual observations</span>
        <span>{maxYear}</span>
      </div>
      {!small && (
        <details className="history-table">
          <summary>View annual data</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Year</th>
                  <th>Value ({unit})</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {series.flatMap(({ entity, points }) =>
                  points.map((point) => (
                    <tr key={`${entity.iso2}-${point.year}`}>
                      <td>{entity.name}</td>
                      <td>{point.year}</td>
                      <td>{formatNumber(point.value)}</td>
                      <td>
                        {point.forecast ? "Forecast" : "Reported / derived"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

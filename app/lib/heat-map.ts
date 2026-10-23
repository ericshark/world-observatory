import { measureValue, valueAt } from "./metrics.ts";
import type { MetricModel, MetricSelection } from "./metrics-types.ts";
export type MapMeasure = "total" | "perCapita" | "debtRatio";
export const DEBT_MEASURES: { id: MapMeasure; label: string }[] = [
  { id: "total", label: "Total debt" },
  { id: "perCapita", label: "Debt per person" },
  { id: "debtRatio", label: "Debt / GDP" },
];
export function parseMapMeasure(
  value: string | null,
  metric: string,
): MapMeasure {
  return metric === "debt" && DEBT_MEASURES.some((m) => m.id === value)
    ? (value as MapMeasure)
    : "total";
}
export function mapValue(
  model: MetricModel | null | undefined,
  selection: MetricSelection,
  now: number,
) {
  if (!model || model.historical) return null;
  const value =
    selection.metric === "debt" || selection.measure !== "total"
      ? measureValue(model, selection, now)
      : valueAt(model, selection, now);
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}
/** Inferno-like ramp: lightness rises monotonically from violet to amber. */
export const HEAT_COLORS = [
  "#5a2cc0",
  "#a02cbe",
  "#e02f7e",
  "#ff5a3c",
  "#ff9a2a",
  "#ffd86e",
];
export function mixColor(from: string, to: string, progress: number) {
  const channels = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(from.slice(i, i + 2), 16) * (1 - progress) +
        parseInt(to.slice(i, i + 2), 16) * progress,
    ),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
export function heatColor(position: number) {
  const p = Math.max(0, Math.min(1, position)) * (HEAT_COLORS.length - 1);
  const i = Math.min(HEAT_COLORS.length - 2, Math.floor(p));
  return mixColor(HEAT_COLORS[i], HEAT_COLORS[i + 1], p - i);
}
/**
 * `log` suits totals spanning many orders of magnitude, `linear` suits bounded
 * ratios, and `clipped` is linear between the 2nd and 98th percentiles so a few
 * hyperinflation outliers cannot flatten every other country into one color.
 */
export type HeatScaleKind = "log" | "linear" | "clipped";
const CLIP_QUANTILES = [0.02, 0.98] as const;
function quantile(sorted: number[], q: number) {
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}
export function createHeatScale(
  values: Iterable<number | null>,
  kind: HeatScaleKind = "log",
) {
  const usable = [...values]
    .filter(
      (v): v is number =>
        v !== null && Number.isFinite(v) && (kind !== "log" || v >= 0),
    )
    .sort((a, b) => a - b);
  const min = usable.length ? usable[0] : 0;
  const max = usable.length ? usable[usable.length - 1] : 0;
  const domain =
    kind === "clipped" && usable.length
      ? CLIP_QUANTILES.map((q) => quantile(usable, q))
      : [min, max];
  // Scale the zero-compatible logarithm to the smallest positive observation.
  // Using one dollar as its implicit pivot compresses nearly every economy
  // into the warm end when a valid zero-debt country is present.
  const positive = usable.filter((value) => value > 0);
  const pivot = positive.length ? positive[0] : 1;
  const transform =
    kind === "log" ? (v: number) => Math.log1p(v / pivot) : (v: number) => v;
  const inverse =
    kind === "log" ? (v: number) => Math.expm1(v) * pivot : (v: number) => v;
  const lo = transform(domain[0]),
    hi = transform(domain[1]);
  const position = (value: number) =>
    hi === lo
      ? 0.5
      : Math.max(0, Math.min(1, (transform(value) - lo) / (hi - lo)));
  return {
    min,
    max,
    count: usable.length,
    kind,
    /** Observations beyond the clipped domain share the end colors. */
    clippedLow: domain[0] > min,
    clippedHigh: domain[1] < max,
    position: (value: number) => position(value),
    color: (value: number | null) =>
      value === null || !Number.isFinite(value) || (kind === "log" && value < 0)
        ? null
        : heatColor(position(value)),
    ticks: usable.length
      ? domain[0] === domain[1]
        ? [domain[0]]
        : [0, 0.25, 0.5, 0.75, 1].map((p) => inverse(lo + (hi - lo) * p))
      : [],
  };
}
export type HeatScale = ReturnType<typeof createHeatScale>;
export function mapLabel(selection: MetricSelection) {
  if (selection.metric === "debt")
    return (
      DEBT_MEASURES.find((m) => m.id === selection.measure)?.label ??
      "Total debt"
    );
  if (selection.metric === "population")
    return selection.populationView === "population"
      ? "Estimated population"
      : `${selection.populationView === "births" ? "Births" : "Deaths"} ${selection.period === "today" ? "today" : "this year"}`;
  return selection.metric === "gdp"
    ? "GDP generated this year"
    : "CO₂ emitted this year";
}

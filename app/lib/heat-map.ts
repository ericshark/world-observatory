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
    selection.metric === "debt"
      ? measureValue(model, selection, now)
      : valueAt(model, selection, now);
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}
export const HEAT_COLORS = [
  "#345a85",
  "#3c8b96",
  "#83b5a3",
  "#d4aa63",
  "#c6604f",
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
export function createHeatScale(
  values: Iterable<number | null>,
  linear = false,
) {
  const usable = [...values].filter(
    (v): v is number => v !== null && Number.isFinite(v) && v >= 0,
  );
  const min = usable.length ? Math.min(...usable) : 0;
  const max = usable.length ? Math.max(...usable) : 0;
  // Scale the zero-compatible logarithm to the smallest positive observation.
  // Using one dollar as its implicit pivot compresses nearly every economy
  // into the warm end when a valid zero-debt country is present.
  const positive = usable.filter((value) => value > 0);
  const pivot = positive.length ? Math.min(...positive) : 1;
  const transform = linear
    ? (v: number) => v
    : (v: number) => Math.log1p(v / pivot);
  const inverse = linear
    ? (v: number) => v
    : (v: number) => Math.expm1(v) * pivot;
  const lo = transform(min),
    hi = transform(max);
  const position = (value: number) =>
    hi === lo
      ? 0.5
      : Math.max(0, Math.min(1, (transform(value) - lo) / (hi - lo)));
  return {
    min,
    max,
    count: usable.length,
    kind: linear ? "Linear" : "Logarithmic",
    color: (value: number | null) =>
      value === null || !Number.isFinite(value) || value < 0
        ? null
        : heatColor(position(value)),
    ticks: usable.length
      ? min === max
        ? [min]
        : [0, 0.25, 0.5, 0.75, 1].map((p) => inverse(lo + (hi - lo) * p))
      : [],
  };
}
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

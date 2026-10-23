import type { MetricSelection } from "./metrics-types.ts";
const selection = (
  metric: MetricSelection["metric"],
  populationView: MetricSelection["populationView"] = "population",
): MetricSelection => ({
  metric,
  populationView,
  measure: "total",
  period: populationView === "population" ? "year" : "today",
});
export const COUNTERS = [
  {
    id: "population",
    label: "World population",
    unit: "people",
    period: "right now",
    selection: selection("population"),
  },
  {
    id: "births",
    label: "Births today",
    unit: "people",
    period: "since UTC midnight",
    selection: selection("population", "births"),
  },
  {
    id: "deaths",
    label: "Deaths today",
    unit: "people",
    period: "since UTC midnight",
    selection: selection("population", "deaths"),
  },
  {
    id: "gdp",
    label: "GDP this year",
    unit: "US dollars of output",
    period: "this year",
    selection: selection("gdp"),
  },
  {
    id: "debt",
    label: "Government debt",
    unit: "US dollars outstanding",
    period: "right now",
    selection: selection("debt"),
  },
  {
    id: "co2",
    label: "CO₂ this year",
    unit: "tonnes emitted",
    period: "this year",
    selection: selection("co2"),
  },
];
export function normalizeSelection(value: MetricSelection): MetricSelection {
  if (value.metric === "homicides") return COUNTERS[0].selection;
  return selection(
    value.metric,
    value.metric === "population" ? value.populationView : "population",
  );
}
/** Continuous wheel position. Carry only rolls higher columns near the next integer. */
export function digitPosition(value: number, place: number): number {
  const magnitude = 10 ** place;
  const whole = Math.floor(Math.abs(value));
  const fraction = Math.abs(value) - whole;
  const carry = whole % magnitude === magnitude - 1;
  return (
    (Math.floor(whole / magnitude) % 10) + (place === 0 || carry ? fraction : 0)
  );
}

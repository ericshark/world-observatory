import type {
  Dataset,
  Entity,
  MeasureId,
  MetricId,
  MetricModel,
  MetricSelection,
  PopulationView,
  SeriesId,
} from "./metrics-types.ts";

export const METRICS: {
  id: MetricId;
  label: string;
  short: string;
  eyebrow: string;
  color: string;
  description: string;
}[] = [
  {
    id: "population",
    label: "Population",
    short: "01",
    eyebrow: "The human story",
    color: "#319b79",
    description: "Eight billion lives. One shared planet.",
  },
  {
    id: "gdp",
    label: "GDP",
    short: "02",
    eyebrow: "The world's output",
    color: "#5e83dc",
    description: "The value we create, every passing second.",
  },
  {
    id: "debt",
    label: "National debt",
    short: "03",
    eyebrow: "The balance we carry",
    color: "#ce9250",
    description: "Public obligations, seen in a global context.",
  },
  {
    id: "homicides",
    label: "Homicides",
    short: "04",
    eyebrow: "A measure of safety",
    color: "#c26f80",
    description: "Understanding violence through reported data.",
  },
  {
    id: "co2",
    label: "CO₂ emissions",
    short: "05",
    eyebrow: "Our atmospheric footprint",
    color: "#8c82c4",
    description: "The emissions adding up around us.",
  },
];
export const DEFAULT_SELECTION: MetricSelection = {
  metric: "population",
  populationView: "population",
  measure: "total",
  period: "year",
};
export function measuresFor(
  metric: MetricId,
  view: PopulationView,
): { id: MeasureId; label: string }[] {
  if (metric === "population")
    return [
      {
        id: "total",
        label: view === "population" ? "Population" : "Annual count",
      },
      {
        id: "rate",
        label: view === "population" ? "Growth rate" : "Per 1,000 people",
      },
    ];
  if (metric === "homicides")
    return [
      { id: "rate", label: "Per 100,000 people" },
      { id: "total", label: "Est. annual count" },
    ];
  if (metric === "debt")
    return [
      { id: "total", label: "Total debt" },
      { id: "perCapita", label: "Per person" },
      { id: "debtRatio", label: "% of GDP" },
    ];
  return [
    {
      id: "total",
      label: metric === "gdp" ? "Annual GDP" : "Annual emissions",
    },
    { id: "perCapita", label: "Per person" },
  ];
}
export function selectionForMetric(metric: MetricId): MetricSelection {
  return {
    ...DEFAULT_SELECTION,
    metric,
    measure: metric === "homicides" ? "rate" : "total",
  };
}
export function atYear(
  entity: Entity,
  key: SeriesId,
  year: number,
): number | null {
  return entity.series[key]?.find((o) => o.year === year)?.value ?? null;
}
export function latestYear(
  entity: Entity,
  keys: SeriesId[],
  ceiling: number,
): number | null {
  const candidates = (entity.series[keys[0]] ?? [])
    .filter((o) => o.year <= ceiling)
    .map((o) => o.year)
    .sort((a, b) => b - a);
  return (
    candidates.find((year) =>
      keys.every((key) => atYear(entity, key, year) !== null),
    ) ?? null
  );
}
export function utcYear(time: number) {
  const year = new Date(time).getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return { year, start, end, duration: end - start };
}
export function utcDay(time: number) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Annual source values remain separate from their projected display values. */
export function modelFor(
  entity: Entity,
  selection: MetricSelection,
  now: number,
  forecastFrom: number,
): MetricModel | null {
  const { metric, populationView } = selection;
  const { year: currentYear } = utcYear(now);
  const base = {
    forecast: false,
    historical: false,
    population: null as number | null,
    populationYear: null as number | null,
    rate: null as number | null,
    normalized: null as number | null,
    normalizedUnit: "",
  };
  if (metric === "population") {
    const keys: SeriesId[] = ["population", "birthRate", "deathRate"];
    if (entity.iso3 !== "WLD") keys.push("migration");
    const year = latestYear(entity, keys, currentYear);
    if (year === null) return null;
    const population = atYear(entity, "population", year)!;
    const births = (population * atYear(entity, "birthRate", year)!) / 1000;
    const deaths = (population * atYear(entity, "deathRate", year)!) / 1000;
    const net =
      births -
      deaths +
      (entity.iso3 === "WLD" ? 0 : atYear(entity, "migration", year)!);
    if (populationView === "population")
      return {
        ...base,
        year,
        annual: net,
        start: population,
        end: population + net,
        kind: "stock",
        population,
        populationYear: year,
        rate: population > 0 ? (net / population) * 100 : null,
        normalized: population > 0 ? (net / population) * 100 : null,
        normalizedUnit: "% / year",
      };
    const annual = populationView === "births" ? births : deaths;
    return {
      ...base,
      year,
      annual,
      start: 0,
      end: annual,
      kind: "flow",
      population,
      populationYear: year,
      rate: population > 0 ? (annual / population) * 1000 : null,
      normalized: population > 0 ? (annual / population) * 1000 : null,
      normalizedUnit: "/ 1,000",
    };
  }
  if (metric === "gdp" || metric === "debt") {
    const year = latestYear(
      entity,
      metric === "debt" ? ["gdp", "debtRatio"] : ["gdp"],
      currentYear,
    );
    if (year === null) return null;
    const gdp = atYear(entity, "gdp", year)!;
    const popYear = latestYear(entity, ["population"], year);
    const population =
      popYear === null ? null : atYear(entity, "population", popYear);
    if (metric === "gdp")
      return {
        ...base,
        year,
        annual: gdp,
        start: 0,
        end: gdp,
        kind: "flow",
        population,
        populationYear: popYear,
        normalized: population ? gdp / population : null,
        normalizedUnit: "USD / person",
        forecast: year >= forecastFrom,
      };
    const end = (gdp * atYear(entity, "debtRatio", year)!) / 100;
    const previousGdp = atYear(entity, "gdp", year - 1);
    const previousRatio = atYear(entity, "debtRatio", year - 1);
    // Without matching consecutive balances, show the latest balance as historical, not a fabricated slope.
    const start =
      previousGdp !== null && previousRatio !== null
        ? (previousGdp * previousRatio) / 100
        : end;
    return {
      ...base,
      year,
      annual: end - start,
      start,
      end,
      kind: "stock",
      population,
      populationYear: popYear,
      rate: atYear(entity, "debtRatio", year),
      normalized: population ? end / population : null,
      normalizedUnit: "USD / person",
      forecast: year >= forecastFrom,
      historical:
        year < currentYear || previousGdp === null || previousRatio === null,
    };
  }
  const keys: SeriesId[] =
    metric === "homicides" ? ["homicideRate", "population"] : ["co2"];
  const year = latestYear(entity, keys, currentYear);
  if (year === null) return null;
  const populationYear =
    metric === "homicides" ? year : latestYear(entity, ["population"], year);
  const population =
    populationYear === null
      ? null
      : atYear(entity, "population", populationYear);
  const rate =
    metric === "homicides" ? atYear(entity, "homicideRate", year)! : null;
  const annual =
    metric === "homicides"
      ? (rate! * population!) / 100_000
      : atYear(entity, "co2", year)!;
  return {
    ...base,
    year,
    annual,
    start: 0,
    end: annual,
    kind: "flow",
    population,
    populationYear,
    rate,
    normalized:
      metric === "homicides" ? rate : population ? annual / population : null,
    normalizedUnit: metric === "homicides" ? "/ 100,000" : "t / person",
    historical: metric === "homicides" && currentYear - year > 5,
  };
}

export function valueAt(
  model: MetricModel,
  selection: MetricSelection,
  now: number,
): number {
  const current = utcYear(now);
  if (model.kind === "flow") {
    if (model.historical) return model.annual;
    const from =
      selection.metric === "population" && selection.period === "today"
        ? utcDay(now)
        : current.start;
    return (model.annual * (now - from)) / current.duration;
  }
  if (selection.metric === "population") {
    const anchor = Date.UTC(model.year, 6, 1);
    // Integrate across actual calendar years so leap years do not introduce discontinuities.
    let cursor = anchor;
    let fraction = 0;
    if (now >= anchor) {
      while (cursor < now) {
        const period = utcYear(cursor);
        const until = Math.min(now, period.end);
        fraction += (until - cursor) / period.duration;
        cursor = until;
      }
    } else {
      while (cursor > now) {
        const period = utcYear(cursor - 1);
        const from = Math.max(now, period.start);
        fraction -= (cursor - from) / period.duration;
        cursor = from;
      }
    }
    return Math.max(0, model.start + model.annual * fraction);
  }
  if (model.historical) return model.end;
  return (
    model.start +
    ((model.end - model.start) * (now - current.start)) / current.duration
  );
}
export function perSecondFor(model: MetricModel, now: number) {
  return model.historical ? 0 : model.annual / (utcYear(now).duration / 1000);
}
export function measureValue(
  model: MetricModel,
  selection: MetricSelection,
  now: number,
): number | null {
  if (selection.measure === "rate") return model.rate;
  if (selection.measure === "debtRatio") return model.rate;
  if (selection.measure === "perCapita") {
    if (!model.population) return null;
    return (
      (selection.metric === "debt"
        ? valueAt(model, selection, now)
        : model.annual) / model.population
    );
  }
  if (
    selection.metric === "population" &&
    selection.populationView === "population"
  )
    return valueAt(model, selection, now);
  return selection.metric === "debt"
    ? valueAt(model, selection, now)
    : model.annual;
}
export function measureUnit(selection: MetricSelection): string {
  if (
    selection.measure === "debtRatio" ||
    (selection.metric === "population" &&
      selection.populationView === "population" &&
      selection.measure === "rate")
  )
    return "%";
  if (selection.measure === "rate")
    return selection.metric === "homicides" ? "/ 100k" : "/ 1k";
  if (selection.metric === "gdp" || selection.metric === "debt")
    return selection.measure === "perCapita" ? "USD / person" : "USD";
  if (selection.metric === "co2")
    return selection.measure === "perCapita" ? "t / person" : "tonnes";
  return "people";
}
export function formatNumber(
  value: number | null,
  compact = false,
  decimals = 0,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : decimals,
    minimumFractionDigits: compact ? 0 : decimals,
  }).format(decimals === 0 && !compact ? Math.floor(value) : value);
}
export function formatMeasure(
  value: number | null,
  selection: MetricSelection,
  compact = true,
): string {
  const currency = selection.metric === "gdp" || selection.metric === "debt";
  const rate =
    selection.measure === "rate" || selection.measure === "debtRatio";
  return `${currency && !rate && value !== null ? "$" : ""}${formatNumber(value, compact && !rate, rate ? 2 : 0)}${rate && measureUnit(selection) === "%" && value !== null ? "%" : ""}`;
}
export function counterLabel(selection: MetricSelection) {
  if (selection.metric === "population")
    return selection.populationView === "population"
      ? "Estimated population"
      : `Estimated ${selection.populationView} ${selection.period === "today" ? "today" : "this year"}`;
  return {
    gdp: "GDP generated this year",
    debt: "Outstanding government debt",
    homicides: "Estimated homicides this year",
    co2: "CO₂ emitted this year",
  }[selection.metric];
}
export function historyFor(
  entity: Entity,
  selection: MetricSelection,
  forecastFrom: number,
  now: number,
) {
  const endYear = new Date(now).getUTCFullYear();
  const result: { year: number; value: number; forecast: boolean }[] = [];
  for (let year = endYear - 9; year <= endYear; year++) {
    let value: number | null = null;
    if (selection.metric === "population") {
      if (selection.populationView === "population")
        value = atYear(entity, "population", year);
      else {
        const population = atYear(entity, "population", year);
        const rate = atYear(
          entity,
          selection.populationView === "births" ? "birthRate" : "deathRate",
          year,
        );
        if (population !== null && rate !== null)
          value = (population * rate) / 1000;
      }
    } else if (selection.metric === "gdp") value = atYear(entity, "gdp", year);
    else if (selection.metric === "debt") {
      const gdp = atYear(entity, "gdp", year);
      const ratio = atYear(entity, "debtRatio", year);
      if (gdp !== null && ratio !== null) value = (gdp * ratio) / 100;
    } else if (selection.metric === "homicides")
      value = atYear(entity, "homicideRate", year);
    else value = atYear(entity, "co2", year);
    if (value !== null)
      result.push({
        year,
        value,
        forecast:
          (selection.metric === "gdp" || selection.metric === "debt") &&
          year >= forecastFrom,
      });
  }
  return result;
}
export function blendRevision(
  previous: number,
  target: number,
  progress: number,
): number {
  const p = Math.max(0, Math.min(1, progress));
  return previous + (target - previous) * (1 - (1 - p) ** 3);
}
export function parseSelection(query: URLSearchParams, data: Dataset) {
  const metric =
    METRICS.find((m) => m.id === query.get("metric"))?.id ?? "population";
  const populationView =
    (["population", "births", "deaths"] as const).find(
      (v) => v === query.get("view"),
    ) ?? "population";
  const measure =
    measuresFor(metric, populationView).find(
      (m) => m.id === query.get("measure"),
    )?.id ?? (metric === "homicides" ? "rate" : "total");
  const ids = new Set(data.countries.map((c) => c.iso2));
  const country = query.get("country");
  return {
    selection: {
      metric,
      populationView,
      measure,
      period:
        query.get("period") === "today"
          ? ("today" as const)
          : ("year" as const),
    },
    country: country && ids.has(country) ? country : null,
    compare: [...new Set((query.get("compare") ?? "").split(","))]
      .filter((id) => ids.has(id))
      .slice(0, 3),
  };
}

export function normalizedValue(
  model: MetricModel,
  selection: MetricSelection,
  now: number,
): number | null {
  return selection.metric === "debt" && model.population
    ? valueAt(model, selection, now) / model.population
    : model.normalized;
}

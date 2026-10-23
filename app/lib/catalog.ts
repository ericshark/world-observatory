import {
  atYear,
  formatMeasure,
  historyFor,
  modelFor,
  utcYear,
} from "./metrics.ts";
import { mapValue, type HeatScaleKind } from "./heat-map.ts";
import type {
  Entity,
  MetricModel,
  MetricSelection,
  SeriesId,
} from "./metrics-types.ts";

export type CategoryId = "demographics" | "economy" | "fiscal" | "environment";
export const CATEGORIES: { id: CategoryId; label: string; code: string }[] = [
  { id: "demographics", label: "Demographics", code: "DMG" },
  { id: "economy", label: "Economy", code: "ECN" },
  { id: "fiscal", label: "Public finance", code: "FSC" },
  { id: "environment", label: "Environment", code: "ENV" },
];
export type IconId =
  | "people"
  | "cradle"
  | "candle"
  | "heart"
  | "city"
  | "output"
  | "person-coin"
  | "prices"
  | "jobs"
  | "ledger"
  | "person-ledger"
  | "gauge"
  | "smoke";

interface BaseEntry {
  id: string;
  category: CategoryId;
  label: string;
  /** Short name for HUD rows and tooltips. */
  short: string;
  icon: IconId;
  unit: string;
  source: "worldbank" | "imf" | "both";
  scale: HeatScaleKind;
  description: string;
  /** Country values sum to a meaningful world total. */
  additive: boolean;
  /** Year-over-year change reads as a relative % or in percentage points. */
  delta: "percent" | "points";
}
/** Resolves through the continuously estimated models in metrics.ts. */
export interface LiveEntry extends BaseEntry {
  kind: "live";
  selection: MetricSelection;
  /** Shows a rolling counter rather than a static readout. */
  counter: boolean;
}
/** Latest published annual observation of a single series. */
export interface LevelEntry extends BaseEntry {
  kind: "level";
  series: SeriesId;
  decimals: number;
  suffix: string;
}
export type CatalogEntry = LiveEntry | LevelEntry;

const live = (
  metric: MetricSelection["metric"],
  options: Partial<MetricSelection> = {},
): MetricSelection => ({
  metric,
  populationView: "population",
  measure: "total",
  period: "year",
  ...options,
});

export const CATALOG: CatalogEntry[] = [
  {
    id: "population",
    kind: "live",
    category: "demographics",
    label: "Population",
    short: "Population",
    icon: "people",
    unit: "people",
    source: "worldbank",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("population"),
    description:
      "Estimated residents now, projected from the latest population, birth, death and net-migration rates.",
  },
  {
    id: "births",
    kind: "live",
    category: "demographics",
    label: "Births today",
    short: "Births",
    icon: "cradle",
    unit: "births since UTC midnight",
    source: "worldbank",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("population", {
      populationView: "births",
      period: "today",
    }),
    description:
      "Annual births from the crude birth rate, spread evenly across the UTC day.",
  },
  {
    id: "deaths",
    kind: "live",
    category: "demographics",
    label: "Deaths today",
    short: "Deaths",
    icon: "candle",
    unit: "deaths since UTC midnight",
    source: "worldbank",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("population", {
      populationView: "deaths",
      period: "today",
    }),
    description:
      "Annual deaths from the crude death rate, spread evenly across the UTC day.",
  },
  {
    id: "life-expectancy",
    kind: "level",
    category: "demographics",
    label: "Life expectancy",
    short: "Life exp.",
    icon: "heart",
    unit: "years at birth",
    source: "worldbank",
    scale: "linear",
    additive: false,
    delta: "points",
    series: "lifeExpectancy",
    decimals: 1,
    suffix: " yrs",
    description:
      "Years a newborn would live if current mortality patterns stayed the same (SP.DYN.LE00.IN).",
  },
  {
    id: "urbanization",
    kind: "level",
    category: "demographics",
    label: "Urban population",
    short: "Urban",
    icon: "city",
    unit: "% of population",
    source: "worldbank",
    scale: "linear",
    additive: false,
    delta: "points",
    series: "urbanization",
    decimals: 1,
    suffix: "%",
    description:
      "Share of people living in areas defined as urban by national statistical offices (SP.URB.TOTL.IN.ZS).",
  },
  {
    id: "gdp",
    kind: "live",
    category: "economy",
    label: "GDP this year",
    short: "GDP",
    icon: "output",
    unit: "USD of output",
    source: "imf",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("gdp"),
    description:
      "Output generated so far this year, from IMF annual GDP in current US dollars spread over the calendar year.",
  },
  {
    id: "gdp-per-capita",
    kind: "live",
    category: "economy",
    label: "GDP per person",
    short: "GDP / person",
    icon: "person-coin",
    unit: "USD / person / year",
    source: "both",
    scale: "log",
    additive: false,
    delta: "percent",
    counter: false,
    selection: live("gdp", { measure: "perCapita" }),
    description:
      "IMF annual GDP divided by the latest World Bank population at or before the GDP year.",
  },
  {
    id: "inflation",
    kind: "level",
    category: "economy",
    label: "Inflation",
    short: "Inflation",
    icon: "prices",
    unit: "% consumer price change",
    source: "worldbank",
    scale: "clipped",
    additive: false,
    delta: "points",
    series: "inflation",
    decimals: 1,
    suffix: "%",
    description:
      "Annual change in consumer prices (FP.CPI.TOTL.ZG). Colors clip at the 5th and 90th percentiles.",
  },
  {
    id: "unemployment",
    kind: "level",
    category: "economy",
    label: "Unemployment",
    short: "Unemployment",
    icon: "jobs",
    unit: "% of labor force",
    source: "worldbank",
    scale: "linear",
    additive: false,
    delta: "points",
    series: "unemployment",
    decimals: 1,
    suffix: "%",
    description:
      "Share of the labor force without work but available and seeking it; ILO modelled estimate (SL.UEM.TOTL.ZS).",
  },
  {
    id: "debt",
    kind: "live",
    category: "fiscal",
    label: "Government debt",
    short: "Gov. debt",
    icon: "ledger",
    unit: "USD outstanding",
    source: "imf",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("debt"),
    description:
      "General-government gross debt, interpolated between consecutive year-end balances. A modelled estimate, not a real-time measurement.",
  },
  {
    id: "debt-per-person",
    kind: "live",
    category: "fiscal",
    label: "Debt per person",
    short: "Debt / person",
    icon: "person-ledger",
    unit: "USD / person",
    source: "both",
    scale: "log",
    additive: false,
    delta: "percent",
    counter: false,
    selection: live("debt", { measure: "perCapita" }),
    description:
      "Interpolated gross debt divided by the latest population at or before the debt source year.",
  },
  {
    id: "debt-to-gdp",
    kind: "live",
    category: "fiscal",
    label: "Debt-to-GDP",
    short: "Debt / GDP",
    icon: "gauge",
    unit: "% of GDP",
    source: "imf",
    scale: "linear",
    additive: false,
    delta: "points",
    counter: false,
    selection: live("debt", { measure: "debtRatio" }),
    description:
      "General-government gross debt as a percentage of GDP, as published for the source year (GGXWDG_NGDP).",
  },
  {
    id: "co2",
    kind: "live",
    category: "environment",
    label: "CO₂ this year",
    short: "CO₂",
    icon: "smoke",
    unit: "tonnes emitted",
    source: "worldbank",
    scale: "log",
    additive: true,
    delta: "percent",
    counter: true,
    selection: live("co2"),
    description:
      "Fossil CO₂ emissions excluding land use, spread evenly over the calendar year (EN.GHG.CO2.MT.CE.AR5).",
  },
];
export const DEFAULT_ENTRY = CATALOG[0];
const byId = new Map(CATALOG.map((entry) => [entry.id, entry]));
export function entryById(id: string | null | undefined): CatalogEntry {
  return (id && byId.get(id)) || DEFAULT_ENTRY;
}

/** Older links used metric/view/mapMeasure parameters. */
export function entryFromQuery(query: URLSearchParams): CatalogEntry {
  const metric = query.get("metric");
  if (metric === "population") {
    const view = query.get("view");
    return entryById(view === "births" || view === "deaths" ? view : null);
  }
  if (metric === "debt") {
    const measure = query.get("mapMeasure") ?? query.get("measure");
    return entryById(
      measure === "perCapita"
        ? "debt-per-person"
        : measure === "debtRatio"
          ? "debt-to-gdp"
          : "debt",
    );
  }
  if (metric === "gdp" && query.get("measure") === "perCapita")
    return entryById("gdp-per-capita");
  return entryById(metric);
}

/** One entity's value for an entry, with the provenance needed to label it. */
export interface Reading {
  value: number | null;
  year: number | null;
  forecast: boolean;
  /** Older than the current-estimate window; shown for context but not mapped. */
  historical: boolean;
  populationYear: number | null;
  model: MetricModel | null;
}
const HISTORICAL_AFTER_YEARS = 5;

export function modelForEntry(
  entry: CatalogEntry,
  entity: Entity,
  day: number,
  forecastFrom: number,
): MetricModel | null {
  return entry.kind === "live"
    ? modelFor(entity, entry.selection, day, forecastFrom)
    : null;
}

export function readEntry(
  entry: CatalogEntry,
  entity: Entity,
  model: MetricModel | null,
  now: number,
): Reading {
  if (entry.kind === "live") {
    if (!model)
      return {
        value: null,
        year: null,
        forecast: false,
        historical: false,
        populationYear: null,
        model,
      };
    return {
      value: mapValue(model, entry.selection, now),
      year: model.year,
      forecast: model.forecast,
      historical: model.historical,
      populationYear: model.populationYear,
      model,
    };
  }
  const currentYear = utcYear(now).year;
  const latest = (entity.series[entry.series] ?? [])
    .filter((o) => o.year <= currentYear)
    .reduce<{ year: number; value: number } | null>(
      (best, o) => (!best || o.year > best.year ? o : best),
      null,
    );
  const historical =
    !!latest && currentYear - latest.year > HISTORICAL_AFTER_YEARS;
  return {
    value: latest && !historical ? latest.value : null,
    year: latest?.year ?? null,
    forecast: false,
    historical,
    populationYear: null,
    model: null,
  };
}

export interface HistoryPoint {
  year: number;
  value: number;
  forecast: boolean;
}
export function entryHistory(
  entry: CatalogEntry,
  entity: Entity,
  forecastFrom: number,
  now: number,
): HistoryPoint[] {
  const endYear = utcYear(now).year;
  const years = Array.from({ length: 10 }, (_, i) => endYear - 9 + i);
  const points = (value: (year: number) => number | null, imf: boolean) =>
    years.flatMap((year) => {
      const v = value(year);
      return v === null
        ? []
        : [{ year, value: v, forecast: imf && year >= forecastFrom }];
    });
  if (entry.kind === "level")
    return points((year) => atYear(entity, entry.series, year), false);
  const { metric, measure } = entry.selection;
  const populationAt = (year: number) => {
    const observations = (entity.series.population ?? []).filter(
      (o) => o.year <= year,
    );
    return observations.length
      ? observations.reduce((a, b) => (a.year > b.year ? a : b)).value
      : null;
  };
  const debtAt = (year: number) => {
    const gdp = atYear(entity, "gdp", year);
    const ratio = atYear(entity, "debtRatio", year);
    return gdp !== null && ratio !== null ? (gdp * ratio) / 100 : null;
  };
  if (metric === "debt" && measure === "debtRatio")
    return points((year) => atYear(entity, "debtRatio", year), true);
  if (measure === "perCapita") {
    const total =
      metric === "debt"
        ? debtAt
        : (year: number) => atYear(entity, "gdp", year);
    return points((year) => {
      const value = total(year);
      const population = populationAt(year);
      return value !== null && population ? value / population : null;
    }, true);
  }
  return historyFor(entity, entry.selection, forecastFrom, now);
}

/** Change between the two most recent annual observations. */
export function latestChange(history: HistoryPoint[], entry: CatalogEntry) {
  if (history.length < 2) return null;
  const [previous, latest] = history.slice(-2);
  if (latest.year !== previous.year + 1) return null;
  const change =
    entry.delta === "points"
      ? latest.value - previous.value
      : previous.value === 0
        ? null
        : ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
  return change === null
    ? null
    : {
        change,
        from: previous.year,
        to: latest.year,
        forecast: latest.forecast,
      };
}

export function formatEntry(
  entry: CatalogEntry,
  value: number | null,
  compact = true,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (entry.kind === "live")
    return formatMeasure(value, entry.selection, compact);
  return `${value.toFixed(entry.decimals)}${entry.suffix}`;
}

export function formatChange(
  entry: CatalogEntry,
  change: ReturnType<typeof latestChange>,
) {
  if (!change) return "—";
  const sign = change.change > 0 ? "+" : change.change < 0 ? "−" : "±";
  const magnitude = Math.abs(change.change);
  return `${sign}${magnitude.toFixed(magnitude < 10 ? 2 : 1)}${entry.delta === "points" ? " pp" : "%"}`;
}

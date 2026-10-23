export type MetricId = "population" | "gdp" | "debt" | "homicides" | "co2";
export type PopulationView = "population" | "births" | "deaths";
export type MeasureId = "total" | "rate" | "perCapita" | "debtRatio";
export type Period = "today" | "year";
export type SeriesId =
  | "population"
  | "birthRate"
  | "deathRate"
  | "migration"
  | "gdp"
  | "debtRatio"
  | "homicideRate"
  | "co2"
  | "lifeExpectancy"
  | "urbanization"
  | "inflation"
  | "unemployment";
export interface Observation {
  year: number;
  value: number;
}
export interface Entity {
  iso2: string;
  iso3: string;
  name: string;
  region: string;
  coordinates: [number, number] | null;
  series: Partial<Record<SeriesId, Observation[]>>;
}
export interface DataSource {
  label: string;
  url: string;
  updatedAt: string;
}
export interface Dataset {
  schemaVersion: 1;
  fetchedAt: string;
  forecastFrom: number;
  sources: { worldbank: DataSource; imf: DataSource };
  countries: Entity[];
  world: Entity;
}
export interface MetricSelection {
  metric: MetricId;
  populationView: PopulationView;
  measure: MeasureId;
  period: Period;
}
export interface MetricModel {
  year: number;
  annual: number;
  start: number;
  end: number;
  kind: "stock" | "flow";
  forecast: boolean;
  historical: boolean;
  population: number | null;
  populationYear: number | null;
  rate: number | null;
  normalized: number | null;
  normalizedUnit: string;
}
export interface MetricsResponse {
  dataset: Dataset;
  status: "fresh" | "cached" | "snapshot";
  refreshFailed: boolean;
}

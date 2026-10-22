import { WORLD, type Country } from "../data/countries";

/** WPP population estimates are mid-year figures, so 1 Jul 2025 is the reference instant. */
export const REFERENCE_TIME = Date.UTC(2025, 6, 1);
export const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;

export interface Flows {
  population2025: number;
  birthsPerYear: number;
  deathsPerYear: number;
  netMigrationPerYear?: number;
}

export const world: Flows = WORLD;

export function netChangePerYear(flows: Flows): number {
  return (
    flows.birthsPerYear - flows.deathsPerYear + (flows.netMigrationPerYear ?? 0)
  );
}

export function perSecond(perYear: number): number {
  return perYear / (YEAR_MS / 1000);
}

/**
 * Linear extrapolation from the reference estimate. Annual growth rates are
 * below 4% everywhere, so within a couple of years of the reference this stays
 * within a fraction of a percent of compound growth, and it keeps births,
 * deaths and population exactly consistent with each other.
 */
export function populationAt(flows: Flows, time: number): number {
  return (
    flows.population2025 +
    (netChangePerYear(flows) * (time - REFERENCE_TIME)) / YEAR_MS
  );
}

/** Number of events of a yearly rate that fall between two instants. */
export function countBetween(
  perYear: number,
  from: number,
  to: number,
): number {
  return (perYear * (to - from)) / YEAR_MS;
}

export function growthRatePercent(flows: Flows): number {
  return (netChangePerYear(flows) / flows.population2025) * 100;
}

export function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfLocalYear(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), 0, 1).getTime();
}

export function isHighlighted(country: Country): boolean {
  return country.seriesSlot !== undefined;
}

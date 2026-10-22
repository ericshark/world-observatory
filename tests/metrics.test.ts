import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SELECTION,
  atYear,
  blendRevision,
  historyFor,
  measureValue,
  modelFor,
  normalizedValue,
  parseSelection,
  selectionForMetric,
  utcYear,
  valueAt,
} from "../app/lib/metrics.ts";
import type {
  Dataset,
  Entity,
  MetricSelection,
} from "../app/lib/metrics-types.ts";
import { readFileSync } from "node:fs";

const entity = (series: Entity["series"]): Entity => ({
  iso2: "XX",
  iso3: "XXX",
  name: "Example",
  region: "Example",
  coordinates: [0, 0],
  series,
});
const now = Date.UTC(2024, 6, 2);
const population = entity({
  population: [
    { year: 2023, value: 100_000 },
    { year: 2024, value: 102_000 },
  ],
  birthRate: [{ year: 2023, value: 20 }],
  deathRate: [{ year: 2023, value: 10 }],
  migration: [{ year: 2023, value: -100 }],
});
const snapshot = JSON.parse(
  readFileSync(
    new URL("../app/data/metrics-snapshot.json", import.meta.url),
    "utf8",
  ),
) as Dataset;

test("demographic inputs join on their latest common year, including annual migration", () => {
  const model = modelFor(population, DEFAULT_SELECTION, now, 2024)!;
  assert.equal(model.year, 2023);
  assert.equal(model.annual, 900);
  assert.equal(model.start, 100_000);
  assert.ok(Math.abs(model.rate! - 0.9) < 1e-10);
});
test("zero is valid while missing values stay unavailable", () => {
  const zero = entity({ gdp: [{ year: 2024, value: 0 }] });
  assert.equal(modelFor(zero, selectionForMetric("gdp"), now, 2024)?.annual, 0);
  assert.equal(modelFor(entity({}), DEFAULT_SELECTION, now, 2024), null);
  assert.equal(atYear(population, "population", 2022), null);
});
test("annual flows use actual UTC year length, reset at UTC boundaries, and display integers separately", () => {
  const e = entity({ gdp: [{ year: 2024, value: 366_000 }] });
  const selection = selectionForMetric("gdp");
  const model = modelFor(e, selection, now, 2024)!;
  assert.equal(utcYear(now).duration, 366 * 86_400_000);
  assert.equal(valueAt(model, selection, Date.UTC(2024, 0, 2)), 1000);
  assert.equal(valueAt(model, selection, Date.UTC(2024, 0, 1)), 0);
  assert.ok(
    Math.abs(valueAt(model, selection, Date.UTC(2024, 6, 2)) - 183_000) < 1e-8,
  );
  assert.equal(valueAt(model, selection, Date.UTC(2025, 0, 1)), 0);
});
test("birth and death daily counters reset at UTC midnight", () => {
  const selection: MetricSelection = {
    ...DEFAULT_SELECTION,
    populationView: "deaths",
    period: "today",
  };
  const model = modelFor(population, selection, now, 2024)!;
  assert.equal(model.annual, 1000);
  assert.equal(valueAt(model, selection, Date.UTC(2024, 0, 2)), 0);
  assert.ok(
    Math.abs(
      valueAt(model, selection, Date.UTC(2024, 0, 2, 12)) - 1000 / 366 / 2,
    ) < 1e-10,
  );
});
test("population balance stays continuous at leap-year and calendar boundaries", () => {
  const model = modelFor(population, DEFAULT_SELECTION, now, 2024)!;
  const anchor = Date.UTC(2023, 6, 1);
  assert.equal(valueAt(model, DEFAULT_SELECTION, anchor), 100_000);
  const boundary = Date.UTC(2025, 0, 1);
  const before = valueAt(model, DEFAULT_SELECTION, boundary - 1);
  const after = valueAt(model, DEFAULT_SELECTION, boundary);
  assert.ok(after > before && after - before < 0.0001);
  assert.ok(
    Math.abs(
      valueAt(model, DEFAULT_SELECTION, Date.UTC(2024, 0, 1)) -
        (100_000 + (900 * 184) / 365),
    ) < 1e-7,
  );
});
test("debt is a balance derived from same-year GDP and ratios and can decrease", () => {
  const e = entity({
    gdp: [
      { year: 2023, value: 1000 },
      { year: 2024, value: 1100 },
    ],
    debtRatio: [
      { year: 2023, value: 100 },
      { year: 2024, value: 80 },
    ],
    population: [{ year: 2023, value: 100 }],
  });
  const selection = selectionForMetric("debt");
  const model = modelFor(e, selection, now, 2024)!;
  assert.equal(model.start, 1000);
  assert.equal(model.end, 880);
  assert.equal(model.annual, -120);
  assert.equal(model.populationYear, 2023);
  assert.equal(normalizedValue(model, selection, now), 9.4);
  assert.equal(valueAt(model, selection, Date.UTC(2024, 0, 1)), 1000);
  assert.equal(valueAt(model, selection, now), 940);
  assert.equal(
    measureValue(model, { ...selection, measure: "perCapita" }, now),
    9.4,
  );
  assert.equal(
    measureValue(model, { ...selection, measure: "debtRatio" }, now),
    80,
  );
});
test("missing consecutive debt balances are historical and remain static", () => {
  const e = entity({
    gdp: [{ year: 2024, value: 1000 }],
    debtRatio: [{ year: 2024, value: 80 }],
  });
  const selection = selectionForMetric("debt");
  const model = modelFor(e, selection, now, 2024)!;
  assert.equal(model.historical, true);
  assert.equal(valueAt(model, selection, now), 800);
});
test("homicide estimates require matching-year population and expire after five years", () => {
  const selection = selectionForMetric("homicides");
  const e = entity({
    population: [
      { year: 2018, value: 200_000 },
      { year: 2023, value: 300_000 },
    ],
    homicideRate: [
      { year: 2018, value: 5 },
      { year: 2022, value: 7 },
    ],
  });
  const model = modelFor(e, selection, now, 2024)!;
  assert.equal(model.year, 2018);
  assert.equal(model.annual, 10);
  assert.equal(model.historical, true);
  assert.equal(
    modelFor(e, selection, Date.UTC(2023, 0, 1), 2024)?.historical,
    false,
  );
});
test("annual history preserves missing years and identifies forecast segments", () => {
  const e = entity({
    gdp: [
      { year: 2022, value: 100 },
      { year: 2024, value: 120 },
    ],
  });
  const history = historyFor(e, selectionForMetric("gdp"), 2024, now);
  assert.deepEqual(history, [
    { year: 2022, value: 100, forecast: false },
    { year: 2024, value: 120, forecast: true },
  ]);
});
test("source revisions converge smoothly in either direction without overshoot", () => {
  assert.equal(blendRevision(100, 80, 0), 100);
  assert.equal(blendRevision(100, 80, 1), 80);
  assert.ok(
    blendRevision(100, 80, 0.5) < 100 && blendRevision(100, 80, 0.5) > 80,
  );
  assert.equal(blendRevision(80, 100, 2), 100);
});
test("URL state validates measures, deduplicates comparison and caps it at three", () => {
  const result = parseSelection(
    new URLSearchParams(
      "metric=homicides&measure=debtRatio&country=INVALID&compare=US,US,GB,FR,DE,INVALID",
    ),
    snapshot,
  );
  assert.equal(result.selection.measure, "rate");
  assert.equal(result.country, null);
  assert.deepEqual(result.compare, ["US", "GB", "FR"]);
});
test("verified snapshot has usable world models and excludes provider aggregates", () => {
  assert.equal(
    snapshot.countries.some(
      (c) =>
        c.iso3 === "WLD" || c.iso3 === "WEOWORLD" || c.region === "Aggregates",
    ),
    false,
  );
  for (const metric of [
    "population",
    "gdp",
    "debt",
    "homicides",
    "co2",
  ] as const)
    assert.ok(
      modelFor(
        snapshot.world,
        selectionForMetric(metric),
        now + 2 * 366 * 86_400_000,
        snapshot.forecastFrom,
      ),
      `${metric} world model`,
    );
});

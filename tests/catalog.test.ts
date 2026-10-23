import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CATALOG,
  entryById,
  entryFromQuery,
  entryHistory,
  formatChange,
  formatEntry,
  latestChange,
  modelForEntry,
  readEntry,
} from "../app/lib/catalog.ts";
import { utcDay } from "../app/lib/metrics.ts";
import type { Dataset, Entity } from "../app/lib/metrics-types.ts";

const snapshot = JSON.parse(
  readFileSync(
    new URL("../app/data/metrics-snapshot.json", import.meta.url),
    "utf8",
  ),
) as Dataset;
const now = Date.parse(snapshot.fetchedAt);
const fixture: Entity = {
  iso2: "XX",
  iso3: "XXX",
  name: "Fixture",
  region: "Test",
  coordinates: null,
  series: {
    population: [
      { year: 2023, value: 100 },
      { year: 2024, value: 200 },
    ],
    gdp: [
      { year: 2023, value: 1000 },
      { year: 2024, value: 3000 },
    ],
    debtRatio: [
      { year: 2023, value: 50 },
      { year: 2024, value: 60 },
    ],
    inflation: [
      { year: 2016, value: 4 },
      { year: 2017, value: -1.5 },
    ],
    lifeExpectancy: [
      { year: 2023, value: 70 },
      { year: 2024, value: 70.5 },
    ],
  },
};

test("catalog ids are unique and every entry resolves", () => {
  assert.equal(new Set(CATALOG.map((e) => e.id)).size, CATALOG.length);
  for (const entry of CATALOG) assert.equal(entryById(entry.id), entry);
  assert.equal(entryById("unknown"), CATALOG[0]);
});
test("legacy links map onto catalog entries", () => {
  const map = (query: string) => entryFromQuery(new URLSearchParams(query)).id;
  assert.equal(map("metric=debt&mapMeasure=debtRatio"), "debt-to-gdp");
  assert.equal(map("metric=debt&mapMeasure=perCapita"), "debt-per-person");
  assert.equal(map("metric=debt"), "debt");
  assert.equal(map("metric=population&view=births&period=today"), "births");
  assert.equal(map("metric=homicides&measure=rate"), "population");
  assert.equal(map("metric=inflation"), "inflation");
  assert.equal(map(""), "population");
});
test("level readings use the latest observation and expire after five years", () => {
  const entry = entryById("life-expectancy");
  const reading = readEntry(entry, fixture, null, Date.UTC(2026, 3, 1));
  assert.deepEqual(
    [reading.value, reading.year, reading.historical],
    [70.5, 2024, false],
  );
  const stale = readEntry(
    entryById("inflation"),
    fixture,
    null,
    Date.UTC(2026, 3, 1),
  );
  assert.equal(stale.value, null);
  assert.equal(stale.historical, true);
  assert.equal(stale.year, 2017);
  const old = readEntry(
    entryById("inflation"),
    fixture,
    null,
    Date.UTC(2020, 3, 1),
  );
  assert.equal(old.value, -1.5);
});
test("derived histories divide by the population at or before each year", () => {
  const at = Date.UTC(2024, 5, 1);
  const gdpPerPerson = entryHistory(
    entryById("gdp-per-capita"),
    fixture,
    2025,
    at,
  );
  assert.deepEqual(
    gdpPerPerson.slice(-2).map((p) => p.value),
    [10, 15],
  );
  const debtPerPerson = entryHistory(
    entryById("debt-per-person"),
    fixture,
    2025,
    at,
  );
  assert.deepEqual(
    debtPerPerson.slice(-2).map((p) => p.value),
    [5, 9],
  );
  const ratio = entryHistory(entryById("debt-to-gdp"), fixture, 2024, at);
  assert.deepEqual(
    ratio.map((p) => [p.year, p.forecast]),
    [
      [2023, false],
      [2024, true],
    ],
  );
});
test("changes report percent or percentage points with their years", () => {
  const at = Date.UTC(2024, 5, 1);
  const gdp = entryById("gdp-per-capita");
  const change = latestChange(entryHistory(gdp, fixture, 2025, at), gdp)!;
  assert.equal(change.change, 50);
  assert.equal(formatChange(gdp, change), "+50.0%");
  const life = entryById("life-expectancy");
  const points = latestChange(entryHistory(life, fixture, 2025, at), life)!;
  assert.equal(formatChange(life, points), "+0.50 pp");
  assert.equal(formatEntry(life, 70.54), "70.5 yrs");
  assert.equal(formatEntry(life, null), "—");
});
test("every entry has current world and country coverage in the snapshot", () => {
  const day = utcDay(now);
  for (const entry of CATALOG) {
    const reading = readEntry(
      entry,
      snapshot.world,
      modelForEntry(entry, snapshot.world, day, snapshot.forecastFrom),
      now,
    );
    assert.ok(reading.value !== null, `${entry.id} world value`);
    const mapped = snapshot.countries.filter(
      (c) =>
        readEntry(
          entry,
          c,
          modelForEntry(entry, c, day, snapshot.forecastFrom),
          now,
        ).value !== null,
    );
    assert.ok(
      mapped.length > 100,
      `${entry.id} has ${mapped.length} countries`,
    );
  }
});

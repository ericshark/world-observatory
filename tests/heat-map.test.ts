import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHeatScale,
  heatColor,
  mapValue,
  parseMapMeasure,
} from "../app/lib/heat-map.ts";
import { modelFor, selectionForMetric } from "../app/lib/metrics.ts";
import type { Entity } from "../app/lib/metrics-types.ts";
import geography from "../app/lib/geography.ts";
const selection = selectionForMetric("debt");
const now = Date.UTC(2024, 6, 2);
const entity: Entity = {
  iso2: "XX",
  iso3: "XXX",
  name: "Fixture",
  region: "",
  coordinates: null,
  series: {
    gdp: [
      { year: 2023, value: 1000 },
      { year: 2024, value: 2000 },
    ],
    debtRatio: [
      { year: 2023, value: 50 },
      { year: 2024, value: 100 },
    ],
    population: [{ year: 2023, value: 10 }],
  },
};
test("logarithmic and linear legends use the exact country color scale", () => {
  for (const kind of ["log", "linear"] as const) {
    const scale = createHeatScale([0, 1, 100, 1_000_000, null], kind);
    scale.ticks.forEach((tick, i) =>
      assert.equal(scale.color(tick), heatColor(i / 4)),
    );
    assert.equal(scale.color(null), null);
    assert.notEqual(scale.color(0), null);
    assert.ok(scale.ticks.every((v, i) => i === 0 || v > scale.ticks[i - 1]));
  }
});
test("empty, invalid, and uniform datasets have explicit scale behavior", () => {
  assert.deepEqual(createHeatScale([null, NaN, -1]).ticks, []);
  const uniform = createHeatScale([12, 12]);
  assert.deepEqual(uniform.ticks, [12]);
  assert.equal(uniform.color(12), heatColor(0.5));
});
test("debt measures preserve units, population basis, ratios and historical exclusions", () => {
  const model = modelFor(entity, selection, now, 2024)!;
  const total = mapValue(model, selection, now)!;
  assert.equal(
    mapValue(model, { ...selection, measure: "perCapita" }, now),
    total / 10,
  );
  assert.equal(
    mapValue(model, { ...selection, measure: "debtRatio" }, now),
    100,
  );
  assert.equal(
    mapValue(
      { ...model, population: null },
      { ...selection, measure: "perCapita" },
      now,
    ),
    null,
  );
  assert.equal(mapValue({ ...model, historical: true }, selection, now), null);
  assert.equal(mapValue(null, selection, now), null);
});
test("map URLs validate measures independently of counter selection", () => {
  assert.equal(parseMapMeasure("perCapita", "debt"), "perCapita");
  assert.equal(parseMapMeasure("debtRatio", "debt"), "debtRatio");
  for (const value of [null, "garbage", "rate"])
    assert.equal(parseMapMeasure(value, "debt"), "total");
  assert.equal(parseMapMeasure("debtRatio", "population"), "total");
});
test("geography retains every polygon for countries sharing ISO identifiers", () => {
  assert.equal(
    geography.features.filter((f) => f.properties.iso === "AU").length,
    3,
  );
  assert.equal(
    geography.features.filter((f) => f.properties.iso === "CY").length,
    2,
  );
  assert.equal(
    geography.features.filter((f) => f.properties.iso === "SO").length,
    2,
  );
});

test("a zero observation does not compress ordinary economies into the warm end", () => {
  const scale = createHeatScale([
    0, 10_000_000, 1_000_000_000, 1_000_000_000_000,
  ]);
  assert.ok(scale.ticks[2] > 1_000_000_000);
  assert.ok(scale.ticks[2] < 10_000_000_000);
});

test("clipped scales keep outliers at the ends and accept negative values", () => {
  const values = [-3, ...Array.from({ length: 98 }, (_, i) => i / 10), 250];
  const scale = createHeatScale(values, "clipped");
  assert.equal(scale.clippedLow, true);
  assert.equal(scale.clippedHigh, true);
  assert.ok(scale.ticks[0] > -3 && scale.ticks[4] < 250);
  assert.equal(scale.color(250), heatColor(1));
  assert.equal(scale.color(-3), heatColor(0));
  scale.ticks.forEach((tick, i) =>
    assert.equal(scale.color(tick), heatColor(i / 4)),
  );
  assert.equal(createHeatScale([-1, 2], "log").count, 1);
  assert.equal(createHeatScale([-1, 2], "linear").count, 2);
});

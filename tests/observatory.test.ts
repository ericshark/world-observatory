import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COUNTERS,
  digitPosition,
  normalizeSelection,
} from "../app/lib/observatory.ts";

test("six counter modes normalize old links and unsupported periods", () => {
  for (const counter of COUNTERS)
    assert.deepEqual(normalizeSelection(counter.selection), counter.selection);
  assert.deepEqual(
    normalizeSelection({
      metric: "homicides",
      populationView: "population",
      period: "year",
      measure: "rate",
    }),
    COUNTERS[0].selection,
  );
  assert.deepEqual(
    normalizeSelection({
      metric: "population",
      populationView: "births",
      period: "year",
      measure: "rate",
    }),
    COUNTERS[1].selection,
  );
  assert.deepEqual(
    normalizeSelection({
      metric: "gdp",
      populationView: "deaths",
      period: "today",
      measure: "perCapita",
    }),
    COUNTERS[3].selection,
  );
});
test("digit wheels carry smoothly and reverse with falling totals", () => {
  assert.equal(digitPosition(129.5, 0), 9.5);
  assert.equal(digitPosition(129.5, 1), 2.5);
  assert.equal(digitPosition(129.5, 2), 1);
  assert.equal(digitPosition(199.5, 2), 1.5);
  assert.equal(digitPosition(200, 2), 2);
  assert.equal(digitPosition(199.75, 2), 1.75);
  assert.equal(digitPosition(0, 0), 0);
});

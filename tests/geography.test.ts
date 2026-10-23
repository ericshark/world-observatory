import assert from "node:assert/strict";
import { test } from "node:test";
import { geoArea, geoContains } from "d3-geo";
import geography from "../app/lib/geography.ts";

const countryAt = (point: [number, number]) =>
  geography.features.find((f) => geoContains(f, point))?.properties.iso;
test("country geometry uses normalized spherical rings and usable identifiers", () => {
  assert.ok(geography.features.length > 230);
  for (const feature of geography.features) {
    assert.ok(geoArea(feature) < Math.PI * 2);
    assert.match(feature.properties.iso, /^[A-Z]{2}$/);
  }
});
test("polygon selection covers mainland, islands, ocean, and the date line", () => {
  assert.equal(countryAt([-100, 40]), "US");
  assert.equal(countryAt([139.7, 35.7]), "JP");
  assert.equal(countryAt([47, -19]), "MG");
  assert.equal(countryAt([-30, 0]), undefined);
  assert.equal(countryAt([179, 68]), "RU");
  assert.equal(countryAt([-179, 68]), "RU");
});

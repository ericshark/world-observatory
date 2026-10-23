import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyWorldBank,
  fetchDataset,
  parseCountries,
  parseImf,
  parseWorldBank,
  requestJson,
  validateDataset,
} from "../app/lib/providers.ts";
import { createMetricsCache } from "../app/lib/metrics-cache.ts";
import type { Dataset, Entity } from "../app/lib/metrics-types.ts";

const snapshot = JSON.parse(
  readFileSync(
    new URL("../app/data/metrics-snapshot.json", import.meta.url),
    "utf8",
  ),
) as Dataset;
const wbRow = (iso: string, code: string, value: unknown, date = "2024") => ({
  countryiso3code: iso,
  indicator: { id: code },
  value,
  date,
});

test("World Bank payload and pagination validation rejects malformed responses", () => {
  assert.throws(() => parseWorldBank([{ message: "Error" }]));
  assert.throws(() => parseWorldBank([{ pages: 0 }, []]));
  assert.throws(() => parseWorldBank([{ pages: 10000 }, []]));
  assert.equal(
    parseWorldBank([{ pages: 1, lastupdated: "2026-10-08" }, []]).updatedAt,
    "2026-10-08",
  );
});
test("country catalogue excludes regional aggregates and preserves missing coordinates", () => {
  const result = parseCountries([
    {
      id: "USA",
      iso2Code: "US",
      name: "United States",
      region: { id: "NAC", value: "North America" },
      longitude: "-77",
      latitude: "39",
    },
    {
      id: "ABC",
      iso2Code: "AB",
      name: "Example",
      region: { id: "EAS", value: "Asia" },
      longitude: "",
      latitude: "",
    },
    {
      id: "WLD",
      iso2Code: "1W",
      name: "World",
      region: { id: "NA", value: "Aggregates" },
    },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].coordinates, [-77, 39]);
  assert.equal(result[1].coordinates, null);
});
test("provider joins normalize CO2 megatonnes, retain zero and negative migration, and skip missing/aggregate rows", () => {
  const e: Entity = {
    iso2: "US",
    iso3: "USA",
    name: "US",
    region: "North America",
    coordinates: [0, 0],
    series: {},
  };
  const entities = new Map([["USA", e]]);
  applyWorldBank(
    [
      wbRow("USA", "EN.GHG.CO2.MT.CE.AR5", 4.2),
      wbRow("USA", "SM.POP.NETM", -50),
      wbRow("USA", "SP.DYN.CBRT.IN", 0),
      wbRow("USA", "SP.POP.TOTL", null),
      wbRow("USA", "SP.POP.TOTL", "100"),
      wbRow("WLD", "SP.POP.TOTL", 10000),
      wbRow("USA", "FP.CPI.TOTL.ZG", -1.2),
      wbRow("USA", "SL.UEM.TOTL.ZS", -3),
    ],
    entities,
  );
  assert.equal(e.series.inflation?.[0].value, -1.2);
  assert.equal(e.series.unemployment, undefined);
  assert.equal(e.series.co2?.[0].value, 4_200_000);
  assert.equal(e.series.migration?.[0].value, -50);
  assert.equal(e.series.birthRate?.[0].value, 0);
  assert.equal(e.series.population, undefined);
});
test("IMF adapter validates series and preserves only finite numeric observations", () => {
  assert.throws(() => parseImf({ values: {} }, "NGDPD"));
  const result = parseImf(
    {
      values: { NGDPD: { USA: { 2023: 20, 2024: null, 2025: "22", 2026: 0 } } },
    },
    "NGDPD",
  );
  assert.deepEqual(result.USA, [
    { year: 2023, value: 20 },
    { year: 2026, value: 0 },
  ]);
});
test("HTTP and malformed providers fail the refresh instead of fabricating a dataset", async () => {
  await assert.rejects(
    requestJson(
      "https://example.invalid",
      async () => new Response("", { status: 503 }),
    ),
    /HTTP 503/,
  );
  await assert.rejects(
    fetchDataset(async () => Response.json({ broken: true })),
    /Invalid/,
  );
});
test("snapshot validation rejects nonfinite values, duplicates, and missing world data", () => {
  assert.equal(validateDataset(snapshot), true);
  assert.equal(validateDataset({ ...snapshot, schemaVersion: 99 }), false);
  assert.equal(
    validateDataset({
      ...snapshot,
      countries: [...snapshot.countries, snapshot.countries[0]],
    }),
    false,
  );
  const copy = structuredClone(snapshot);
  copy.world.series.population = [{ year: 2024, value: Infinity }];
  assert.equal(validateDataset(copy), false);
  const signed = structuredClone(snapshot);
  signed.world.series.inflation = [{ year: 2024, value: -2 }];
  assert.equal(validateDataset(signed), true);
  signed.world.series.lifeExpectancy = [{ year: 2024, value: -2 }];
  assert.equal(validateDataset(signed), false);
});
test("daily cache does not fetch a fresh snapshot", async () => {
  let requests = 0;
  const get = createMetricsCache(
    snapshot,
    async () => {
      requests++;
      return snapshot;
    },
    () => Date.parse(snapshot.fetchedAt) + 1000,
  );
  assert.equal((await get()).status, "snapshot");
  assert.equal(requests, 0);
});
test("expired cache coalesces concurrent refreshes and keeps the new release", async () => {
  let requests = 0;
  const now = Date.parse(snapshot.fetchedAt) + 86_400_001;
  const fresh = { ...snapshot, fetchedAt: new Date(now).toISOString() };
  const get = createMetricsCache(
    snapshot,
    async () => {
      requests++;
      await Promise.resolve();
      return fresh;
    },
    () => now,
  );
  const [a, b] = await Promise.all([get(), get()]);
  assert.equal(requests, 1);
  assert.equal(a.dataset.fetchedAt, fresh.fetchedAt);
  assert.equal(b.dataset.fetchedAt, fresh.fetchedAt);
  assert.equal((await get()).status, "cached");
});
test("refresh failure and invalid payload preserve last-known-good snapshot and back off", async () => {
  let requests = 0;
  let now = Date.parse(snapshot.fetchedAt) + 86_400_001;
  const get = createMetricsCache(
    snapshot,
    async () => {
      requests++;
      throw new Error("offline");
    },
    () => now,
  );
  const failed = await get();
  assert.equal(failed.refreshFailed, true);
  assert.equal(failed.dataset, snapshot);
  await get();
  assert.equal(requests, 1);
  now += 5 * 60_000;
  await get();
  assert.equal(requests, 2);
  const invalid = createMetricsCache(
    snapshot,
    async () => ({ ...snapshot, world: { ...snapshot.world, series: {} } }),
    () => now,
  );
  assert.equal((await invalid()).dataset, snapshot);
  assert.equal((await invalid()).refreshFailed, true);
});

test("complete provider import paginates, converts IMF billions, joins world aggregates, and rejects mixed releases", async () => {
  const fixtures = snapshot.countries.slice(0, 120);
  const metadata = fixtures.map((c) => ({
    id: c.iso3,
    iso2Code: c.iso2,
    name: c.name,
    region: { id: "TEST", value: c.region },
    longitude: "1",
    latitude: "2",
  }));
  let omitAddedIndicators = false;
  const rowsFor = () =>
    [...fixtures.map((c) => c.iso3), "WLD"].flatMap((iso) =>
    [2023, 2024].flatMap((year) => [
      wbRow(iso, "SP.POP.TOTL", 1_000_000, String(year)),
      wbRow(iso, "SP.DYN.CBRT.IN", 10, String(year)),
      wbRow(iso, "SP.DYN.CDRT.IN", 5, String(year)),
      wbRow(iso, "SM.POP.NETM", 0, String(year)),
      wbRow(iso, "VC.IHR.PSRC.P5", 2, String(year)),
      wbRow(iso, "EN.GHG.CO2.MT.CE.AR5", 4, String(year)),
      ...(omitAddedIndicators
        ? []
        : [
            wbRow(iso, "SP.DYN.LE00.IN", 72.5, String(year)),
            wbRow(iso, "SP.URB.TOTL.IN.ZS", 56, String(year)),
            wbRow(iso, "FP.CPI.TOTL.ZG", -0.4, String(year)),
            wbRow(iso, "SL.UEM.TOTL.ZS", 5.1, String(year)),
          ]),
    ]),
  );
  let mixedRelease = false;
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/country?"))
      return Response.json([{ pages: 1 }, metadata]);
    if (url.includes("/indicators"))
      return Response.json({
        indicators: {
          NGDPD: {
            source: "WEO fixture",
            "projection-year": 2024,
            "last-modified": "2024-10-01",
          },
          GGXWDG_NGDP: {
            source: mixedRelease ? "different release" : "WEO fixture",
            "projection-year": 2024,
          },
        },
      });
    if (url.includes("/NGDPD") || url.includes("/GGXWDG_NGDP")) {
      const id = url.includes("/NGDPD") ? "NGDPD" : "GGXWDG_NGDP";
      return Response.json({
        values: {
          [id]: Object.fromEntries(
            [
              ...fixtures.map((c) => (c.iso3 === "XKX" ? "UVK" : c.iso3)),
              "WEOWORLD",
            ].map((iso) => [
              iso,
              {
                2023: id === "NGDPD" ? 100 : 50,
                2024: id === "NGDPD" ? 110 : 50,
              },
            ]),
          ),
        },
      });
    }
    if (url.includes("mrnev")) return Response.json([{ pages: 1 }, []]);
    const countryRows = rowsFor();
    return Response.json([
      { pages: 2, lastupdated: "2024-10-01" },
      new URL(url).searchParams.get("page") === "2"
        ? countryRows.slice(700)
        : countryRows.slice(0, 700),
    ]);
  };
  const result = await fetchDataset(fetcher, Date.UTC(2024, 9, 20));
  assert.ok(requests.some((url) => url.includes("&page=2")));
  assert.equal(
    result.countries.find((c) => c.iso3 === fixtures[0].iso3)?.series.gdp?.[1]
      .value,
    110_000_000_000,
  );
  assert.equal(result.world.series.co2?.[0].value, 4_000_000);
  assert.equal(result.world.series.gdp?.[0].value, 100_000_000_000);
  assert.equal(
    result.countries.some((c) => c.iso3 === "WEOWORLD" || c.iso3 === "WLD"),
    false,
  );
  assert.equal(result.world.series.inflation?.[0].value, -0.4);
  assert.equal(result.world.series.lifeExpectancy?.[1].value, 72.5);
  omitAddedIndicators = true;
  await assert.rejects(
    fetchDataset(fetcher, Date.UTC(2024, 9, 20)),
    /lifeExpectancy coverage/,
  );
  omitAddedIndicators = false;
  mixedRelease = true;
  await assert.rejects(
    fetchDataset(fetcher, Date.UTC(2024, 9, 20)),
    /metadata mismatch/,
  );
});

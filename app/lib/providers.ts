import type {
  Dataset,
  Entity,
  Observation,
  SeriesId,
} from "./metrics-types.ts";

export const WB_INDICATORS: Record<string, SeriesId> = {
  "SP.POP.TOTL": "population",
  "SP.DYN.CBRT.IN": "birthRate",
  "SP.DYN.CDRT.IN": "deathRate",
  "SM.POP.NETM": "migration",
  "VC.IHR.PSRC.P5": "homicideRate",
  "EN.GHG.CO2.MT.CE.AR5": "co2",
  "SP.DYN.LE00.IN": "lifeExpectancy",
  "SP.URB.TOTL.IN.ZS": "urbanization",
  "FP.CPI.TOTL.ZG": "inflation",
  "SL.UEM.TOTL.ZS": "unemployment",
};
export const ADDED_SERIES: SeriesId[] = [
  "lifeExpectancy",
  "urbanization",
  "inflation",
  "unemployment",
];
/** Series whose observations can legitimately fall below zero. */
export const SIGNED_SERIES = new Set<SeriesId>(["migration", "inflation"]);
const WB_BASE = "https://api.worldbank.org/v2";
const IMF_BASE = "https://www.imf.org/external/datamapper/api/v2";
type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provider object");
  return value as JsonObject;
}
export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function requestJson(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

export function parseWorldBank(payload: unknown): {
  rows: JsonObject[];
  pages: number;
  updatedAt: string;
} {
  if (
    !Array.isArray(payload) ||
    payload.length !== 2 ||
    !Array.isArray(payload[1])
  )
    throw new Error("Invalid World Bank response");
  const meta = object(payload[0]);
  if (!finite(meta.pages) || meta.pages < 1 || meta.pages > 100)
    throw new Error("Invalid World Bank pagination");
  return {
    rows: payload[1].map(object),
    pages: meta.pages,
    updatedAt: typeof meta.lastupdated === "string" ? meta.lastupdated : "",
  };
}

export function parseImf(
  payload: unknown,
  indicator: string,
): Record<string, Observation[]> {
  const values = object(object(object(payload).values)[indicator]);
  const result: Record<string, Observation[]> = {};
  for (const [iso, raw] of Object.entries(values)) {
    result[iso] = Object.entries(object(raw))
      .filter(
        ([year, value]) => /^\d{4}$/.test(year) && finite(value) && value >= 0,
      )
      .map(([year, value]) => ({ year: Number(year), value: value as number }))
      .sort((a, b) => a.year - b.year);
  }
  if (Object.keys(result).length === 0) throw new Error("Empty IMF series");
  return result;
}

export function parseCountries(rows: JsonObject[]): Entity[] {
  return rows
    .filter((row) => object(row.region).id !== "NA")
    .map((row) => {
      if (
        typeof row.id !== "string" ||
        typeof row.iso2Code !== "string" ||
        typeof row.name !== "string"
      )
        throw new Error("Invalid country metadata");
      const lon = row.longitude === "" ? NaN : Number(row.longitude);
      const lat = row.latitude === "" ? NaN : Number(row.latitude);
      return {
        iso2: row.iso2Code,
        iso3: row.id,
        name: row.name,
        region: String(object(row.region).value).trim(),
        coordinates:
          Number.isFinite(lon) && Number.isFinite(lat)
            ? ([lon, lat] as [number, number])
            : null,
        series: {},
      };
    });
}

export function applyWorldBank(
  rows: JsonObject[],
  entities: Map<string, Entity>,
) {
  let applied = 0;
  for (const row of rows) {
    const entity = entities.get(String(row.countryiso3code));
    const key = WB_INDICATORS[String(object(row.indicator).id)];
    if (
      !entity ||
      !key ||
      !finite(row.value) ||
      !/^\d{4}$/.test(String(row.date))
    )
      continue;
    if (!SIGNED_SERIES.has(key) && row.value < 0) continue;
    const value = key === "co2" ? row.value * 1_000_000 : row.value;
    const series = (entity.series[key] ??= []);
    const year = Number(row.date);
    if (!series.some((o) => o.year === year)) {
      series.push({ year, value });
      applied++;
    }
  }
  return applied;
}

export function validateDataset(value: unknown): value is Dataset {
  try {
    const data = object(value);
    if (
      data.schemaVersion !== 1 ||
      !Number.isFinite(Date.parse(String(data.fetchedAt))) ||
      !finite(data.forecastFrom) ||
      !Array.isArray(data.countries) ||
      data.countries.length < 100
    )
      return false;
    const sources = object(data.sources);
    for (const key of ["worldbank", "imf"]) {
      const s = object(sources[key]);
      if (
        typeof s.url !== "string" ||
        typeof s.label !== "string" ||
        typeof s.updatedAt !== "string"
      )
        return false;
    }
    const ids = new Set<string>();
    const iso2s = new Set<string>();
    for (const raw of [...data.countries, data.world]) {
      const entity = object(raw);
      if (
        typeof entity.iso2 !== "string" ||
        typeof entity.iso3 !== "string" ||
        typeof entity.name !== "string" ||
        typeof entity.region !== "string" ||
        ids.has(entity.iso3) ||
        iso2s.has(entity.iso2)
      )
        return false;
      ids.add(entity.iso3);
      iso2s.add(entity.iso2);
      if (
        entity.coordinates !== null &&
        (!Array.isArray(entity.coordinates) ||
          entity.coordinates.length !== 2 ||
          !entity.coordinates.every(finite))
      )
        return false;
      for (const [key, series] of Object.entries(object(entity.series))) {
        if (
          ![...Object.values(WB_INDICATORS), "gdp", "debtRatio"].includes(
            key as SeriesId,
          ) ||
          !Array.isArray(series)
        )
          return false;
        const years = new Set<number>();
        for (const rawObs of series) {
          const obs = object(rawObs);
          if (
            !finite(obs.year) ||
            !Number.isInteger(obs.year) ||
            !finite(obs.value) ||
            (!SIGNED_SERIES.has(key as SeriesId) && obs.value < 0) ||
            years.has(obs.year)
          )
            return false;
          years.add(obs.year);
        }
      }
    }
    const typed = data.countries as Entity[];
    // Indicators added after schema version 1 shipped stay optional so older
    // snapshots and cached datasets remain valid.
    const minimumCoverage: Partial<Record<SeriesId, number>> = {
      population: 100,
      birthRate: 80,
      deathRate: 80,
      migration: 80,
      gdp: 100,
      debtRatio: 80,
      homicideRate: 50,
      co2: 100,
    };
    if (
      Object.entries(minimumCoverage).some(
        ([key, count]) =>
          typed.filter((entity) => entity.series[key as SeriesId]?.length)
            .length < count!,
      )
    )
      return false;
    const world = data.world as Entity;
    return (
      world.iso3 === "WLD" &&
      (
        [
          "population",
          "birthRate",
          "deathRate",
          "gdp",
          "debtRatio",
          "homicideRate",
          "co2",
        ] as SeriesId[]
      ).every((key) => !!world.series[key]?.length) &&
      data.countries.some((raw) => (raw as Entity).series.debtRatio?.length)
    );
  } catch {
    return false;
  }
}

export async function fetchDataset(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<Dataset> {
  const year = new Date(now).getUTCFullYear();
  const wbUrl = `${WB_BASE}/country/all/indicator/${Object.keys(WB_INDICATORS).join(";")}?source=2&format=json&date=${year - 12}:${year}&per_page=20000`;
  const [countryRaw, wbRaw, gdpRaw, debtRaw, indicatorsRaw, homicideRaw] =
    await Promise.all([
      requestJson(`${WB_BASE}/country?format=json&per_page=400`, fetcher),
      requestJson(wbUrl, fetcher),
      requestJson(`${IMF_BASE}/NGDPD`, fetcher),
      requestJson(`${IMF_BASE}/GGXWDG_NGDP`, fetcher),
      requestJson(`${IMF_BASE}/indicators`, fetcher),
      requestJson(
        `${WB_BASE}/country/all/indicator/VC.IHR.PSRC.P5?format=json&mrnev=1&per_page=1000`,
        fetcher,
      ),
    ]);
  const countries = parseCountries(parseWorldBank(countryRaw).rows);
  // IMF economies absent from World Bank's country catalogue. Coordinates locate the capital.
  countries.push({
    iso2: "TW",
    iso3: "TWN",
    name: "Taiwan",
    region: "East Asia & Pacific",
    coordinates: [121.5654, 25.033],
    series: {},
  });
  for (const [iso2, iso3, name, coordinates] of [
    ["SJ", "SJM", "Svalbard and Jan Mayen", [15.63, 78.22]],
    ["GS", "SGS", "South Georgia", [-36.5, -54.3]],
    ["EH", "ESH", "Western Sahara", [-13.2, 27.15]],
  ] as const) {
    if (!countries.some((c) => c.iso2 === iso2))
      countries.push({
        iso2,
        iso3,
        name,
        region: "Other territories",
        coordinates: [...coordinates],
        series: {},
      });
  }
  const world: Entity = {
    iso2: "WORLD",
    iso3: "WLD",
    name: "World",
    region: "World",
    coordinates: null,
    series: {},
  };
  const entities = new Map([...countries, world].map((c) => [c.iso3, c]));
  const wb = parseWorldBank(wbRaw);
  const additionalPages = await Promise.all(
    Array.from({ length: wb.pages - 1 }, (_, index) =>
      requestJson(`${wbUrl}&page=${index + 2}`, fetcher).then(parseWorldBank),
    ),
  );
  const applied = applyWorldBank(
    [
      ...wb.rows,
      ...additionalPages.flatMap((p) => p.rows),
      ...parseWorldBank(homicideRaw).rows,
    ],
    entities,
  );
  if (applied < 1000) throw new Error("Incomplete World Bank dataset");
  // Retain the latest historical rate even when it predates the chart window.
  // Fetch its population denominator from the same year, never a current population.
  const historical = [...entities.values()].flatMap((entity) => {
    const latest = entity.series.homicideRate?.reduce((a, b) =>
      a.year > b.year ? a : b,
    );
    return latest &&
      !entity.series.population?.some((o) => o.year === latest.year)
      ? [{ entity, year: latest.year }]
      : [];
  });
  if (historical.length) {
    const codes = historical.map((item) => item.entity.iso3).join(";");
    const years = historical.map((item) => item.year);
    const payload = parseWorldBank(
      await requestJson(
        `${WB_BASE}/country/${codes}/indicator/SP.POP.TOTL?format=json&date=${Math.min(...years)}:${Math.max(...years)}&per_page=20000`,
        fetcher,
      ),
    );
    if (payload.pages !== 1)
      throw new Error("Incomplete historical population data");
    applyWorldBank(
      payload.rows.filter((row) =>
        historical.some(
          (item) =>
            item.entity.iso3 === row.countryiso3code &&
            item.year === Number(row.date),
        ),
      ),
      entities,
    );
  }
  const gdp = parseImf(gdpRaw, "NGDPD");
  const debt = parseImf(debtRaw, "GGXWDG_NGDP");
  for (const entity of entities.values()) {
    const code =
      entity.iso3 === "WLD"
        ? "WEOWORLD"
        : entity.iso3 === "XKX"
          ? "UVK"
          : entity.iso3;
    const withinWindow = (o: Observation) =>
      o.year >= year - 12 && o.year <= year + 1;
    if (gdp[code])
      entity.series.gdp = gdp[code]
        .filter(withinWindow)
        .map((o) => ({ year: o.year, value: o.value * 1_000_000_000 }));
    if (debt[code]) entity.series.debtRatio = debt[code].filter(withinWindow);
    Object.values(entity.series).forEach((series) =>
      series.sort((a, b) => a.year - b.year),
    );
  }
  const indicators = object(object(indicatorsRaw).indicators);
  const gdpMeta = object(indicators.NGDPD);
  const debtMeta = object(indicators.GGXWDG_NGDP);
  if (
    gdpMeta.source !== debtMeta.source ||
    gdpMeta["projection-year"] !== debtMeta["projection-year"] ||
    !finite(gdpMeta["projection-year"])
  )
    throw new Error("IMF release metadata mismatch");
  const data: Dataset = {
    schemaVersion: 1,
    fetchedAt: new Date(now).toISOString(),
    forecastFrom: gdpMeta["projection-year"],
    sources: {
      worldbank: {
        label: "World Bank · World Development Indicators",
        url: "https://data.worldbank.org",
        updatedAt: wb.updatedAt,
      },
      imf: {
        label: `IMF · ${String(gdpMeta.source)}`,
        url: "https://www.imf.org/external/datamapper",
        updatedAt: String(gdpMeta["last-modified"]),
      },
    },
    countries: countries.sort((a, b) => a.name.localeCompare(b.name)),
    world,
  };
  if (!validateDataset(data))
    throw new Error("Provider dataset failed validation");
  // Fresh imports must carry every current indicator, even though validation
  // tolerates older datasets without them.
  for (const key of ADDED_SERIES)
    if (data.countries.filter((c) => c.series[key]?.length).length < 100)
      throw new Error(`Incomplete World Bank ${key} coverage`);
  return data;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG,
  DEFAULT_ENTRY,
  entryById,
  entryFromQuery,
  entryHistory,
  formatEntry,
  latestChange,
  modelForEntry,
  readEntry,
  type CatalogEntry,
  type Reading,
} from "../lib/catalog";
import { createHeatScale, heatColor } from "../lib/heat-map";
import { utcDay } from "../lib/metrics";
import type { Dataset } from "../lib/metrics-types";
import { COUNTERS } from "../lib/observatory";
import ActiveReadout from "./hud/ActiveReadout";
import CountryDossier, { type DossierIndicator } from "./hud/CountryDossier";
import HudTopBar from "./hud/HudTopBar";
import MetricNavigator, { type EntrySummary } from "./hud/MetricNavigator";
import RankingsPanel from "./hud/RankingsPanel";
import SignalDistribution from "./hud/SignalDistribution";
import TrendPanel from "./hud/TrendPanel";
import EarthHorizon from "./map/EarthHorizon";
import IntelMap, { needsLocator, type MapApi } from "./map/IntelMap";
import { useLiveDataset } from "./useLiveDataset";

const WORLD = "WORLD";
const DOSSIER_IDS = [
  "population",
  "gdp-per-capita",
  "life-expectancy",
  "urbanization",
  "inflation",
  "unemployment",
  "debt-to-gdp",
  "co2",
];
/** Model estimates move slowly; recomputing every country twice a minute is plenty. */
const RECOMPUTE_MS = 30_000;
const GRADIENT = `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(heatColor).join(", ")})`;

function sourceLabel(entry: CatalogEntry, data: Dataset) {
  const { imf, worldbank } = data.sources;
  if (entry.source === "imf")
    return `${imf.label} · ${imf.updatedAt.split(" ")[0]}`;
  if (entry.source === "worldbank")
    return `${worldbank.label} · ${worldbank.updatedAt}`;
  return "IMF World Economic Outlook + World Bank WDI";
}

export default function Dashboard({
  initialData,
  referenceTime,
}: {
  initialData: Dataset;
  referenceTime: number;
}) {
  const { data, status } = useLiveDataset(initialData);
  const [entryId, setEntryId] = useState(DEFAULT_ENTRY.id);
  const [country, setCountry] = useState<string | null>(null);
  const [now, setNow] = useState(referenceTime);
  const [ready, setReady] = useState(false);
  const mapApi = useRef<MapApi>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const zoomLabel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(location.search);
      const iso = query.get("country");
      setEntryId(entryFromQuery(query).id);
      setCountry(
        iso && initialData.countries.some((c) => c.iso2 === iso) ? iso : null,
      );
      setNow(Date.now());
      setReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialData]);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(location.href);
    for (const legacy of ["view", "period", "measure", "mapMeasure", "compare"])
      url.searchParams.delete(legacy);
    url.searchParams.set("metric", entryId);
    if (country) url.searchParams.set("country", country);
    else url.searchParams.delete("country");
    history.replaceState(null, "", url);
  }, [entryId, country, ready]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = setInterval(tick, RECOMPUTE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const entry = entryById(entryId);
  const day = utcDay(now);
  const entities = useMemo(() => [...data.countries, data.world], [data]);
  const models = useMemo(
    () =>
      new Map(
        CATALOG.map((e) => [
          e.id,
          new Map(
            entities.map((c) => [
              c.iso2,
              modelForEntry(e, c, day, data.forecastFrom),
            ]),
          ),
        ]),
      ),
    [entities, day, data.forecastFrom],
  );
  const readings = useMemo(
    () =>
      new Map(
        CATALOG.map((e) => [
          e.id,
          new Map(
            entities.map((c) => [
              c.iso2,
              readEntry(e, c, models.get(e.id)!.get(c.iso2) ?? null, now),
            ]),
          ),
        ]),
      ),
    [entities, models, now],
  );
  const active = readings.get(entry.id)!;
  const values = useMemo(
    () =>
      new Map(
        data.countries.map((c) => [c.iso2, active.get(c.iso2)?.value ?? null]),
      ),
    [data, active],
  );
  const scale = useMemo(
    () => createHeatScale(values.values(), entry.scale),
    [values, entry.scale],
  );
  const colors = useMemo(
    () =>
      new Map(
        [...values].flatMap(([iso, value]) => {
          const color = scale.color(value);
          return color ? [[iso, color] as [string, string]] : [];
        }),
      ),
    [values, scale],
  );
  const ranked = useMemo(
    () =>
      data.countries
        .filter((c) => values.get(c.iso2) != null)
        .sort((a, b) => values.get(b.iso2)! - values.get(a.iso2)!),
    [data, values],
  );
  const summaries = useMemo(
    () =>
      new Map<string, EntrySummary>(
        CATALOG.map((e) => [
          e.id,
          {
            value: readings.get(e.id)!.get(WORLD)?.value ?? null,
            change: latestChange(
              entryHistory(e, data.world, data.forecastFrom, day),
              e,
            ),
          },
        ]),
      ),
    [readings, data, day],
  );
  const locators = useMemo(
    () =>
      data.countries.flatMap((c) =>
        c.coordinates && needsLocator(c.iso2)
          ? [{ iso: c.iso2, coordinates: c.coordinates }]
          : [],
      ),
    [data],
  );
  const selected = data.countries.find((c) => c.iso2 === country) ?? null;
  const scope = selected ?? data.world;
  const scopeReading = active.get(scope.iso2) ?? null;
  const ranks = useMemo(() => {
    if (!selected)
      return {
        global: null,
        regional: null,
        share: null,
        coverage: ranked.length,
      };
    const region = ranked.filter((c) => c.region === selected.region);
    const index = ranked.findIndex((c) => c.iso2 === selected.iso2);
    const regionalIndex = region.findIndex((c) => c.iso2 === selected.iso2);
    const value = values.get(selected.iso2);
    const world = active.get(WORLD)?.value;
    return {
      global: index >= 0 ? { rank: index + 1, of: ranked.length } : null,
      regional:
        regionalIndex >= 0
          ? {
              rank: regionalIndex + 1,
              of: region.length,
              region: selected.region,
            }
          : null,
      share: value != null && world ? value / world : null,
      coverage: ranked.length,
    };
  }, [selected, ranked, values, active]);
  const indicators = useMemo<DossierIndicator[]>(
    () =>
      DOSSIER_IDS.map((id) => {
        const byIso = readings.get(id)!;
        const reading = byIso.get(scope.iso2) ?? null;
        let percentile: number | null = null;
        if (selected && reading?.value != null) {
          const all = data.countries
            .map((c) => byIso.get(c.iso2)?.value)
            .filter((v): v is number => v != null);
          percentile =
            all.filter((v) => v <= reading.value!).length / all.length;
        }
        return { entry: entryById(id), reading, percentile };
      }),
    [readings, scope, selected, data],
  );
  const trend = useMemo(
    () => entryHistory(entry, scope, data.forecastFrom, day),
    [entry, scope, data.forecastFrom, day],
  );
  const years = useMemo(() => {
    const observed = data.countries
      .map((c) => active.get(c.iso2))
      .filter((r): r is Reading => r?.value != null && r.year !== null)
      .map((r) => r.year!);
    return observed.length
      ? ([Math.min(...observed), Math.max(...observed)] as [number, number])
      : null;
  }, [data, active]);
  const counterModels = COUNTERS.map(
    (counter) => models.get(counter.id)?.get(WORLD) ?? null,
  );

  const pickEntry = useCallback((id: string) => setEntryId(id), []);
  const focusCountry = useCallback((iso: string | null) => {
    setCountry(iso);
    if (iso) mapApi.current?.focus(iso);
  }, []);
  const onMapSelect = useCallback(
    (iso: string | null) =>
      setCountry(
        iso && initialData.countries.some((c) => c.iso2 === iso) ? iso : null,
      ),
    [initialData],
  );
  const onZoom = useCallback((zoom: number) => {
    if (zoomLabel.current)
      zoomLabel.current.textContent = `Z ${zoom.toFixed(1)}`;
  }, []);
  const renderTooltip = (iso: string, name: string) => {
    const entity = data.countries.find((c) => c.iso2 === iso);
    const reading = active.get(iso);
    const index = ranked.findIndex((c) => c.iso2 === iso);
    return (
      <>
        <div className="tooltip-head">
          <span>{entity?.iso3 ?? iso}</span>
          <strong>{entity?.name ?? name}</strong>
        </div>
        <p className="tooltip-label">{entry.label}</p>
        <b>
          {formatEntry(entry, reading?.value ?? null)}{" "}
          <small>{entry.unit}</small>
        </b>
        <p>
          {!reading || reading.year === null
            ? "No published data"
            : reading.historical
              ? `Last observation ${reading.year} · historical, not mapped`
              : `${reading.year}${reading.forecast ? " · IMF forecast" : " source year"}${entry.kind === "live" && entry.counter ? " · modelled estimate" : ""}`}
        </p>
        {reading?.populationYear != null &&
          entry.kind === "live" &&
          !entry.counter && <p>Population basis {reading.populationYear}</p>}
        {index >= 0 && (
          <p>
            Rank #{index + 1} of {ranked.length}
          </p>
        )}
        <small>
          {entity ? "Click to open dossier" : "No statistical record"}
        </small>
      </>
    );
  };

  return (
    <main className="ops">
      <HudTopBar
        models={counterModels}
        activeId={entry.id}
        onPick={pickEntry}
        status={status}
        periodKeys={{ day, year: new Date(now).getUTCFullYear() }}
      />
      <div className="ops-stage">
        <div className="ops-viewport">
          <EarthHorizon />
          <IntelMap
            ref={mapApi}
            colors={colors}
            transitionKey={entry.id}
            selectedIso={country}
            locators={locators}
            onSelect={onMapSelect}
            renderTooltip={renderTooltip}
            readout={cursor}
            onZoom={onZoom}
          />
          <div className="theatre-hud">
            <div className="theatre-title">
              <span className="theatre-code">◢ Global monitoring</span>
              <strong>{entry.label}</strong>
              <span>
                {scale.count} countries
                {years
                  ? ` · ${years[0] === years[1] ? years[0] : `${years[0]}–${years[1]}`}`
                  : ""}
              </span>
            </div>
            <div
              className="theatre-controls"
              role="group"
              aria-label="Map view"
            >
              <button
                onClick={() => mapApi.current?.zoomIn()}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => mapApi.current?.zoomOut()}
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                onClick={() => mapApi.current?.reset()}
                aria-label="Reset map to world view"
              >
                ⌂
              </button>
            </div>
            <div className="theatre-legend" aria-hidden="true">
              <span>
                {scale.clippedLow ? "≤" : ""}
                {formatEntry(entry, scale.ticks[0] ?? null)}
              </span>
              <i style={{ background: GRADIENT }} />
              <span>
                {scale.clippedHigh ? "≥" : ""}
                {formatEntry(
                  entry,
                  scale.ticks[scale.ticks.length - 1] ?? null,
                )}
              </span>
            </div>
            <div className="theatre-readout" aria-hidden="true">
              <span ref={cursor}>—</span>
              <span ref={zoomLabel}>Z —</span>
            </div>
            <p className="theatre-credit">
              Night lights: NASA Black Marble 2016 composite (VIIRS via GIBS) ·
              Boundaries: Natural Earth, illustrative · Colors show values, not
              risk
            </p>
          </div>
        </div>
        <aside className="rail rail-left" aria-label="Signal controls">
          <ActiveReadout
            entry={entry}
            scopeName={scope.name}
            reading={scopeReading}
            now={now}
            sourceLabel={sourceLabel(entry, data)}
          />
          <MetricNavigator
            active={entry}
            summaries={summaries}
            onPick={pickEntry}
          />
          <SignalDistribution
            entry={entry}
            scale={scale}
            values={ranked.map((c) => values.get(c.iso2)!)}
            years={years}
            missing={data.countries.length - scale.count}
          />
        </aside>
        <aside className="rail rail-right" aria-label="Country intelligence">
          <CountryDossier
            entity={selected}
            entry={entry}
            reading={scopeReading}
            ranks={ranks}
            indicators={indicators}
            countries={data.countries}
            onSelect={focusCountry}
          />
          <TrendPanel entry={entry} scopeName={scope.name} points={trend} />
          <RankingsPanel
            entry={entry}
            ranked={ranked}
            values={values}
            scale={scale}
            selectedIso={country}
            onSelect={focusCountry}
          />
        </aside>
      </div>
      <details className="data-details">
        <summary>
          <span>About the data</span>
          <span className={status === "failed" ? "stale" : ""}>
            {status === "failed"
              ? "Saved data · refresh unavailable"
              : "Published sources · continuous estimates"}{" "}
            ＋
          </span>
        </summary>
        <div className="methodology">
          <div>
            <h3>Published sources</h3>
            {Object.values(data.sources).map((s) => (
              <p key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label} ↗
                </a>
                <br />
                Release: {s.updatedAt}
              </p>
            ))}
            <p>
              Snapshot: {new Date(data.fetchedAt).toUTCString()}. Source year
              for this selection: {scopeReading?.year ?? "unavailable"}
              {scopeReading?.forecast ? " (forecast)" : ""}. IMF years from{" "}
              {data.forecastFrom} are forecasts. Releases are checked daily;
              this page refreshes every five minutes.
            </p>
          </div>
          <div>
            <h3>How estimates work</h3>
            <p>
              Population uses matching-year population, birth/death rates and
              net migration. Annual flows are spread evenly over the actual UTC
              calendar year. Daily counters reset at UTC midnight. These are
              estimates, not recorded real-time events.
            </p>
            <p>
              GDP is output generated this year. Government debt interpolates
              consecutive year-end gross debt balances, including currency
              valuation effects, and may decrease. Debt clocks are modelled
              estimates, not official real-time debt measurements. CO₂ excludes
              land-use change and forestry.
            </p>
            <p>
              Life expectancy, urban share, inflation and unemployment show the
              latest World Bank observation; values more than five years old are
              historical and left off the map. Year-over-year changes compare
              the two latest annual observations, in percent or percentage
              points (pp); “f” marks an IMF forecast year.
            </p>
          </div>
          <div>
            <h3>Coverage & geography</h3>
            <p>
              Missing values are unavailable, never zero. World totals use
              independently published world aggregates and may differ from
              country sums. Totals use a logarithmic color scale and rates a
              linear one; inflation is linear between the 5th and 90th
              percentiles so outliers share the end colors.
            </p>
            <p>
              Natural Earth boundaries are illustrative. The night-lights layer
              is NASA&apos;s 2016 Black Marble composite served by NASA GIBS;
              the horizon uses the same imagery. Neither is live.
            </p>
            <p>
              <a href="https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets">
                World Bank data terms
              </a>{" "}
              · <a href="https://www.imf.org/external/terms.htm">IMF terms</a> ·{" "}
              <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api">
                NASA GIBS
              </a>
            </p>
          </div>
        </div>
      </details>
      <footer className="ops-footer">
        <span>World Observatory</span>
        <span>Real published data · modelled live estimates · UTC</span>
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  DEFAULT_SELECTION,
  METRICS,
  counterLabel,
  formatMeasure,
  formatNumber,
  measureUnit,
  measuresFor,
  measureValue,
  modelFor,
  normalizedValue,
  parseSelection,
  perSecondFor,
  selectionForMetric,
  utcDay,
} from "../lib/metrics";
import type {
  Dataset,
  Entity,
  MetricModel,
  MetricSelection,
  MetricsResponse,
} from "../lib/metrics-types";
import { validateDataset } from "../lib/providers";
import ThemeToggle from "./ThemeToggle";
import GeographicMap from "./GeographicMap";
import MetricCounter from "./MetricCounter";
import HistoryChart, { COMPARE_COLORS } from "./HistoryChart";

export default function Dashboard({
  initialData,
  referenceTime,
}: {
  initialData: Dataset;
  referenceTime: number;
}) {
  const [data, setData] = useState(initialData);
  const [selection, setSelection] =
    useState<MetricSelection>(DEFAULT_SELECTION);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [refresh, setRefresh] = useState<{ status: string; failed: boolean }>({
    status: "snapshot",
    failed: false,
  });
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(referenceTime);
  useEffect(() => {
    const restore = () => {
      const parsed = parseSelection(
        new URLSearchParams(window.location.search),
        initialData,
      );
      setNow(Date.now());
      setSelection(parsed.selection);
      setSelectedIso(parsed.country);
      setCompare(parsed.compare);
      setUrlReady(true);
    };
    const frame = requestAnimationFrame(restore);
    window.addEventListener("popstate", restore);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", restore);
    };
  }, [initialData]);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("metric", selection.metric);
    url.searchParams.set("view", selection.populationView);
    url.searchParams.set("measure", selection.measure);
    url.searchParams.set("period", selection.period);
    if (selectedIso) url.searchParams.set("country", selectedIso);
    else url.searchParams.delete("country");
    if (compare.length) url.searchParams.set("compare", compare.join(","));
    else url.searchParams.delete("compare");
    window.history.replaceState(null, "", url);
  }, [selection, selectedIso, compare, urlReady]);
  useEffect(() => {
    const controller = new AbortController();
    let active = false;
    const update = async () => {
      if (document.hidden || active) return;
      active = true;
      setNow(Date.now());
      setLoading(true);
      try {
        const response = await fetch("/api/metrics", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Data refresh failed");
        const result: MetricsResponse = await response.json();
        if (!validateDataset(result.dataset))
          throw new Error("Invalid dataset");
        setData((previous) =>
          previous.fetchedAt === result.dataset.fetchedAt
            ? previous
            : result.dataset,
        );
        setRefresh({ status: result.status, failed: result.refreshFailed });
        setNow(Date.now());
      } catch {
        if (!controller.signal.aborted)
          setRefresh((previous) => ({ ...previous, failed: true }));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        active = false;
      }
    };
    void update();
    // Recompute the annual model at UTC midnight, independently of network availability.
    let boundaryTimer: ReturnType<typeof setTimeout>;
    const scheduleBoundary = () => {
      const current = Date.now();
      boundaryTimer = setTimeout(
        () => {
          setNow(Date.now());
          scheduleBoundary();
        },
        utcDay(current) + 86_400_000 - current + 1,
      );
    };
    scheduleBoundary();
    const timer = setInterval(update, 5 * 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.abort();
      clearInterval(timer);
      clearTimeout(boundaryTimer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const metadata = METRICS.find((m) => m.id === selection.metric)!;
  const entities = useMemo(
    () => new Map(data.countries.map((c) => [c.iso2, c])),
    [data],
  );
  const selected = selectedIso ? entities.get(selectedIso) : undefined;
  const current = selected ?? data.world;
  const models = useMemo(
    () =>
      new Map(
        [...data.countries, data.world].map((entity) => [
          entity.iso2,
          modelFor(entity, selection, now, data.forecastFrom),
        ]),
      ),
    [data, selection, now],
  );
  const model = models.get(current.iso2) ?? null;
  const values = useMemo(
    () =>
      new Map(
        data.countries.map((entity) => {
          const model = models.get(entity.iso2);
          return [
            entity.iso2,
            model && !model.historical
              ? measureValue(model, selection, now)
              : null,
          ];
        }),
      ),
    [data, models, selection, now],
  );
  const ranked = useMemo(
    () =>
      [...data.countries].sort(
        (a, b) =>
          (values.get(b.iso2) ?? -Infinity) -
            (values.get(a.iso2) ?? -Infinity) || a.name.localeCompare(b.name),
      ),
    [data, values],
  );
  const filtered = useMemo(
    () =>
      ranked.filter((c) =>
        `${c.name} ${c.iso2} ${c.iso3}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      ),
    [ranked, query],
  );
  const coverage = [...values.values()].filter((v) => v !== null).length;
  const onSelect = useCallback((iso: string | null) => setSelectedIso(iso), []);
  const toggleCompare = (iso: string) =>
    setCompare((previous) =>
      previous.includes(iso)
        ? previous.filter((c) => c !== iso)
        : previous.length < 3
          ? [...previous, iso]
          : previous,
    );
  const compared = compare
    .map((iso) => entities.get(iso))
    .filter((c): c is Entity => !!c);
  const currency = selection.metric === "gdp" || selection.metric === "debt";
  const periodKey =
    selection.metric === "population" &&
    selection.populationView !== "population" &&
    selection.period === "today"
      ? utcDay(now)
      : new Date(now).getUTCFullYear();
  const overview = [
    {
      label: "World population",
      metric: "population",
      view: "population",
      period: "year",
      unit: "people",
    },
    {
      label: "Births today",
      metric: "population",
      view: "births",
      period: "today",
      unit: "since UTC midnight",
    },
    {
      label: "Deaths today",
      metric: "population",
      view: "deaths",
      period: "today",
      unit: "since UTC midnight",
    },
    {
      label: "GDP this year",
      metric: "gdp",
      view: "population",
      period: "year",
      unit: "USD · output generated",
    },
    {
      label: "Government debt",
      metric: "debt",
      view: "population",
      period: "year",
      unit: "USD · gross debt stock",
    },
    {
      label: "CO₂ this year",
      metric: "co2",
      view: "population",
      period: "year",
      unit: "tonnes emitted",
    },
  ] as const;
  const counterKey = `${current.iso2}-${selection.metric}-${selection.populationView}-${selection.period}-${periodKey}`;
  return (
    <main
      className="world-pulse"
      style={
        {
          "--metric-accent": metadata.color,
          "--metric-accent-dark": metadata.darkColor,
        } as CSSProperties
      }
    >
      <header className="site-header">
        <Link className="brand" href="/" aria-label="World Pulse home">
          <span className="brand-mark" aria-hidden="true">
            ✳︎
          </span>
          <span>
            world<span className="brand-light">pulse</span>
            <span className="brand-period">.</span>
          </span>
        </Link>
        <div className="header-caption">
          A world in motion<span>Real data. A living perspective.</span>
        </div>
        <div className="header-actions">
          <span className="live-badge">
            <i /> ESTIMATES IN MOTION
          </span>
          <ThemeToggle />
        </div>
      </header>
      <nav className="metric-nav" aria-label="Statistics">
        {METRICS.map((metric) => (
          <button
            key={metric.id}
            type="button"
            aria-pressed={selection.metric === metric.id}
            onClick={() => {
              setSelection(selectionForMetric(metric.id));
              setQuery("");
            }}
          >
            <span className="nav-index">{metric.short}</span>
            {metric.label}
            <span className="nav-indicator" />
          </button>
        ))}
        <a href="#data-details" className="source-link">
          About the data <span>↗︎</span>
        </a>
      </nav>
      <section className="intro-bar">
        <div>
          <p className="eyebrow">{metadata.eyebrow}</p>
          <h1>{metadata.description}</h1>
        </div>
        <p className="date-stamp">
          GLOBAL OBSERVATORY{" "}
          <span>
            {new Date(now).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
              timeZone: "UTC",
            })}{" "}
            · UTC
          </span>
        </p>
      </section>
      <div className="dashboard-controls">
        <div className="segmented" aria-label="Population statistic">
          {selection.metric === "population" ? (
            (["population", "births", "deaths"] as const).map((view) => (
              <button
                type="button"
                key={view}
                aria-pressed={selection.populationView === view}
                onClick={() =>
                  setSelection((s) => ({ ...s, populationView: view }))
                }
              >
                {view}
              </button>
            ))
          ) : (
            <span className="metric-description">
              {selection.metric === "gdp"
                ? "Nominal GDP · current US dollars"
                : selection.metric === "debt"
                  ? "General government · gross debt"
                  : selection.metric === "homicides"
                    ? "Intentional homicides · UNODC"
                    : "CO₂ · excluding land-use change & forestry"}
            </span>
          )}
        </div>
        <label className="measure-control">
          MAP & RANKING{" "}
          <select
            aria-label="Map and ranking measure"
            value={selection.measure}
            onChange={(e) =>
              setSelection((s) => ({
                ...s,
                measure: e.target.value as MetricSelection["measure"],
              }))
            }
          >
            {measuresFor(selection.metric, selection.populationView).map(
              (m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <section className="explorer" aria-label="Global statistics explorer">
        <div className="summary-panel">
          <div className="scope-row">
            <span className="scope-dot" />
            <span>{selected ? selected.name : "Worldwide"}</span>
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedIso(null)}
                aria-label="Return to world"
              >
                World ↗︎
              </button>
            )}
          </div>
          <div className="counter-header">
            <p className="eyebrow">
              {model?.historical
                ? "Latest historical observation"
                : counterLabel(selection)}
            </p>
            {selection.metric === "population" &&
              selection.populationView !== "population" && (
                <div className="period-switch">
                  {(["today", "year"] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      aria-pressed={selection.period === period}
                      onClick={() => setSelection((s) => ({ ...s, period }))}
                    >
                      {period === "today" ? "Today" : "Year"}
                    </button>
                  ))}
                </div>
              )}
          </div>
          <div className={`hero-counter ${currency ? "is-currency" : ""}`}>
            {currency && model && <span className="currency-sign">$</span>}
            <MetricCounter
              key={counterKey}
              model={model}
              selection={selection}
            />
          </div>
          <div className="counter-unit">
            {currency
              ? "US dollars"
              : selection.metric === "co2"
                ? "tonnes of CO₂"
                : "people"}
            <span>
              {model?.historical
                ? `reported / derived · ${model.year}`
                : "modelled estimate"}
            </span>
          </div>
          <div className="rate-strip">
            <span className="rate-arrow">
              {model && model.annual < 0 ? "↘︎" : "↗︎"}
            </span>
            <strong>
              {model && !model.historical
                ? `${currency ? "$" : ""}${formatNumber(perSecondFor(model, now), false, Math.abs(perSecondFor(model, now)) < 10 ? 2 : 0)}`
                : "—"}
            </strong>
            <span>
              {selection.metric === "co2"
                ? "tonnes"
                : currency
                  ? "USD"
                  : "people"}{" "}
              / second
            </span>
          </div>
          <div className="summary-facts">
            <Fact
              label="Source year"
              value={
                model
                  ? `${model.year}${model.forecast ? " · forecast" : ""}`
                  : "Unavailable"
              }
            />
            <Fact
              label={
                selection.measure === "total"
                  ? "Normalized measure"
                  : "Selected measure"
              }
              value={
                model
                  ? selection.measure === "total"
                    ? `${formatNumber(normalizedValue(model, selection, now), true, 2)} ${model.normalizedUnit}`
                    : `${formatMeasure(measureValue(model, selection, now), selection)} ${measureUnit(selection) === "%" ? "" : measureUnit(selection)}`
                  : "—"
              }
            />
            {model?.populationYear && selection.metric !== "population" && (
              <Fact
                label="Population basis"
                value={`${model.populationYear} observation`}
              />
            )}
          </div>
          <div className="hero-leaders">
            <p className="eyebrow">
              Leading countries · {measureUnit(selection)}
            </p>
            {ranked
              .filter((c) => values.get(c.iso2) != null)
              .slice(0, 5)
              .map((country, index) => (
                <button
                  type="button"
                  key={country.iso2}
                  onClick={() => setSelectedIso(country.iso2)}
                >
                  <span className="leader-index">0{index + 1}</span>
                  <span>{country.name}</span>
                  <strong>
                    {formatMeasure(values.get(country.iso2) ?? null, selection)}
                  </strong>
                </button>
              ))}
          </div>
          <p className="estimate-note">
            <span>ⓘ</span>{" "}
            {model
              ? model.historical
                ? "Historical data is available. Current estimates need more recent or consecutive observations."
                : "A continuous estimate from published annual data. Source releases are refreshed daily."
              : "This source has no matching observations for this country and statistic."}
          </p>
          {selected && (
            <button
              type="button"
              className="compare-action"
              disabled={compare.length >= 3 && !compare.includes(selected.iso2)}
              aria-pressed={compare.includes(selected.iso2)}
              onClick={() => toggleCompare(selected.iso2)}
            >
              {compare.includes(selected.iso2)
                ? "− Remove from comparison"
                : compare.length >= 3
                  ? "Comparison full · remove a country below"
                  : "+ Compare this country"}
            </button>
          )}
        </div>
        <div className="map-panel">
          <div className="map-topline">
            <span>
              <i /> THE GLOBAL PICTURE
            </span>
            <span>{coverage} economies with data</span>
          </div>
          <GeographicMap
            countries={data.countries}
            values={values}
            models={models}
            selection={selection}
            selectedIso={selectedIso}
            compare={compare}
            onSelect={onSelect}
            now={now}
          />
          <div className="map-bottomline">
            <span>Explore a country to look closer</span>
            <span>Drag to pan · Scroll to zoom</span>
          </div>
        </div>
      </section>
      <section
        className="overview-section"
        aria-label="Worldwide live estimates"
      >
        <div className="overview-heading">
          <p className="eyebrow">THE WORLD, RIGHT NOW</p>
          <span>Worldwide · continuously estimated</span>
        </div>
        <div className="live-grid">
          {overview.map((card) => {
            const cardSelection: MetricSelection = {
              metric: card.metric,
              populationView: card.view,
              measure: "total",
              period: card.period,
            };
            const cardModel = modelFor(
              data.world,
              cardSelection,
              now,
              data.forecastFrom,
            );
            return (
              <button
                className={`live-card ${card.metric === "gdp" || card.metric === "debt" ? "economic-card" : ""}`}
                type="button"
                key={card.label}
                onClick={() => {
                  setSelection(cardSelection);
                  setSelectedIso(null);
                  setQuery("");
                }}
              >
                <span className="live-card-label">
                  {card.label}
                  <span aria-hidden="true">↗</span>
                </span>
                <strong>
                  {(card.metric === "gdp" || card.metric === "debt") &&
                  cardModel
                    ? "$"
                    : ""}
                  <MetricCounter
                    model={cardModel}
                    selection={cardSelection}
                    compact={false}
                  />
                </strong>
                <span className="live-card-unit">{card.unit}</span>
                <span className="live-card-source">
                  {cardModel
                    ? `${cardModel.year} source${cardModel.forecast ? " · forecast" : cardModel.historical ? " · historical" : " · estimate"}`
                    : "Unavailable"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="lower-grid">
        <section className="ranking-panel" aria-labelledby="ranking-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Across the world</p>
              <h2 id="ranking-title">
                Country rankings <span>{measureUnit(selection)}</span>
              </h2>
            </div>
            <span className="count-chip">{coverage}</span>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a country or ISO code"
              aria-label="Find a country"
            />
            <span className="search-hint">{filtered.length}</span>
          </label>
          <div className="ranking-columns">
            <span>COUNTRY</span>
            <span>
              {measuresFor(selection.metric, selection.populationView)
                .find((m) => m.id === selection.measure)
                ?.label.toUpperCase()}
            </span>
            <span>PIN</span>
          </div>
          <ol className="country-ranking" aria-label="Country rankings">
            {filtered.map((country) => {
              const value = values.get(country.iso2) ?? null;
              const countryModel = models.get(country.iso2);
              const rank = ranked.indexOf(country) + 1;
              const pinned = compare.includes(country.iso2);
              return (
                <li
                  key={country.iso2}
                  className={selectedIso === country.iso2 ? "is-selected" : ""}
                >
                  <button
                    type="button"
                    className="country-select"
                    aria-pressed={selectedIso === country.iso2}
                    onClick={() => setSelectedIso(country.iso2)}
                  >
                    <span className="rank-position">
                      {value !== null ? String(rank).padStart(2, "0") : "—"}
                    </span>
                    <span className="country-code">{country.iso2}</span>
                    <span className="country-name">
                      {country.name}
                      <small>
                        {countryModel
                          ? `${countryModel.year}${countryModel.historical ? " · historical" : ""}`
                          : "No observations"}
                      </small>
                    </span>
                    <strong>{formatMeasure(value, selection)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pin-button"
                    aria-label={`${pinned ? "Unpin" : "Compare"} ${country.name}`}
                    aria-pressed={pinned}
                    disabled={!pinned && compare.length >= 3}
                    onClick={() => toggleCompare(country.iso2)}
                  >
                    {pinned ? "✓" : "+"}
                  </button>
                </li>
              );
            })}
          </ol>
          {filtered.length === 0 && (
            <p className="empty-note">
              No countries match “{query}”. Try a name or ISO code.
            </p>
          )}
        </section>
        <section
          className="insights-panel"
          aria-label="Country details and context"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {selected ? "Country spotlight" : "Beyond the headline"}
              </p>
              <h2>{selected?.name ?? "A little more context"}</h2>
            </div>
            <span className="outline-globe" aria-hidden="true">
              ◎
            </span>
          </div>
          {selected ? (
            <details className="country-details" open>
              <summary>Explore {selected.name}</summary>
              <div className="spotlight-facts">
                <Fact label="Region" value={selected.region} />
                <Fact
                  label="Annual source figure"
                  value={
                    model
                      ? `${currency ? "$" : ""}${formatNumber(selection.metric === "debt" ? model.end : selection.metric === "population" && selection.populationView === "population" ? model.start : model.annual, true)}`
                      : "Unavailable"
                  }
                />
                <Fact
                  label="Coverage"
                  value={
                    model?.historical
                      ? "Historical only"
                      : model
                        ? "Available for estimates"
                        : "Not available"
                  }
                />
              </div>
              <HistoryChart
                entities={[selected]}
                selection={selection}
                forecastFrom={data.forecastFrom}
                now={now}
              />
            </details>
          ) : (
            <ContextCards
              data={data}
              models={models}
              selection={selection}
              now={now}
            />
          )}
        </section>
      </div>
      <section className="comparison-panel" aria-labelledby="comparison-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Side by side</p>
            <h2 id="comparison-title">
              Compare perspectives <span>{compare.length} / 3 countries</span>
            </h2>
          </div>
          {compare.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setCompare([])}
            >
              Clear comparison ×
            </button>
          )}
        </div>
        {compared.length ? (
          <>
            <div className="compare-cards">
              {compared.map((country, index) => {
                const m = models.get(country.iso2) ?? null;
                return (
                  <article
                    key={country.iso2}
                    style={
                      {
                        "--comparison-color": COMPARE_COLORS[index],
                      } as CSSProperties
                    }
                  >
                    <div className="compare-country">
                      <span className="comparison-dot" />
                      <h3>{country.name}</h3>
                      <button
                        type="button"
                        aria-label={`Remove ${country.name} from comparison`}
                        onClick={() => toggleCompare(country.iso2)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="compare-number">
                      {formatMeasure(
                        m && !m.historical
                          ? measureValue(m, selection, now)
                          : null,
                        selection,
                      )}
                    </div>
                    <p>
                      {measureUnit(selection)} ·{" "}
                      {m
                        ? `${m.year}${m.forecast ? " forecast" : m.historical ? " historical" : " source"}`
                        : "Unavailable"}
                    </p>
                    <Fact
                      label="Normalized"
                      value={
                        m
                          ? `${formatNumber(normalizedValue(m, selection, now), false, 2)} ${m.normalizedUnit}`
                          : "—"
                      }
                    />
                    {m?.populationYear && selection.metric !== "population" && (
                      <Fact
                        label="Population basis"
                        value={String(m.populationYear)}
                      />
                    )}
                  </article>
                );
              })}
            </div>
            <HistoryChart
              entities={compared}
              selection={selection}
              forecastFrom={data.forecastFrom}
              now={now}
            />
          </>
        ) : (
          <div className="comparison-empty">
            <span aria-hidden="true">⊕</span>
            <p>
              Different places. Shared perspective.
              <small>
                Pin up to three countries from the rankings or country details
                to compare their data and annual history.
              </small>
            </p>
            <span className="empty-pins" aria-hidden="true">
              ＋ <span>＋</span> ＋
            </span>
          </div>
        )}
      </section>
      <details className="data-details" id="data-details">
        <summary>
          <span>
            <i className={`data-status ${refresh.failed ? "is-stale" : ""}`} />
            {loading
              ? "Checking source releases…"
              : refresh.failed
                ? "Using saved data · refresh unavailable"
                : "Real sources. Transparent estimates."}
          </span>
          <span>
            Data & methodology <b>＋</b>
          </span>
        </summary>
        <div className="methodology">
          <div>
            <h3>Where the numbers come from</h3>
            <p>
              <a
                href={data.sources.worldbank.url}
                target="_blank"
                rel="noreferrer"
              >
                {data.sources.worldbank.label} ↗︎
              </a>
              <br />
              Release updated {data.sources.worldbank.updatedAt}. Population,
              birth/death rates, annual net migration, UNODC intentional
              homicide rates, and CO₂ emissions.
            </p>
            <p>
              <a href={data.sources.imf.url} target="_blank" rel="noreferrer">
                {data.sources.imf.label} ↗︎
              </a>
              <br />
              GDP and general-government gross debt. Years from{" "}
              {data.forecastFrom} are IMF forecasts; dashed chart segments
              identify them.
            </p>
            <p>
              Snapshot fetched {new Date(data.fetchedAt).toUTCString()}.{" "}
              {refresh.status === "snapshot"
                ? "Bundled verified snapshot."
                : "Cached provider release."}{" "}
              Upstream checks run at most daily; this page checks the cache
              every five minutes while visible.
            </p>
          </div>
          <div>
            <h3>How the estimates move</h3>
            <p>
              Population is projected from matching-year population, birth/death
              rates, and net migration. Annual flows are spread evenly over the
              actual UTC calendar year; daily counters reset at UTC midnight.
              These are estimates, not recorded real-time events.
            </p>
            <p>
              GDP measures output generated this year. Debt interpolates
              consecutive year-end balances derived from matching-release GDP
              and debt-to-GDP. USD-equivalent debt changes include valuation
              effects and may decrease.
            </p>
            <p>
              Homicide counts are derived from reported rates and same-year
              population. Observations older than five years are historical
              only. CO₂ excludes land-use change and forestry and is measured in
              tonnes.
            </p>
          </div>
          <div>
            <h3>Coverage & comparisons</h3>
            <p>
              {coverage} of {data.countries.length} economies have usable data
              for the selected map measure. Missing values appear as
              unavailable, never as zero. World figures use published world
              aggregates; regional aggregates are excluded from country
              rankings.
            </p>
            <p>
              Map shading is logarithmic for totals and linear for normalized
              measures. Rates and per-person measures can change the order of
              rankings substantially. Per-person economic comparisons use the
              most recent available population observation, shown in the source
              data.
            </p>
            <p>
              Country boundaries use Natural Earth geographic data. Chart values
              are annual source observations or labeled IMF forecasts.
            </p>
          </div>
        </div>
      </details>
      <footer className="site-footer">
        <span className="footer-brand">
          worldpulse<span>.</span>
        </span>
        <p>One planet. Many perspectives.</p>
        <span>
          BUILT ON OPEN DATA <span aria-hidden="true">↗︎</span>
        </span>
      </footer>
    </main>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function ContextCards({
  data,
  models,
  selection,
  now,
}: {
  data: Dataset;
  models: Map<string, MetricModel | null>;
  selection: MetricSelection;
  now: number;
}) {
  const model = models.get("WORLD");
  const isPopulation = selection.metric === "population";
  const matchingModels = data.countries
    .map((c) => ({ country: c, model: models.get(c.iso2) }))
    .filter(
      (entry): entry is { country: Entity; model: MetricModel } =>
        !!entry.model && !entry.model.historical,
    );
  const largest = matchingModels.sort(
    (a, b) =>
      (measureValue(b.model, selection, now) ?? -Infinity) -
      (measureValue(a.model, selection, now) ?? -Infinity),
  )[0];
  return (
    <div className="context-cards">
      <article>
        <span className="context-icon" aria-hidden="true">
          ↗︎
        </span>
        <p>{isPopulation ? "A changing population" : "The scale of a year"}</p>
        <strong>
          {model
            ? `${selection.metric === "gdp" || selection.metric === "debt" ? "$" : ""}${formatNumber(model.annual, true)}`
            : "—"}
        </strong>
        <small>
          {selection.metric === "debt"
            ? "Estimated change in USD equivalent this year"
            : isPopulation && selection.populationView === "population"
              ? "Estimated net population change per year"
              : `Annual ${selection.metric === "gdp" ? "GDP" : selection.metric === "co2" ? "emissions in tonnes" : selection.metric === "homicides" ? "homicides, derived from reported rate" : selection.populationView}`}
        </small>
      </article>
      <article>
        <span className="context-icon" aria-hidden="true">
          ◎
        </span>
        <p>Leading the selected measure</p>
        <strong className="context-country">
          {largest?.country.name ?? "Unavailable"}
        </strong>
        <small>
          {largest
            ? `${formatMeasure(measureValue(largest.model, selection, now), selection)} ${measureUnit(selection)} · source ${largest.model.year}`
            : "Select another measure to explore coverage"}
        </small>
      </article>
      <div className="context-quote">
        <span aria-hidden="true">↔</span>
        <p>
          A total tells one story.
          <br />
          <strong>A rate tells another.</strong>
          <small>
            Switch the map measure to see the world from a different
            perspective.
          </small>
        </p>
      </div>
    </div>
  );
}

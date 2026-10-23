"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMeasure,
  formatNumber,
  modelFor,
  parseSelection,
  perSecondFor,
  utcDay,
  valueAt,
} from "../lib/metrics";
import {
  COUNTERS,
  normalizeSelection,
  COUNTRY_COLORS,
} from "../lib/observatory";
import type {
  Dataset,
  MetricSelection,
  MetricsResponse,
} from "../lib/metrics-types";
import { validateDataset } from "../lib/providers";
import MetricCounter from "./MetricCounter";
import GeographicMap from "./GeographicMap";
import ThemeToggle from "./ThemeToggle";

export default function Dashboard({
  initialData,
  referenceTime,
}: {
  initialData: Dataset;
  referenceTime: number;
}) {
  const [data, setData] = useState(initialData);
  const [selection, setSelection] = useState<MetricSelection>(
    COUNTERS[0].selection,
  );
  const [country, setCountry] = useState<string | null>(null);
  const [now, setNow] = useState(referenceTime);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const restore = () => {
      const parsed = parseSelection(
        new URLSearchParams(location.search),
        initialData,
      );
      setSelection(normalizeSelection(parsed.selection));
      setCountry(parsed.country);
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
    for (const [key, value] of Object.entries({
      metric: selection.metric,
      view: selection.populationView,
      period: selection.period,
      measure: "total",
    }))
      url.searchParams.set(key, value);
    url.searchParams.delete("compare");
    if (country) url.searchParams.set("country", country);
    else url.searchParams.delete("country");
    history.replaceState(null, "", url);
  }, [selection, country, ready]);
  useEffect(() => {
    const controller = new AbortController();
    let active = false;
    const refresh = async () => {
      if (document.hidden || active) return;
      active = true;
      setNow(Date.now());
      try {
        const response = await fetch("/api/metrics", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Refresh failed");
        const result: MetricsResponse = await response.json();
        if (!validateDataset(result.dataset))
          throw new Error("Invalid dataset");
        if (!controller.signal.aborted) {
          setData((previous) =>
            previous.fetchedAt === result.dataset.fetchedAt
              ? previous
              : result.dataset,
          );
          setFailed(result.refreshFailed);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        active = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 300_000);
    // Rankings share the displayed counter's period and catch calendar boundaries.
    const tick = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const currentCard = COUNTERS.find(
    (c) =>
      c.selection.metric === selection.metric &&
      c.selection.populationView === selection.populationView,
  )!;
  const selected = data.countries.find((c) => c.iso2 === country);
  const modelDay = utcDay(now);
  const overviewModels = useMemo(
    () =>
      COUNTERS.map((card) =>
        modelFor(data.world, card.selection, modelDay, data.forecastFrom),
      ),
    [data, modelDay],
  );
  const models = useMemo(
    () =>
      new Map(
        [...data.countries, data.world].map((c) => [
          c.iso2,
          modelFor(c, selection, modelDay, data.forecastFrom),
        ]),
      ),
    [data, selection, modelDay],
  );
  const values = useMemo(
    () =>
      new Map(
        data.countries.map((c) => {
          const m = models.get(c.iso2);
          return [
            c.iso2,
            m && !m.historical ? valueAt(m, selection, now) : null,
          ];
        }),
      ),
    [data, models, selection, now],
  );
  const ranked = useMemo(
    () =>
      data.countries
        .filter((c) => values.get(c.iso2) != null)
        .sort((a, b) => values.get(b.iso2)! - values.get(a.iso2)!),
    [data, values],
  );
  const leaders = ranked.slice(0, 7);
  const colors = useMemo(
    () => new Map(leaders.map((c, i) => [c.iso2, COUNTRY_COLORS[i]])),
    [leaders],
  );
  const model = models.get(selected?.iso2 ?? data.world.iso2) ?? null;
  const onSelect = useCallback((iso: string | null) => setCountry(iso), []);
  const results = query.trim()
    ? data.countries
        .filter((c) =>
          `${c.name} ${c.iso2} ${c.iso3}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const periodKey =
    selection.period === "today" ? utcDay(now) : new Date(now).getUTCFullYear();
  const currency = selection.metric === "gdp" || selection.metric === "debt";
  return (
    <main className="observatory">
      <header className="site-header">
        <Link className="brand" href="/">
          ◉ <span>WORLD OBSERVATORY</span>
        </Link>
        <div className="header-actions">
          <span className="live-badge">
            <i /> LIVE ESTIMATES
          </span>
          <ThemeToggle />
        </div>
      </header>
      <section className="explorer" aria-label="World statistics explorer">
        <div className="summary-panel">
          <div className="scope-row">
            <span>{selected?.name ?? "Worldwide"}</span>
            {selected && (
              <button onClick={() => setCountry(null)}>← Back to world</button>
            )}
          </div>
          <h1>{currentCard.label}</h1>
          <div className={`hero-counter ${currency ? "is-currency" : ""}`}>
            {currency && model ? "$" : ""}
            <MetricCounter
              key={`${country}-${currentCard.id}-${periodKey}`}
              model={model}
              selection={selection}
            />
          </div>
          <p className="counter-unit">
            {currentCard.unit}{" "}
            <span>
              ·{" "}
              {model?.historical
                ? `Historical observation, ${model.year}`
                : "modelled estimate"}
            </span>
          </p>
          <div className="rate-strip">
            {model && !model.historical ? (
              <>
                <strong>
                  {formatNumber(
                    perSecondFor(model, now),
                    false,
                    Math.abs(perSecondFor(model, now)) < 10 ? 2 : 0,
                  )}
                </strong>
                <span>
                  {currency
                    ? "USD"
                    : selection.metric === "co2"
                      ? "tonnes"
                      : "people"}{" "}
                  / second
                </span>
              </>
            ) : (
              <span>
                {model
                  ? "Historical data · no current estimate"
                  : "Data unavailable for this country"}
              </span>
            )}
          </div>
          <div className="hero-leaders">
            <h2>
              TOP COUNTRIES <span>{currentCard.period}</span>
            </h2>
            {leaders.map((c, i) => (
              <button
                key={c.iso2}
                onClick={() => setCountry(c.iso2)}
                aria-pressed={country === c.iso2}
              >
                <i style={{ background: COUNTRY_COLORS[i] }} />
                <span
                  className="leader-code"
                  style={{ color: COUNTRY_COLORS[i] }}
                >
                  {c.iso2}
                </span>
                <span className="leader-name">{c.name}</span>
                <strong>{formatMeasure(values.get(c.iso2)!, selection)}</strong>
              </button>
            ))}
          </div>
          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a country"
              aria-label="Find a country"
            />
          </label>
          {query.trim() && (
            <div className="search-results" aria-label="Country search results">
              {results.length ? (
                results.map((c) => (
                  <button
                    key={c.iso2}
                    onClick={() => {
                      setCountry(c.iso2);
                      setQuery("");
                    }}
                  >
                    {c.name}
                    <span>{c.iso2}</span>
                  </button>
                ))
              ) : (
                <p>No countries found.</p>
              )}
            </div>
          )}
        </div>
        <div className="map-panel">
          <div className="map-topline">
            <span>
              {currentCard.label.toUpperCase()}{" "}
              <b> / {currentCard.period.toUpperCase()}</b>
            </span>
            <span>{ranked.length} countries with estimates</span>
          </div>
          <GeographicMap
            countries={data.countries}
            models={models}
            values={values}
            selection={selection}
            selectedIso={country}
            colors={colors}
            onSelect={onSelect}
            now={now}
          />
          <p className="map-caption">
            Drag to explore · Scroll to zoom · Click a country
            <span>
              Colors identify top countries. Dots are geography, not events.
            </span>
          </p>
        </div>
      </section>
      <section
        className="overview-section"
        aria-label="Worldwide live estimates"
      >
        <div className="section-heading">
          <h2>THE WORLD, IN MOTION</h2>
          <span>Worldwide · select a statistic to explore</span>
        </div>
        <div className="live-grid">
          {COUNTERS.map((card, index) => {
            const m = overviewModels[index];
            return (
              <button
                className={`live-card ${["gdp", "debt"].includes(card.id) ? "economic-card" : ""} ${card.id === currentCard.id ? "active" : ""}`}
                aria-pressed={card.id === currentCard.id}
                key={card.id}
                onClick={() => {
                  setSelection(card.selection);
                  setCountry(null);
                  setQuery("");
                }}
              >
                <span className="live-card-label">
                  {card.label}
                  <span>↗</span>
                </span>
                <strong>
                  {m && ["gdp", "debt"].includes(card.selection.metric)
                    ? "$"
                    : ""}
                  <MetricCounter
                    key={`${card.id}-${card.selection.period === "today" ? modelDay : new Date(now).getUTCFullYear()}`}
                    model={m}
                    selection={card.selection}
                  />
                </strong>
                <span className="live-card-unit">
                  {card.unit} · {card.period}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <details className="data-details">
        <summary>
          <span>About the data</span>
          <span className={failed ? "stale" : ""}>
            {failed
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
              for this selection: {model?.year ?? "unavailable"}
              {model?.forecast ? " (forecast)" : ""}. IMF years from{" "}
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
              valuation effects, and may decrease. CO₂ is measured in tonnes and
              excludes land-use change and forestry.
            </p>
          </div>
          <div>
            <h3>Coverage & geography</h3>
            <p>
              Missing values are unavailable, never zero. Older observations
              remain historical. World totals use independently published world
              aggregates and may differ from country sums.
            </p>
            <p>
              Natural Earth boundaries are illustrative. Square dots describe
              land, not locations of births, deaths, or emissions. Country
              colors match the top-country list. Small islands use locator
              rings.
            </p>
            <p>
              <a href="https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets">
                World Bank data terms
              </a>{" "}
              · <a href="https://www.imf.org/external/terms.htm">IMF terms</a>
            </p>
          </div>
        </div>
      </details>
      <footer>
        <span>WORLD OBSERVATORY</span>
        <span>One planet. Continuously changing.</span>
        <span>OPEN DATA / UTC</span>
      </footer>
    </main>
  );
}

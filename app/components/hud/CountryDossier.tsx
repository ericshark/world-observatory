"use client";

import { useState } from "react";
import {
  formatEntry,
  type CatalogEntry,
  type Reading,
} from "../../lib/catalog";
import type { Entity } from "../../lib/metrics-types";
import HudPanel from "./HudPanel";

export interface DossierIndicator {
  entry: CatalogEntry;
  reading: Reading | null;
  /** Share of countries at or below this value, 0–1; null for the world. */
  percentile: number | null;
}
export interface DossierRanks {
  global: { rank: number; of: number } | null;
  regional: { rank: number; of: number; region: string } | null;
  share: number | null;
  /** Countries with a current value for the active signal. */
  coverage: number;
}

function CountrySearch({
  countries,
  onSelect,
}: {
  countries: Entity[];
  onSelect: (iso: string) => void;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const results = term
    ? countries
        .filter((c) =>
          `${c.name} ${c.iso2} ${c.iso3}`.toLowerCase().includes(term),
        )
        .slice(0, 6)
    : [];
  return (
    <div className="target-search">
      <label>
        <span aria-hidden="true">⌖</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              onSelect(results[0].iso2);
              setQuery("");
            }
          }}
          placeholder="Acquire target · country or ISO"
          aria-label="Find a country"
        />
      </label>
      {term && (
        <div className="search-results" aria-label="Country search results">
          {results.length ? (
            results.map((c) => (
              <button
                key={c.iso2}
                onClick={() => {
                  onSelect(c.iso2);
                  setQuery("");
                }}
              >
                {c.name}
                <span>{c.iso3}</span>
              </button>
            ))
          ) : (
            <p>No countries found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CountryDossier({
  entity,
  entry,
  reading,
  ranks,
  indicators,
  countries,
  onSelect,
}: {
  entity: Entity | null;
  entry: CatalogEntry;
  reading: Reading | null;
  ranks: DossierRanks;
  indicators: DossierIndicator[];
  countries: Entity[];
  onSelect: (iso: string | null) => void;
}) {
  return (
    <HudPanel
      code="04"
      title="Target dossier"
      tone="magenta"
      order={0}
      className="dossier-panel"
      actions={
        entity ? (
          <button className="hud-button" onClick={() => onSelect(null)}>
            ← World
          </button>
        ) : (
          <span className="hud-meta">Global scope</span>
        )
      }
    >
      <CountrySearch countries={countries} onSelect={onSelect} />
      <div className="dossier-id">
        <span className="dossier-code">{entity?.iso3 ?? "WLD"}</span>
        <span>
          <strong>{entity?.name ?? "World"}</strong>
          <small>{entity?.region ?? "All reporting economies"}</small>
        </span>
      </div>
      <dl className="dossier-ranks">
        <div>
          <dt>{entry.short}</dt>
          <dd>{formatEntry(entry, reading?.value ?? null)}</dd>
        </div>
        {entity ? (
          <>
            <div>
              <dt>Global rank</dt>
              <dd>
                {ranks.global ? (
                  <>
                    #{ranks.global.rank}
                    <small>/{ranks.global.of}</small>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Regional rank</dt>
              <dd>
                {ranks.regional ? (
                  <>
                    #{ranks.regional.rank}
                    <small>/{ranks.regional.of}</small>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Coverage</dt>
            <dd>
              {ranks.coverage}
              <small> countries</small>
            </dd>
          </div>
        )}
        {entry.additive && entity && (
          <div>
            <dt>Share of world</dt>
            <dd>
              {ranks.share === null
                ? "—"
                : `${(ranks.share * 100).toFixed(ranks.share < 0.01 ? 2 : 1)}%`}
            </dd>
          </div>
        )}
      </dl>
      <ul className="dossier-grid" aria-label="Key indicators">
        {indicators.map(({ entry: item, reading: value, percentile }) => (
          <li key={item.id} className={item.id === entry.id ? "is-active" : ""}>
            <span>{item.short}</span>
            <strong>{formatEntry(item, value?.value ?? null)}</strong>
            <small>
              {value?.year
                ? `${value.year}${value.forecast ? " f" : ""}${value.historical ? " hist." : ""}`
                : "n/a"}
            </small>
            {percentile !== null && (
              <i
                className="percentile"
                style={{ width: `${Math.max(2, percentile * 100)}%` }}
                title={`Higher than or equal to ${Math.round(percentile * 100)}% of countries`}
              />
            )}
          </li>
        ))}
      </ul>
      {entity && (
        <p className="dossier-note">
          Bars show percentile among countries with current data.
        </p>
      )}
    </HudPanel>
  );
}

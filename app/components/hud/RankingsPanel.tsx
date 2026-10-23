"use client";

import { useState } from "react";
import { formatEntry, type CatalogEntry } from "../../lib/catalog";
import type { HeatScale } from "../../lib/heat-map";
import type { Entity } from "../../lib/metrics-types";
import HudPanel from "./HudPanel";

const SIZE = 10;

export default function RankingsPanel({
  entry,
  ranked,
  values,
  scale,
  selectedIso,
  onSelect,
}: {
  entry: CatalogEntry;
  /** Countries with current values, highest first. */
  ranked: Entity[];
  values: Map<string, number | null>;
  scale: HeatScale;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
}) {
  const [end, setEnd] = useState<"top" | "bottom">("top");
  const rows =
    end === "top"
      ? ranked.slice(0, SIZE).map((c, i) => ({ country: c, rank: i + 1 }))
      : ranked
          .slice(-SIZE)
          .reverse()
          .map((c, i) => ({ country: c, rank: ranked.length - i }));
  return (
    <HudPanel
      code="06"
      title="Rankings"
      tone="magenta"
      order={2}
      className="rankings-panel"
      actions={
        <div className="hud-toggle" role="group" aria-label="Ranking end">
          {(["top", "bottom"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={end === value}
              onClick={() => setEnd(value)}
            >
              {value === "top" ? "Top" : "Bottom"} {SIZE}
            </button>
          ))}
        </div>
      }
    >
      {rows.length ? (
        <ol className="rank-list">
          {rows.map(({ country, rank }) => {
            const value = values.get(country.iso2) ?? null;
            return (
              <li key={country.iso2}>
                <button
                  aria-pressed={country.iso2 === selectedIso}
                  onClick={() => onSelect(country.iso2)}
                >
                  <span className="rank-number">
                    {String(rank).padStart(2, "0")}
                  </span>
                  <span className="rank-name">{country.name}</span>
                  <strong>{formatEntry(entry, value)}</strong>
                  <i
                    className="rank-bar"
                    style={{
                      width: `${value === null ? 0 : Math.max(3, scale.position(value) * 100)}%`,
                      background: scale.color(value) ?? undefined,
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty-note">No countries have current data.</p>
      )}
      <p className="rank-note">
        Ranked by {entry.short.toLowerCase()} · {ranked.length} countries · bars
        use the map scale
      </p>
    </HudPanel>
  );
}

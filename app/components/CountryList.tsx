"use client";

import { countries, HIGHLIGHTED_COUNT } from "../data/countries";
import { formatSignedRate } from "../lib/format";
import { netChangePerYear, perSecond, populationAt } from "../lib/population";
import { Live, seriesColor } from "./Live";

const mostPopulous = countries.slice(0, HIGHLIGHTED_COUNT);

export default function CountryList({
  selectedIso,
  onSelect,
}: {
  selectedIso: string | null;
  onSelect: (iso: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="my-0 text-sm font-medium uppercase tracking-tight text-ink-secondary">
        Most populous countries
      </h2>
      <ul className="m-0 list-none space-y-0.5 pl-0">
        {mostPopulous.map((country) => {
          const selected = country.iso2 === selectedIso;
          return (
            <li key={country.iso2}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${country.name}: show details`}
                onClick={() => onSelect(selected ? null : country.iso2)}
                className={`-mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center rounded px-1.5 py-0.5 text-left transition-colors hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-ink md:w-auto ${
                  selected ? "bg-card-hover" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  style={{ color: seriesColor(country.seriesSlot) }}
                >
                  ■
                </span>
                <span className="w-[3ch] font-medium">
                  &nbsp;{country.iso2}
                </span>
                <Live
                  value={(now) => populationAt(country, now)}
                  className="w-[16ch] text-right"
                />
                <span className="ml-auto w-[9ch] text-right text-ink-secondary tabular-nums">
                  {formatSignedRate(perSecond(netChangePerYear(country)))}
                  <span aria-label="per second">/s</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

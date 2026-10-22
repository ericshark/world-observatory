"use client";

import { useEffect } from "react";
import type { Country } from "../data/countries";
import {
  formatPercent,
  formatRate,
  formatSignedInteger,
  formatSignedRate,
} from "../lib/format";
import {
  countBetween,
  growthRatePercent,
  netChangePerYear,
  perSecond,
  populationAt,
  startOfLocalDay,
  world,
} from "../lib/population";
import { BirthGlyph, DeathGlyph, Live, seriesColor } from "./Live";

export default function CountryPanel({
  country,
  onClose,
}: {
  country: Country;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section aria-label={`${country.name} details`} className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="my-0 flex items-center gap-1.5 text-sm font-medium uppercase tracking-tight text-ink-secondary">
          <span
            aria-hidden="true"
            style={{ color: seriesColor(country.seriesSlot) }}
          >
            ■
          </span>
          <span className="text-ink">{country.iso2}</span> {country.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded border border-border px-1.5 text-xs uppercase text-ink-secondary transition-colors hover:bg-card-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Esc · World
        </button>
      </div>

      <div className="text-4xl tracking-normal md:text-5xl">
        <Live value={(now) => populationAt(country, now)} />
      </div>

      <dl className="m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums sm:w-fit">
        <Row label="Share of world">
          <Live
            value={(now) =>
              (populationAt(country, now) / populationAt(world, now)) * 100
            }
            format={(share) => `${share.toFixed(2)}%`}
          />
        </Row>
        <Row label="Growth">{formatPercent(growthRatePercent(country))}/yr</Row>
        <Row label="Net change">
          {formatSignedRate(perSecond(netChangePerYear(country)))}/s
        </Row>
        <Row
          label="Births"
          glyph={<BirthGlyph color={seriesColor(country.seriesSlot)} />}
        >
          {formatRate(perSecond(country.birthsPerYear))}/s
        </Row>
        <Row label="Deaths" glyph={<DeathGlyph />}>
          {formatRate(perSecond(country.deathsPerYear))}/s
        </Row>
        <Row label="Born today">
          <Live
            value={(now) =>
              countBetween(country.birthsPerYear, startOfLocalDay(now), now)
            }
          />
        </Row>
        <Row label="Net migration">
          {formatSignedInteger(country.netMigrationPerYear)}/yr
        </Row>
      </dl>
    </section>
  );
}

function Row({
  label,
  glyph,
  children,
}: {
  label: string;
  glyph?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="flex items-center gap-1.5 uppercase text-ink-secondary">
        {glyph}
        {label}
      </dt>
      <dd className="m-0 text-right">{children}</dd>
    </>
  );
}

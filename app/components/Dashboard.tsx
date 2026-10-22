"use client";

import { useCallback, useState } from "react";
import { countriesByIso } from "../data/countries";
import { useNow } from "../lib/clock";
import CountryList from "./CountryList";
import CountryPanel from "./CountryPanel";
import DottedMap from "./DottedMap";
import ThemeToggle from "./ThemeToggle";
import WorldCounter from "./WorldCounter";

export default function Dashboard() {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const selected = selectedIso ? countriesByIso.get(selectedIso) : undefined;
  const clearSelection = useCallback(() => setSelectedIso(null), []);

  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4 text-sm uppercase xl:text-base">
        <h1 className="my-0 text-sm font-normal text-ink xl:text-base">
          World population, live
          <span className="block text-ink-secondary">
            [<TodayStamp />]
          </span>
        </h1>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(340px,400px)_1fr] lg:items-end lg:gap-6">
        <section
          aria-label="Live counters"
          className="flex flex-col gap-y-8 lg:pb-8"
        >
          <div className="lg:min-h-[124px]">
            {selected ? (
              <CountryPanel country={selected} onClose={clearSelection} />
            ) : (
              <WorldCounter />
            )}
          </div>
          <CountryList selectedIso={selectedIso} onSelect={setSelectedIso} />
        </section>

        <DottedMap selectedIso={selectedIso} onSelect={setSelectedIso} />
      </div>
    </>
  );
}

function TodayStamp() {
  const now = useNow();
  if (now === null) return <span className="text-ink-muted">--.--.--</span>;
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  const [year, month, day] = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ];
  return (
    <time dateTime={`${year}-${month}-${day}`}>
      {`${month}.${day}.${pad(year % 100)}`}
    </time>
  );
}

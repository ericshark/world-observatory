"use client";

import { largestCities } from "../data/cities";
import { countries } from "../data/countries";
import {
  formatCompact,
  formatPercent,
  formatRate,
  formatSignedInteger,
} from "../lib/format";
import {
  countBetween,
  growthRatePercent,
  netChangePerYear,
  perSecond,
  startOfLocalDay,
  startOfLocalYear,
  world,
} from "../lib/population";
import { Live } from "./Live";
import StatCard, { MetricRow } from "./StatCard";

// Tiny states swing to extreme rates on small absolute numbers, so rankings start at one million people.
const RANKING_MIN_POPULATION = 1_000_000;
const rankable = countries.filter(
  (c) => c.population2025 >= RANKING_MIN_POPULATION,
);

const fastestGrowing = [...rankable]
  .sort((a, b) => growthRatePercent(b) - growthRatePercent(a))
  .slice(0, 5);
const fastestShrinking = [...rankable]
  .sort((a, b) => growthRatePercent(a) - growthRatePercent(b))
  .slice(0, 3);
const migrationGains = [...countries]
  .sort((a, b) => b.netMigrationPerYear - a.netMigrationPerYear)
  .slice(0, 3);
const migrationLosses = [...countries]
  .sort((a, b) => a.netMigrationPerYear - b.netMigrationPerYear)
  .slice(0, 3);

const worldNetPerYear = netChangePerYear(world);

function FlowCard({
  title,
  perYear,
  info,
  signed = false,
}: {
  title: string;
  perYear: number;
  info: string;
  signed?: boolean;
}) {
  const format = signed ? formatSignedInteger : undefined;
  return (
    <StatCard title={title} info={info}>
      <div className="text-3xl tracking-normal md:text-4xl">
        <Live
          value={(now) => countBetween(perYear, startOfLocalDay(now), now)}
          format={format}
        />
      </div>
      <p className="m-0 mt-1 text-sm text-ink-secondary">
        Today, since local midnight
      </p>
      <ul className="m-0 mt-4 list-none space-y-1 pl-0">
        <MetricRow label="This year">
          <Live
            value={(now) => countBetween(perYear, startOfLocalYear(now), now)}
            format={format}
          />
        </MetricRow>
        <MetricRow label="Per second">
          {signed ? "+" : ""}
          {formatRate(perSecond(perYear))}
        </MetricRow>
      </ul>
    </StatCard>
  );
}

function CountryRankRow({
  name,
  iso2,
  value,
}: {
  name: string;
  iso2: string;
  value: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-x-3 text-sm">
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink">{iso2}</span>{" "}
        <span className="text-ink-secondary">{name}</span>
      </span>
      <span className="shrink-0 text-ink tabular-nums">{value}</span>
    </li>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 mb-1 text-xs font-normal uppercase text-ink-muted">
      {children}
    </h3>
  );
}

export default function StatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:grid-cols-3">
      <FlowCard
        title="Births"
        perYear={world.birthsPerYear}
        info={`About ${formatCompact(world.birthsPerYear)} babies are born each year, roughly ${formatRate(perSecond(world.birthsPerYear))} every second. Counts are spread evenly through the year; real births vary by season and time of day.`}
      />
      <FlowCard
        title="Deaths"
        perYear={world.deathsPerYear}
        info={`About ${formatCompact(world.deathsPerYear)} people die each year, roughly ${formatRate(perSecond(world.deathsPerYear))} every second. Like births, deaths are modelled at a constant annual rate.`}
      />
      <FlowCard
        title="Net growth"
        perYear={worldNetPerYear}
        signed
        info={`Births minus deaths. Migration moves people between countries but cancels out worldwide. The world grows by about ${formatPercent(growthRatePercent(world))} a year, slower than at any time since the 1950s.`}
      />

      <StatCard
        title="Fastest growing"
        info="Annual population growth from births, deaths and net migration, for countries above one million people. The fastest growth is concentrated in Sub-Saharan Africa, where fertility remains high."
      >
        <SubHeading>Growth per year</SubHeading>
        <ul className="m-0 list-none space-y-1 pl-0">
          {fastestGrowing.map((c) => (
            <CountryRankRow
              key={c.iso2}
              iso2={c.iso2}
              name={c.name}
              value={formatPercent(growthRatePercent(c))}
            />
          ))}
        </ul>
        <div className="mt-3">
          <SubHeading>Shrinking fastest</SubHeading>
          <ul className="m-0 list-none space-y-1 pl-0">
            {fastestShrinking.map((c) => (
              <CountryRankRow
                key={c.iso2}
                iso2={c.iso2}
                name={c.name}
                value={formatPercent(growthRatePercent(c))}
              />
            ))}
          </ul>
        </div>
      </StatCard>

      <StatCard
        title="Net migration"
        info="People arriving minus people leaving each year. Positive figures mean a country gains residents through migration; negative figures mean it loses them."
      >
        <SubHeading>Largest gains per year</SubHeading>
        <ul className="m-0 list-none space-y-1 pl-0">
          {migrationGains.map((c) => (
            <CountryRankRow
              key={c.iso2}
              iso2={c.iso2}
              name={c.name}
              value={formatSignedInteger(c.netMigrationPerYear)}
            />
          ))}
        </ul>
        <div className="mt-3">
          <SubHeading>Largest losses per year</SubHeading>
          <ul className="m-0 list-none space-y-1 pl-0">
            {migrationLosses.map((c) => (
              <CountryRankRow
                key={c.iso2}
                iso2={c.iso2}
                name={c.name}
                value={formatSignedInteger(c.netMigrationPerYear)}
              />
            ))}
          </ul>
        </div>
      </StatCard>

      <StatCard
        title="Largest cities"
        info="UN World Urbanization Prospects 2025 measures cities with one consistent definition of contiguous urban area, so these figures differ from city-limit counts. The ten largest are marked ▲ on the map."
      >
        <ol className="m-0 list-none space-y-1 pl-0">
          {largestCities.slice(0, 7).map((city, index) => (
            <li
              key={city.name}
              className="flex items-baseline justify-between gap-x-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-ink-muted tabular-nums">
                  {index + 1}.
                </span>{" "}
                <span className="text-ink">{city.name}</span>{" "}
                <span className="text-ink-secondary">{city.iso2}</span>
              </span>
              <span className="shrink-0 text-ink tabular-nums">
                {formatCompact(city.population)}
              </span>
            </li>
          ))}
        </ol>
      </StatCard>
    </div>
  );
}

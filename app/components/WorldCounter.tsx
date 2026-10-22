"use client";

import { formatRate, formatSignedRate } from "../lib/format";
import {
  netChangePerYear,
  perSecond,
  populationAt,
  world,
} from "../lib/population";
import { BirthGlyph, DeathGlyph, Live } from "./Live";

export default function WorldCounter() {
  return (
    <div className="space-y-2">
      <h2 className="my-0 text-sm font-medium uppercase tracking-tight text-ink-secondary">
        World population
      </h2>
      <div className="text-4xl tracking-normal md:text-5xl">
        <Live value={(now) => populationAt(world, now)} />
      </div>
      <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-secondary tabular-nums">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Net change</dt>
          <dd className="m-0 text-ink">
            {formatSignedRate(perSecond(netChangePerYear(world)))}/s
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <BirthGlyph />
          <dt>births</dt>
          <dd className="m-0">
            {formatRate(perSecond(world.birthsPerYear))}/s
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <DeathGlyph />
          <dt>deaths</dt>
          <dd className="m-0">
            {formatRate(perSecond(world.deathsPerYear))}/s
          </dd>
        </div>
      </dl>
    </div>
  );
}

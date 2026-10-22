"use client";

import { geoMercator } from "d3-geo";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { largestCities, type City } from "../data/cities";
import { countriesByIso, type Country } from "../data/countries";
import dottedMapData from "../data/dotted-map-data.json";
import { subscribeFrame, useReducedMotion } from "../lib/clock";
import { formatCompact, formatSignedRate } from "../lib/format";
import {
  netChangePerYear,
  perSecond,
  populationAt,
  YEAR_MS,
} from "../lib/population";
import { readCssColor, subscribeThemeChange } from "../lib/theme";
import { BirthGlyph, DeathGlyph, Live, seriesColor } from "./Live";

const WIDTH = 1000;
const HEIGHT = 560;
const DOT_SIZE = 3;
const HOVER_RADIUS = 12;
const PULSE_MS = 1400;
const PULSE_GROWTH = 11;
const MAX_PULSES = 200;
// After a background tab resumes, don't replay the whole gap as a burst of pulses.
const MAX_FRAME_DELTA_MS = 250;

const projection = geoMercator()
  .scale(140)
  .center([15, 25])
  .translate([WIDTH / 2, HEIGHT / 2]);

interface Dot {
  x: number;
  y: number;
  iso: string;
  slot?: number;
}

const dots: Dot[] = [];
const dotIndicesByIso = new Map<string, number[]>();

for (const [iso, points] of Object.entries(
  dottedMapData as Record<string, Array<{ lon: number; lat: number }>>,
)) {
  for (const { lon, lat } of points) {
    const projected = projection([lon, lat]);
    if (!projected) continue;
    const [x, y] = projected;
    if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) continue;
    const indices = dotIndicesByIso.get(iso) ?? [];
    indices.push(dots.length);
    dotIndicesByIso.set(iso, indices);
    dots.push({ x, y, iso, slot: countriesByIso.get(iso)?.seriesSlot });
  }
}

/** Countries that have dots, with cumulative weights for picking where the next birth or death lands. */
function buildSampler(rate: (country: Country) => number) {
  const entries: Array<{ iso: string; cumulative: number }> = [];
  let total = 0;
  for (const iso of dotIndicesByIso.keys()) {
    const country = countriesByIso.get(iso);
    const perYear = country ? rate(country) : 0;
    if (perYear <= 0) continue;
    total += perYear;
    entries.push({ iso, cumulative: total });
  }
  return {
    perYear: total,
    pick(): string {
      const target = Math.random() * total;
      let low = 0;
      let high = entries.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (entries[mid].cumulative < target) low = mid + 1;
        else high = mid;
      }
      return entries[low].iso;
    },
  };
}

const birthSampler = buildSampler((c) => c.birthsPerYear);
const deathSampler = buildSampler((c) => c.deathsPerYear);

/** Knuth's method; fine here because the expected count per frame is well below 1. */
function samplePoisson(lambda: number): number {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = Math.random();
  while (product > limit) {
    count++;
    product *= Math.random();
  }
  return count;
}

interface Pulse {
  dot: Dot;
  kind: "birth" | "death";
  start: number;
}

interface Palette {
  dot: string;
  dotDimmed: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  series: string[];
}

function readPalette(): Palette {
  return {
    dot: readCssColor("--dot"),
    dotDimmed: readCssColor("--dot-dimmed"),
    ink: readCssColor("--ink"),
    inkSecondary: readCssColor("--ink-secondary"),
    inkMuted: readCssColor("--ink-muted"),
    series: Array.from({ length: 8 }, (_, i) =>
      i === 0 ? "" : readCssColor(`--series-${i}`),
    ),
  };
}

function dotColor(
  dot: Dot,
  palette: Palette,
  selectedIso: string | null,
  hoveredIso: string | null,
) {
  const own = dot.slot ? palette.series[dot.slot] : palette.dot;
  if (dot.iso === hoveredIso || dot.iso === selectedIso) {
    return dot.slot ? own : palette.ink;
  }
  if (selectedIso) return palette.dotDimmed;
  return own;
}

type HoverTarget =
  | { kind: "country"; country: Country; x: number; y: number }
  | { kind: "city"; city: City; x: number; y: number };

export default function DottedMap({
  selectedIso,
  onSelect,
}: {
  selectedIso: string | null;
  onSelect: (iso: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const reducedMotion = useReducedMotion();

  const hoveredIso = hover?.kind === "country" ? hover.country.iso2 : null;

  // Latest values for the imperative draw loop, which outlives individual renders.
  const stateRef = useRef({ selectedIso, hoveredIso, reducedMotion });
  const baseDirtyRef = useRef(true);

  useLayoutEffect(() => {
    stateRef.current = { selectedIso, hoveredIso, reducedMotion };
    baseDirtyRef.current = true;
  }, [selectedIso, hoveredIso, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const base = document.createElement("canvas");
    const baseContext = base.getContext("2d")!;
    let palette = readPalette();
    let scale = 1;
    let pixelRatio = 1;
    const pulses: Pulse[] = [];

    const resize = () => {
      const width = container.clientWidth;
      pixelRatio = window.devicePixelRatio || 1;
      scale = width / WIDTH;
      canvas.width = base.width = Math.round(width * pixelRatio);
      canvas.height = base.height = Math.round(
        ((width * HEIGHT) / WIDTH) * pixelRatio,
      );
      baseDirtyRef.current = true;
    };

    const drawBase = () => {
      const { selectedIso, hoveredIso } = stateRef.current;
      baseContext.setTransform(1, 0, 0, 1, 0, 0);
      baseContext.clearRect(0, 0, base.width, base.height);
      baseContext.setTransform(
        scale * pixelRatio,
        0,
        0,
        scale * pixelRatio,
        0,
        0,
      );
      for (const dot of dots) {
        baseContext.fillStyle = dotColor(dot, palette, selectedIso, hoveredIso);
        baseContext.fillRect(dot.x, dot.y, DOT_SIZE, DOT_SIZE);
      }
      baseDirtyRef.current = false;
    };

    const spawn = (kind: Pulse["kind"], iso: string, now: number) => {
      const indices = dotIndicesByIso.get(iso);
      if (!indices) return;
      const dot = dots[indices[Math.floor(Math.random() * indices.length)]];
      if (pulses.length >= MAX_PULSES) pulses.shift();
      pulses.push({ dot, kind, start: now });
    };

    const drawPulses = (now: number) => {
      const { selectedIso } = stateRef.current;
      context.setTransform(scale * pixelRatio, 0, 0, scale * pixelRatio, 0, 0);
      for (const pulse of pulses) {
        const progress = (now - pulse.start) / PULSE_MS;
        if (progress >= 1) continue;
        const dimmed = selectedIso !== null && pulse.dot.iso !== selectedIso;
        const fade = (1 - progress) * (dimmed ? 0.3 : 1);
        const centerX = pulse.dot.x + DOT_SIZE / 2;
        const centerY = pulse.dot.y + DOT_SIZE / 2;

        if (pulse.kind === "birth") {
          const eased = 1 - (1 - progress) ** 3;
          const size = DOT_SIZE + PULSE_GROWTH * eased;
          context.globalAlpha = fade * 0.45;
          context.fillStyle = pulse.dot.slot
            ? palette.series[pulse.dot.slot]
            : palette.ink;
          context.fillRect(centerX - size / 2, centerY - size / 2, size, size);
          context.globalAlpha = fade;
          context.fillRect(
            pulse.dot.x - 0.5,
            pulse.dot.y - 0.5,
            DOT_SIZE + 1,
            DOT_SIZE + 1,
          );
        } else {
          const size = DOT_SIZE + PULSE_GROWTH * (1 - progress);
          context.globalAlpha = fade * 0.9;
          context.strokeStyle = palette.inkMuted;
          context.lineWidth = 1;
          context.strokeRect(
            centerX - size / 2,
            centerY - size / 2,
            size,
            size,
          );
        }
      }
      context.globalAlpha = 1;
      while (pulses.length > 0 && now - pulses[0].start >= PULSE_MS)
        pulses.shift();
    };

    const onFrame = (now: number, deltaMs: number) => {
      if (baseDirtyRef.current) drawBase();

      if (!stateRef.current.reducedMotion && deltaMs > 0) {
        const delta = Math.min(deltaMs, MAX_FRAME_DELTA_MS);
        const births = samplePoisson((birthSampler.perYear * delta) / YEAR_MS);
        const deaths = samplePoisson((deathSampler.perYear * delta) / YEAR_MS);
        for (let i = 0; i < births; i++)
          spawn("birth", birthSampler.pick(), now);
        for (let i = 0; i < deaths; i++)
          spawn("death", deathSampler.pick(), now);
      } else if (stateRef.current.reducedMotion) {
        pulses.length = 0;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(base, 0, 0);
      drawPulses(now);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const unsubscribeTheme = subscribeThemeChange(() => {
      palette = readPalette();
      baseDirtyRef.current = true;
    });
    const unsubscribeFrame = subscribeFrame(onFrame);

    return () => {
      resizeObserver.disconnect();
      unsubscribeTheme();
      unsubscribeFrame();
    };
  }, []);

  const toMapPoint = (event: React.PointerEvent | React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const nearestCountry = (x: number, y: number): Country | null => {
    let bestDistance = HOVER_RADIUS ** 2;
    let best: Dot | null = null;
    for (const dot of dots) {
      const dx = dot.x + DOT_SIZE / 2 - x;
      const dy = dot.y + DOT_SIZE / 2 - y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = dot;
      }
    }
    return best ? (countriesByIso.get(best.iso) ?? null) : null;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-city]")) return;
    const point = toMapPoint(event);
    const country = nearestCountry(point.x, point.y);
    setHover(country ? { kind: "country", country, ...point } : null);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-city]")) return;
    const point = toMapPoint(event);
    const country = nearestCountry(point.x, point.y);
    onSelect(country && country.iso2 !== selectedIso ? country.iso2 : null);
  };

  const showCity = useCallback((city: City) => {
    const [x, y] = projection(city.coordinates) ?? [0, 0];
    setHover({ kind: "city", city, x, y });
  }, []);

  return (
    <figure className="m-0 w-full">
      {/* Below sm the map is drawn 140% wide and cropped, so land stays legible on phones. */}
      <div className="relative overflow-hidden [--map-scale:1.4] [--map-shift:-20%] sm:[--map-scale:1] sm:[--map-shift:0%]">
        <div
          ref={containerRef}
          className={`relative ml-[var(--map-shift)] w-[calc(var(--map-scale)*100%)] touch-manipulation select-none ${hoveredIso ? "cursor-pointer" : ""}`}
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
          onClick={handleClick}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          />

          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            role="list"
            aria-label="Largest cities"
          >
            {largestCities.map((city) => {
              const [x, y] = projection(city.coordinates) ?? [0, 0];
              return (
                <g
                  key={city.name}
                  data-city
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${city.name}, ${formatCompact(city.population)} people`}
                  // Rounded so server and browser float formatting agree during hydration.
                  transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
                  className="pointer-events-auto cursor-default outline-none [&:focus-visible>polygon]:stroke-[var(--ink)]"
                  onPointerEnter={() => showCity(city)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => showCity(city)}
                  onBlur={() => setHover(null)}
                >
                  <circle r={9} fill="transparent" />
                  <polygon
                    points="0,-4.6 -4,2.4 4,2.4"
                    fill="var(--ink)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                    style={{ paintOrder: "stroke" }}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {hover && <MapTooltip target={hover} />}
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs uppercase text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <BirthGlyph /> Birth
        </span>
        <span className="flex items-center gap-1.5">
          <DeathGlyph /> Death
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[10px] text-ink">
            ▲
          </span>
          Largest cities
        </span>
        <span className="normal-case text-ink-muted">
          {reducedMotion
            ? "Pulses paused: reduced motion is on"
            : "Each pulse is one modelled event, at the real rate"}
        </span>
      </figcaption>
    </figure>
  );
}

function MapTooltip({ target }: { target: HoverTarget }) {
  const flipBelow = target.y < HEIGHT * 0.18;
  // Positioned in the visible (cropped) frame and kept clear of its edges.
  const left = `clamp(100px, calc(${target.x / WIDTH} * var(--map-scale) * 100% + var(--map-shift)), calc(100% - 100px))`;

  return (
    <div
      role="status"
      className="tooltip-enter pointer-events-none absolute z-10 whitespace-nowrap rounded border border-border bg-background px-2.5 py-1.5 text-xs shadow-lg"
      style={{
        left,
        top: `${(target.y / HEIGHT) * 100}%`,
        transform: flipBelow
          ? "translate(-50%, 18px)"
          : "translate(-50%, calc(-100% - 14px))",
      }}
    >
      {target.kind === "country" ? (
        <>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={{ color: seriesColor(target.country.seriesSlot) }}
            >
              ■
            </span>
            <span className="font-medium text-ink">{target.country.iso2}</span>
            <span className="text-ink-secondary">{target.country.name}</span>
          </div>
          <div className="mt-0.5 flex gap-3 tabular-nums">
            <Live
              value={(now) => populationAt(target.country, now)}
              className="text-ink"
            />
            <span className="text-ink-secondary">
              {formatSignedRate(perSecond(netChangePerYear(target.country)))}/s
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-ink">
              ▲
            </span>
            <span className="font-medium text-ink">{target.city.name}</span>
            <span className="text-ink-secondary">{target.city.iso2}</span>
          </div>
          <div className="mt-0.5 tabular-nums text-ink-secondary">
            {formatCompact(target.city.population)} people · largest city #
            {largestCities.indexOf(target.city) + 1}
          </div>
        </>
      )}
    </div>
  );
}

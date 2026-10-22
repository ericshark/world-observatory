"use client";

import { geoMercator } from "d3-geo";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dottedMapData from "../data/dotted-map-data.json";
import { subscribeFrame } from "../lib/clock";
import { formatMeasure, measureUnit, perSecondFor } from "../lib/metrics";
import type {
  Entity,
  MetricModel,
  MetricSelection,
} from "../lib/metrics-types";
import { readCssColor, subscribeThemeChange } from "../lib/theme";
import { COMPARE_COLORS } from "./HistoryChart";

const W = 1100,
  H = 590;
const projection = geoMercator()
  .scale(163)
  .center([12, 20])
  .translate([W / 2, H / 2]);
const dots: { x: number; y: number; iso: string }[] = [];
const byIso = new Map<string, number[]>();
for (const [iso, points] of Object.entries(dottedMapData)) {
  for (const point of points) {
    const p = projection([point.lon, point.lat]);
    if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;
    const indices = byIso.get(iso) ?? [];
    indices.push(dots.length);
    byIso.set(iso, indices);
    dots.push({ x: p[0], y: p[1], iso });
  }
}
interface Camera {
  x: number;
  y: number;
  k: number;
}
const HOME: Camera = { x: 0, y: 0, k: 1 };
function clampCamera(camera: Camera): Camera {
  const k = Math.max(1, Math.min(8, camera.k));
  return {
    k,
    x: Math.min(0, Math.max(W * (1 - k), camera.x)),
    y: Math.min(0, Math.max(H * (1 - k), camera.y)),
  };
}
export function heatFraction(
  value: number,
  min: number,
  max: number,
  logarithmic: boolean,
) {
  const transform = (v: number) =>
    logarithmic ? Math.log1p(Math.max(0, v)) : v;
  const lo = transform(min),
    hi = transform(max);
  return hi === lo
    ? 0.65
    : Math.max(0, Math.min(1, (transform(value) - lo) / (hi - lo)));
}
function mixColor(low: string, high: string, t: number) {
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(low),
    b = rgb(high);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}
interface Props {
  countries: Entity[];
  values: Map<string, number | null>;
  models: Map<string, MetricModel | null>;
  selection: MetricSelection;
  selectedIso: string | null;
  compare: string[];
  onSelect: (iso: string | null) => void;
  now: number;
}
export default function DottedMap(props: Props) {
  const { countries, values, models, selection, selectedIso, onSelect, now } =
    props;
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>(HOME);
  const [camera, setCamera] = useState<Camera>(HOME);
  const [hover, setHover] = useState<{
    iso: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    origin: { x: number; y: number };
    last: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const dirty = useRef(true);
  const state = useRef({ ...props, hoverIso: null as string | null });
  const entities = useMemo(
    () => new Map(countries.map((c) => [c.iso2, c])),
    [countries],
  );
  const locators = useMemo(
    () =>
      countries
        .filter((c) => !byIso.has(c.iso2) && c.coordinates)
        .map((c) => ({ iso: c.iso2, point: projection(c.coordinates!)! }))
        .filter(
          (c) =>
            c.point &&
            c.point[0] >= 0 &&
            c.point[0] <= W &&
            c.point[1] >= 0 &&
            c.point[1] <= H,
        ),
    [countries],
  );
  const logarithmic = selection.measure === "total";
  const validValues = [...values.values()].filter(
    (v): v is number => v !== null,
  );
  const min = validValues.length ? Math.min(...validValues) : 0;
  const max = validValues.length ? Math.max(...validValues) : 0;
  useLayoutEffect(() => {
    state.current = { ...props, hoverIso: hover?.iso ?? null };
    dirty.current = true;
  }, [props, hover]);
  const updateCamera = (next: Camera) => {
    const clamped = clampCamera(next);
    cameraRef.current = clamped;
    dirty.current = true;
    setCamera(clamped);
  };
  const zoom = (factor: number, center = { x: W / 2, y: H / 2 }) => {
    const current = cameraRef.current;
    const k = Math.max(1, Math.min(8, current.k * factor));
    updateCamera({
      k,
      x: center.x - ((center.x - current.x) * k) / current.k,
      y: center.y - ((center.y - current.y) * k) / current.k,
    });
  };
  const toPoint = (clientX: number, clientY: number) => {
    const bounds = container.current!.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / bounds.width) * W,
      y: ((clientY - bounds.top) / bounds.height) * H,
    };
  };
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const center = {
        x: ((event.clientX - bounds.left) / bounds.width) * W,
        y: ((event.clientY - bounds.top) / bounds.height) * H,
      };
      const current = cameraRef.current;
      const k = Math.max(
        1,
        Math.min(8, current.k * Math.exp(-event.deltaY * 0.0015)),
      );
      const next = clampCamera({
        k,
        x: center.x - ((center.x - current.x) * k) / current.k,
        y: center.y - ((center.y - current.y) * k) / current.k,
      });
      cameraRef.current = next;
      dirty.current = true;
      setCamera(next);
      setHover(null);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    const element = container.current;
    const target = canvas.current;
    if (!element || !target) return;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const base = document.createElement("canvas");
    const b = base.getContext("2d")!;
    let scale = 1,
      dpr = 1;
    let accent = readCssColor("--accent", element);
    let low = readCssColor("--map-low");
    let missing = readCssColor("--map-missing");
    let grid = readCssColor("--map-grid");
    let ink = readCssColor("--ink");
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      scale = element.clientWidth / W;
      target.width = base.width = Math.round(element.clientWidth * dpr);
      target.height = base.height = Math.round(
        ((element.clientWidth * H) / W) * dpr,
      );
      dirty.current = true;
    };
    const pulses: { x: number; y: number; start: number; death: boolean }[] =
      [];
    let nextPulse = 0;
    let previousMode = "";
    const drawBase = () => {
      const current = state.current;
      const cam = cameraRef.current;
      const valid = [...current.values.values()].filter(
        (v): v is number => v !== null,
      );
      const min = valid.length ? Math.min(...valid) : 0,
        max = valid.length ? Math.max(...valid) : 0;
      const log = current.selection.measure === "total";
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, base.width, base.height);
      b.setTransform(
        scale * dpr * cam.k,
        0,
        0,
        scale * dpr * cam.k,
        cam.x * scale * dpr,
        cam.y * scale * dpr,
      );
      b.strokeStyle = grid;
      b.lineWidth = 0.5 / cam.k;
      for (let lon = -180; lon <= 180; lon += 30) {
        const top = projection([lon, 80]),
          bottom = projection([lon, -60]);
        if (top && bottom) {
          b.beginPath();
          b.moveTo(...top);
          b.lineTo(...bottom);
          b.stroke();
        }
      }
      for (let lat = -60; lat <= 80; lat += 20) {
        const left = projection([-180, lat]),
          right = projection([180, lat]);
        if (left && right) {
          b.beginPath();
          b.moveTo(...left);
          b.lineTo(...right);
          b.stroke();
        }
      }
      const colors = new Map<string, string>();
      for (const country of current.countries) {
        const value = current.values.get(country.iso2);
        colors.set(
          country.iso2,
          value === null || value === undefined
            ? missing
            : mixColor(
                low,
                accent,
                0.15 + heatFraction(value, min, max, log) * 0.85,
              ),
        );
      }
      for (const dot of dots) {
        const pin = current.compare.indexOf(dot.iso);
        const highlighted =
          dot.iso === current.selectedIso || dot.iso === current.hoverIso;
        b.globalAlpha =
          current.selectedIso && !highlighted && pin < 0 ? 0.55 : 1;
        b.fillStyle =
          pin >= 0
            ? COMPARE_COLORS[pin]
            : highlighted
              ? ink
              : (colors.get(dot.iso) ?? missing);
        b.fillRect(dot.x, dot.y, 2.45, 2.45);
      }
      b.globalAlpha = 1;
      for (const locator of locators) {
        const pin = current.compare.indexOf(locator.iso);
        const selected =
          locator.iso === current.selectedIso ||
          locator.iso === current.hoverIso;
        b.strokeStyle =
          pin >= 0
            ? COMPARE_COLORS[pin]
            : selected
              ? ink
              : (colors.get(locator.iso) ?? missing);
        b.lineWidth = (selected ? 1.8 : 1) / cam.k;
        b.beginPath();
        b.arc(
          locator.point[0],
          locator.point[1],
          (selected ? 5 : 2.5) / Math.sqrt(cam.k),
          0,
          Math.PI * 2,
        );
        b.stroke();
      }
      // Capitals anchor labels; the heat surface itself is country-level, never city-level data.
      for (const iso of [
        ...new Set([current.selectedIso, ...current.compare]),
      ]) {
        const entity = current.countries.find((c) => c.iso2 === iso);
        if (!entity?.coordinates) continue;
        const p = projection(entity.coordinates);
        if (!p) continue;
        const pin = current.compare.indexOf(entity.iso2);
        b.fillStyle = pin >= 0 ? COMPARE_COLORS[pin] : ink;
        b.beginPath();
        b.arc(p[0], p[1], 4 / cam.k, 0, Math.PI * 2);
        b.fill();
        b.font = `500 ${11 / cam.k}px monospace`;
        b.fillText(entity.iso2, p[0] + 8 / cam.k, p[1] + 4 / cam.k);
      }
      dirty.current = false;
    };
    const draw = (time: number) => {
      const current = state.current;
      // Accent can change with a metric switch without a theme change.
      const nextAccent = dirty.current
        ? readCssColor("--accent", element)
        : accent;
      if (accent !== nextAccent) {
        accent = nextAccent;
        dirty.current = true;
      }
      if (dirty.current) drawBase();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(base, 0, 0);
      const mode = `${current.selection.metric}-${current.selection.populationView}`;
      if (mode !== previousMode) {
        pulses.length = 0;
        previousMode = mode;
      }
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (current.selection.metric !== "population" || reduced) {
        pulses.length = 0;
        return;
      }
      const cam = cameraRef.current;
      ctx.setTransform(
        scale * dpr * cam.k,
        0,
        0,
        scale * dpr * cam.k,
        cam.x * scale * dpr,
        cam.y * scale * dpr,
      );
      if (time >= nextPulse) {
        nextPulse = time + 160;
        const candidates = current.countries.flatMap((country) => {
          if (!byIso.has(country.iso2)) return [];
          const m = current.models.get(country.iso2);
          if (!m) return [];
          const keys =
            current.selection.populationView === "population"
              ? (["birthRate", "deathRate"] as const)
              : current.selection.populationView === "births"
                ? (["birthRate"] as const)
                : (["deathRate"] as const);
          return keys.map((key) => ({
            iso: country.iso2,
            weight:
              ((country.series[key]?.find((o) => o.year === m.year)?.value ??
                0) *
                (m.population ?? 0)) /
              1000,
            death: key === "deathRate",
          }));
        });
        const total = candidates.reduce((sum, c) => sum + c.weight, 0);
        let pick = Math.random() * total;
        const country = candidates.find((c) => (pick -= c.weight) <= 0);
        if (country && total > 0) {
          const indices = byIso.get(country.iso)!;
          const dot = dots[indices[Math.floor(Math.random() * indices.length)]];
          if (pulses.length < 24)
            pulses.push({
              ...dot,
              start: time,
              death: country.death,
            });
        }
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i],
          progress = (time - pulse.start) / 1400;
        if (progress >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = (1 - progress) * 0.65;
        ctx.strokeStyle = pulse.death ? ink : accent;
        ctx.lineWidth = 1 / cam.k;
        const r = (2 + progress * 10) / Math.sqrt(cam.k);
        ctx.strokeRect(pulse.x - r / 2, pulse.y - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const stopTheme = subscribeThemeChange(() => {
      accent = readCssColor("--accent", element);
      low = readCssColor("--map-low");
      missing = readCssColor("--map-missing");
      grid = readCssColor("--map-grid");
      ink = readCssColor("--ink");
      dirty.current = true;
    });
    const stopFrame = subscribeFrame(draw);
    return () => {
      observer.disconnect();
      stopTheme();
      stopFrame();
    };
  }, [locators]);
  const nearest = (point: { x: number; y: number }) => {
    const cam = cameraRef.current,
      x = (point.x - cam.x) / cam.k,
      y = (point.y - cam.y) / cam.k;
    let best = (12 / Math.sqrt(cam.k)) ** 2,
      iso: string | null = null;
    for (const dot of dots) {
      const d = (dot.x - x) ** 2 + (dot.y - y) ** 2;
      if (d < best && entities.has(dot.iso)) {
        best = d;
        iso = dot.iso;
      }
    }
    for (const locator of locators) {
      const d = (locator.point[0] - x) ** 2 + (locator.point[1] - y) ** 2;
      if (d < best) {
        best = d;
        iso = locator.iso;
      }
    }
    return iso;
  };
  const hovered = hover ? entities.get(hover.iso) : null;
  const hoveredModel = hover ? models.get(hover.iso) : null;
  return (
    <figure className="map-figure">
      <div
        className="map-viewport"
        ref={container}
        tabIndex={0}
        role="group"
        aria-label="Interactive world map. Arrow keys pan, plus and minus zoom, Home resets. Use country search to select countries by keyboard."
        style={{ cursor: dragging ? "grabbing" : hover ? "pointer" : "grab" }}
        onKeyDown={(event) => {
          const current = cameraRef.current;
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "+",
              "=",
              "-",
              "Home",
              "Escape",
            ].includes(event.key)
          )
            event.preventDefault();
          if (event.key === "+" || event.key === "=") zoom(1.3);
          if (event.key === "-") zoom(1 / 1.3);
          if (event.key === "Home") updateCamera(HOME);
          if (event.key === "Escape") {
            onSelect(null);
            setHover(null);
          }
          if (event.key.startsWith("Arrow"))
            updateCamera({
              ...current,
              x:
                current.x +
                (event.key === "ArrowLeft"
                  ? 60
                  : event.key === "ArrowRight"
                    ? -60
                    : 0),
              y:
                current.y +
                (event.key === "ArrowUp"
                  ? 60
                  : event.key === "ArrowDown"
                    ? -60
                    : 0),
            });
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const point = toPoint(event.clientX, event.clientY);
          pointers.current.set(event.pointerId, point);
          if (pointers.current.size === 1)
            gesture.current = { origin: point, last: point, moved: false };
          if (pointers.current.size > 1 && gesture.current)
            gesture.current.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          setHover(null);
        }}
        onPointerMove={(event) => {
          const point = toPoint(event.clientX, event.clientY);
          if (!pointers.current.has(event.pointerId)) {
            const iso = nearest(point);
            setHover(iso ? { iso, ...point } : null);
            return;
          }
          const previous = pointers.current.get(event.pointerId)!;
          const other = [...pointers.current.entries()].find(
            ([id]) => id !== event.pointerId,
          )?.[1];
          if (other) {
            const oldDistance = Math.hypot(
              previous.x - other.x,
              previous.y - other.y,
            );
            const newDistance = Math.hypot(
              point.x - other.x,
              point.y - other.y,
            );
            if (oldDistance > 0)
              zoom(newDistance / oldDistance, {
                x: (point.x + other.x) / 2,
                y: (point.y + other.y) / 2,
              });
          } else {
            const g = gesture.current;
            if (g) {
              if (Math.hypot(point.x - g.origin.x, point.y - g.origin.y) > 6)
                g.moved = true;
              if (g.moved)
                updateCamera({
                  ...cameraRef.current,
                  x: cameraRef.current.x + point.x - previous.x,
                  y: cameraRef.current.y + point.y - previous.y,
                });
              g.last = point;
            }
          }
          pointers.current.set(event.pointerId, point);
        }}
        onPointerUp={(event) => {
          const point = toPoint(event.clientX, event.clientY);
          if (
            pointers.current.size === 1 &&
            gesture.current &&
            !gesture.current.moved
          ) {
            const iso = nearest(point);
            onSelect(iso === selectedIso ? null : iso);
          }
          pointers.current.delete(event.pointerId);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (pointers.current.size === 0) {
            gesture.current = null;
            setDragging(false);
          }
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (pointers.current.size === 0) setHover(null);
        }}
      >
        <canvas ref={canvas} aria-hidden="true" />
        <span className="map-coordinate coordinate-nw" aria-hidden="true">
          80° N
        </span>
        <span className="map-coordinate coordinate-sw" aria-hidden="true">
          60° S
        </span>
        <span className="map-coordinate coordinate-ne" aria-hidden="true">
          180° E
        </span>
        {hover && hovered && (
          <div
            className="map-tooltip"
            role="status"
            style={{
              left: `clamp(120px, ${(hover.x / W) * 100}%, calc(100% - 120px))`,
              top: `clamp(8px, calc(${(hover.y / H) * 100}% - 110px), calc(100% - 118px))`,
            }}
          >
            <div>
              <span>{hovered.iso2}</span>
              <strong>{hovered.name}</strong>
            </div>
            <b>
              {formatMeasure(values.get(hover.iso) ?? null, selection)}{" "}
              <small>{measureUnit(selection)}</small>
            </b>
            <p>
              {hoveredModel
                ? `${hoveredModel.year} source${hoveredModel.forecast ? " · forecast" : hoveredModel.historical ? " · historical" : ""}`
                : "Data unavailable"}
              {hoveredModel && !hoveredModel.historical
                ? ` · ${perSecondFor(hoveredModel, now).toFixed(2)}/s estimated`
                : ""}
            </p>
            <small>Click to explore</small>
          </div>
        )}
      </div>
      <div className="map-tools">
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.4)}>
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoom(1 / 1.4)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset map"
          onClick={() => updateCamera(HOME)}
        >
          ⌂
        </button>
        <span aria-live="polite">{camera.k.toFixed(1)}×</span>
      </div>
      <figcaption className="map-legend">
        <div className="heat-legend">
          <span>{formatMeasure(min, selection)}</span>
          <i />
          <span>{formatMeasure(max, selection)}</span>
          <small>
            {logarithmic ? "LOG" : "LINEAR"} · {measureUnit(selection)}
          </small>
        </div>
        <div className="map-legend-note">
          <span className="missing-key" /> Unavailable
          {selection.metric === "population" && (
            <span className="pulse-note">
              ◇ Illustrative{" "}
              {selection.populationView === "population"
                ? "birth / death"
                : selection.populationView}{" "}
              pulses
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

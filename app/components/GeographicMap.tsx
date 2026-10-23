"use client";

import { geoEqualEarth, geoPath, geoContains } from "d3-geo";
import geography from "../lib/geography";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeFrame } from "../lib/clock";
import { formatMeasure, measureUnit } from "../lib/metrics";
import type {
  DataSource,
  Entity,
  MetricModel,
  MetricSelection,
} from "../lib/metrics-types";
import { readCssColor, subscribeThemeChange } from "../lib/theme";
import { mapLabel, mixColor } from "../lib/heat-map";

const W = 1100,
  H = 590;
const projection = geoEqualEarth().fitExtent(
  [
    [18, 18],
    [W - 18, H - 18],
  ],
  {
    ...geography,
    features: geography.features.filter((f) => f.properties.iso !== "AQ"),
  },
);
const shapes = geography.features.filter((f) => f.properties.iso !== "AQ");
const byIso = new Map<string, number>();
for (const feature of shapes)
  byIso.set(
    feature.properties.iso,
    (byIso.get(feature.properties.iso) ?? 0) +
      geoPath(projection).area(feature),
  );
const names = new Map(
  shapes.map((feature) => [feature.properties.iso, feature.properties.name]),
);
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
interface Props {
  countries: Entity[];
  values: Map<string, number | null>;
  models: Map<string, MetricModel | null>;
  selection: MetricSelection;
  selectedIso: string | null;
  colors: Map<string, string>;
  onSelect: (iso: string | null) => void;
  source: DataSource;
}
export default function GeographicMap(props: Props) {
  const {
    countries,
    values,
    models,
    selection,
    selectedIso,
    onSelect,
    source,
  } = props;
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
        .filter((c) => (byIso.get(c.iso2) ?? 0) < 20 && c.coordinates)
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
  useLayoutEffect(() => {
    state.current = { ...props, hoverIso: hover?.iso ?? null };
    dirty.current = true;
  }, [props, hover]);
  useLayoutEffect(() => {
    const viewport = container.current;
    const tooltip = viewport?.querySelector<HTMLElement>(".map-tooltip");
    if (!viewport || !tooltip || !hover) return;
    const placeTooltip = () => {
      const width = viewport.clientWidth,
        height = viewport.clientHeight;
      const x = (hover.x / W) * width,
        y = (hover.y / H) * height;
      tooltip.style.left = `${Math.max(6, Math.min(width - tooltip.offsetWidth - 6, x - tooltip.offsetWidth / 2))}px`;
      tooltip.style.top = `${Math.max(6, Math.min(height - tooltip.offsetHeight - 6, y - tooltip.offsetHeight - 12))}px`;
    };
    placeTooltip();
    const observer = new ResizeObserver(placeTooltip);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hover, selection, source]);
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
        Math.min(
          8,
          current.k *
            Math.exp(
              -Math.max(
                -200,
                Math.min(
                  200,
                  event.deltaY *
                    (event.deltaMode === 1
                      ? 16
                      : event.deltaMode === 2
                        ? bounds.height
                        : 1),
                ),
              ) * 0.003,
            ),
        ),
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
    let scale = 1,
      dpr = 1;
    let missing = readCssColor("--map-missing");
    let border = readCssColor("--map-border");
    let ink = readCssColor("--ink");
    let background = readCssColor("--background");
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => {
      reduced = motion.matches;
      dirty.current = true;
    };
    motion.addEventListener("change", motionChanged);
    const geometryPath = geoPath(projection);
    // Feature-indexed paths preserve islands and disputed geometries sharing an ISO.
    const paths = shapes.map((feature) => ({
      feature,
      path: new Path2D(geometryPath(feature) ?? ""),
    }));
    const transitions = new Map<
      string,
      { from: string; to: string; at: number }
    >();
    const highlights = new Map<
      string,
      { from: number; to: number; at: number }
    >();
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      scale = element.clientWidth / W;
      target.width = Math.round(element.clientWidth * dpr);
      target.height = Math.round(((element.clientWidth * H) / W) * dpr);
      dirty.current = true;
    };
    let animating = false;
    const draw = (now: number) => {
      if ((!dirty.current && !animating) || !target.width || !target.height)
        return;
      const current = state.current,
        cam = cameraRef.current;
      animating = false;
      const colors = new Map<string, string>();
      const emphasis = new Map<string, number>();
      for (const iso of new Set([
        ...byIso.keys(),
        ...locators.map((l) => l.iso),
      ])) {
        const next = current.colors.get(iso) ?? missing;
        let transition = transitions.get(iso);
        if (!transition) transition = { from: next, to: next, at: now };
        const progress = reduced
          ? 1
          : Math.min(1, Math.max(0, (now - transition.at) / 240));
        let color = mixColor(transition.from, transition.to, progress);
        if (transition.to !== next)
          transition = { from: color, to: next, at: now };
        if (reduced) color = next;
        transitions.set(iso, transition);
        colors.set(iso, color);
        if (
          !reduced &&
          now - transition.at < 240 &&
          transition.from !== transition.to
        )
          animating = true;
        const active =
          iso === current.selectedIso || iso === current.hoverIso ? 1 : 0;
        let highlight = highlights.get(iso) ?? {
          from: active,
          to: active,
          at: now,
        };
        let alpha =
          highlight.from +
          (highlight.to - highlight.from) *
            (reduced
              ? 1
              : Math.min(1, Math.max(0, (now - highlight.at) / 140)));
        if (active !== highlight.to)
          highlight = { from: alpha, to: active, at: now };
        if (reduced) alpha = active;
        highlights.set(iso, highlight);
        emphasis.set(iso, alpha);
        if (
          !reduced &&
          now - highlight.at < 140 &&
          highlight.from !== highlight.to
        )
          animating = true;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.setTransform(
        scale * dpr * cam.k,
        0,
        0,
        scale * dpr * cam.k,
        cam.x * scale * dpr,
        cam.y * scale * dpr,
      );
      ctx.lineJoin = "round";
      for (const { feature, path } of paths) {
        ctx.fillStyle = colors.get(feature.properties.iso)!;
        ctx.fill(path);
        ctx.strokeStyle = border;
        ctx.lineWidth = 0.55 / cam.k;
        ctx.stroke(path);
      }
      // Draw emphasis after every fill so neighboring countries cannot cover borders.
      for (const { feature, path } of paths) {
        const iso = feature.properties.iso;
        const alpha = emphasis.get(iso) ?? 0;
        if (alpha > 0) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.5 / cam.k;
          ctx.stroke(path);
          ctx.globalAlpha = 1;
        }
        if (
          (alpha > 0.5 || cam.k >= 3) &&
          geometryPath.area(feature) * cam.k * cam.k > 3000
        ) {
          const point = projection(feature.properties.label);
          if (point) {
            ctx.font = `500 ${11 / cam.k}px monospace`;
            ctx.textAlign = "center";
            ctx.lineWidth = 3 / cam.k;
            ctx.strokeStyle = background;
            ctx.strokeText(feature.properties.name, point[0], point[1]);
            ctx.fillStyle = ink;
            ctx.fillText(feature.properties.name, point[0], point[1]);
          }
        }
      }
      for (const locator of locators) {
        const alpha = emphasis.get(locator.iso) ?? 0;
        ctx.fillStyle = colors.get(locator.iso) ?? missing;
        ctx.strokeStyle = alpha > 0 ? ink : border;
        ctx.lineWidth = (alpha > 0 ? 1.5 : 0.7) / cam.k;
        ctx.beginPath();
        ctx.arc(
          locator.point[0],
          locator.point[1],
          (alpha > 0 ? 4 : 2.5) / Math.sqrt(cam.k),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();
      }
      dirty.current = false;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const stopTheme = subscribeThemeChange(() => {
      missing = readCssColor("--map-missing");
      border = readCssColor("--map-border");
      ink = readCssColor("--ink");
      background = readCssColor("--background");
      dirty.current = true;
    });
    const stopFrame = subscribeFrame(draw, false);
    return () => {
      observer.disconnect();
      stopTheme();
      stopFrame();
      motion.removeEventListener("change", motionChanged);
    };
  }, [locators]);
  const nearest = (point: { x: number; y: number }) => {
    const cam = cameraRef.current,
      x = (point.x - cam.x) / cam.k,
      y = (point.y - cam.y) / cam.k;
    let best = (12 / Math.sqrt(cam.k)) ** 2,
      iso: string | null = null;
    const geographic = projection.invert?.([x, y]);
    if (geographic) {
      const feature = shapes.find((f) => geoContains(f, geographic));
      if (feature) return feature.properties.iso;
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
  const hovered = hover
    ? (entities.get(hover.iso) ?? {
        name: names.get(hover.iso) ?? hover.iso,
        iso2: hover.iso,
      })
    : null;
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
            onSelect(
              iso === selectedIso || !iso || !entities.has(iso) ? null : iso,
            );
            setHover(iso ? { iso, ...point } : null);
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
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch" && pointers.current.size === 0)
            setHover(null);
        }}
      >
        <canvas ref={canvas} aria-hidden="true" />
        <span className="map-coordinate coordinate-nw" aria-hidden="true">
          EQUAL EARTH
        </span>
        <span className="map-coordinate coordinate-sw" aria-hidden="true">
          50m · NATURAL EARTH
        </span>
        <span className="map-coordinate coordinate-ne" aria-hidden="true">
          WORLD VIEW
        </span>
        {hover && hovered && (
          <div
            className="map-tooltip"
            role="tooltip"
            style={{
              left: `${Math.max(0, Math.min(100, (hover.x / W) * 100))}%`,
              top: `${(hover.y / H) * 100}%`,
            }}
          >
            <div>
              <span>{hovered.iso2}</span>
              <strong>{hovered.name}</strong>
            </div>
            <p>{mapLabel(selection)}</p>
            <b>
              {formatMeasure(values.get(hover.iso) ?? null, selection)}{" "}
              <small>
                {selection.measure === "debtRatio"
                  ? ""
                  : measureUnit(selection)}
              </small>
            </b>
            <p>
              {hoveredModel
                ? `${hoveredModel.year} observation${hoveredModel.forecast ? " · forecast" : ""}${hoveredModel.historical ? " · historical, no current estimate" : selection.measure === "debtRatio" ? " · source ratio" : " · modelled estimate"}`
                : "Data unavailable"}
            </p>
            {hoveredModel && <p>Release: {source.updatedAt.split(" ")[0]}</p>}
            {selection.measure === "perCapita" &&
              hoveredModel?.populationYear && (
                <p>Population basis: {hoveredModel.populationYear}</p>
              )}
            <small>
              {entities.has(hover.iso)
                ? "Select country to explore"
                : "No statistical record"}
            </small>
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
    </figure>
  );
}

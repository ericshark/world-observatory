"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  PaddingOptions,
  StyleSpecification,
} from "maplibre-gl";
import { geoArea } from "d3-geo";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import geography from "../../lib/geography";
import { subscribeFrame } from "../../lib/clock";

export interface MapApi {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  focus(iso: string): void;
}
interface Props {
  ref?: Ref<MapApi>;
  /** Heat colors by ISO code; missing codes render as "no current data". */
  colors: Map<string, string>;
  /** Changing this key crossfades to the new colors instead of snapping. */
  transitionKey: string;
  selectedIso: string | null;
  locators: { iso: string; coordinates: [number, number] }[];
  onSelect: (iso: string | null) => void;
  renderTooltip: (iso: string, name: string) => ReactNode;
  /** Receives "LAT · LON · ZOOM" text without re-rendering React. */
  readout?: RefObject<HTMLElement | null>;
  onZoom?: (zoom: number) => void;
}

const SHAPES: FeatureCollection = {
  type: "FeatureCollection",
  features: geography.features.filter((f) => f.properties.iso !== "AQ"),
};
const NAMES = new Map(
  geography.features.map((f) => [f.properties.iso, f.properties.name]),
);
const LABELS = new Map(
  geography.features.map((f) => [f.properties.iso, f.properties.label]),
);
/** Countries under ~5,000 km² nearly vanish at world zoom; they get a locator dot. */
export const LOCATOR_MAX_STERADIANS = 1.2e-4;
const AREAS = new Map<string, number>();
for (const feature of geography.features)
  AREAS.set(
    feature.properties.iso,
    (AREAS.get(feature.properties.iso) ?? 0) + geoArea(feature),
  );
export function needsLocator(iso: string) {
  return (AREAS.get(iso) ?? 0) < LOCATOR_MAX_STERADIANS;
}

const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-168, -56],
  [180, 78],
];
const MISSING = "#2b2740";
const HEAT_OPACITY = 0.6;
const CROSSFADE_MS = 520;
// NASA GIBS serves the VIIRS Black Marble composite natively in Web Mercator.
const NIGHT_LIGHTS =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png";

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    lights: {
      type: "raster",
      tiles: [NIGHT_LIGHTS],
      tileSize: 256,
      maxzoom: 8,
    },
    countries: { type: "geojson", data: SHAPES, promoteId: "iso" },
    locators: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      promoteId: "iso",
    },
  },
  layers: [
    {
      id: "space",
      type: "background",
      paint: { "background-color": "#0a0c2e" },
    },
    {
      id: "lights",
      type: "raster",
      source: "lights",
      paint: {
        "raster-saturation": 0.25,
        "raster-contrast": 0.35,
        "raster-brightness-max": 1,
        // Lets the navy background lift the imagery's black oceans.
        "raster-opacity": 0.88,
        "raster-fade-duration": 300,
      },
    },
    ...(["a", "b"] as const).map((slot) => ({
      id: `heat-${slot}`,
      type: "fill" as const,
      source: "countries",
      paint: {
        "fill-color": [
          "coalesce",
          ["feature-state", slot],
          MISSING,
        ] as unknown as string,
        "fill-opacity": slot === "a" ? HEAT_OPACITY : 0,
        "fill-opacity-transition": { duration: CROSSFADE_MS, delay: 0 },
        "fill-antialias": false,
      },
    })),
    {
      id: "focus",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": "#ffffff",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.22,
          ["boolean", ["feature-state", "hover"], false],
          0.14,
          0,
        ],
      },
    },
    {
      id: "borders",
      type: "line",
      source: "countries",
      paint: {
        "line-color": "#c58bff",
        "line-opacity": 0.42,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1.1],
      },
    },
    {
      id: "glow",
      type: "line",
      source: "countries",
      paint: {
        "line-color": "#2de2ff",
        "line-blur": 3,
        "line-width": 4,
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.95,
          ["boolean", ["feature-state", "hover"], false],
          0.5,
          0,
        ],
      },
    },
    {
      id: "edge",
      type: "line",
      source: "countries",
      paint: {
        "line-color": "#e8fbff",
        "line-width": 1.1,
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          1,
          ["boolean", ["feature-state", "hover"], false],
          0.7,
          0,
        ],
      },
    },
    {
      id: "locators",
      type: "circle",
      source: "locators",
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          5.5,
          3.2,
        ],
        "circle-color": ["coalesce", ["feature-state", "color"], MISSING],
        "circle-stroke-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#e8fbff",
          ["boolean", ["feature-state", "hover"], false],
          "#2de2ff",
          "rgba(255,255,255,0.35)",
        ],
        "circle-stroke-width": 1,
      },
    },
  ],
};

function readPadding(element: HTMLElement): PaddingOptions {
  const style = getComputedStyle(element);
  const read = (name: string) =>
    parseFloat(style.getPropertyValue(`--map-pad-${name}`)) || 0;
  // Shrink padding on cramped canvases so the world can always be fitted.
  const fit = (a: number, b: number, size: number, share: number) =>
    Math.min(1, (size * share) / Math.max(1, a + b));
  const x = fit(read("left"), read("right"), element.clientWidth, 0.5);
  const y = fit(read("top"), read("bottom"), element.clientHeight, 0.4);
  return {
    top: read("top") * y,
    right: read("right") * x,
    bottom: read("bottom") * y,
    left: read("left") * x,
  };
}

export default function IntelMap({
  ref,
  colors,
  transitionKey,
  selectedIso,
  locators,
  onSelect,
  renderTooltip,
  readout,
  onZoom,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{
    iso: string;
    x: number;
    y: number;
  } | null>(null);
  const latest = useRef({ onSelect, selectedIso, onZoom });
  useLayoutEffect(() => {
    latest.current = { onSelect, selectedIso, onZoom };
  });
  const painted = useRef({
    slot: "a" as "a" | "b",
    key: "",
    colors: new Map<string, string>(),
  });
  const hoverIso = useRef<string | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let stopPulse = () => {};
    let observer: ResizeObserver | null = null;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed) return;
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      let map: MapLibreMap;
      try {
        map = new maplibre.Map({
          container: element,
          style: STYLE,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxZoom: 7.5,
          fadeDuration: 0,
          // The default constraint keeps the whole viewport inside the
          // world's latitude range; this display lets the world sit smaller,
          // between the rails, so only the centre latitude is bounded.
          transformConstrain: (lngLat, zoom) => ({
            center: new maplibre.LngLat(
              lngLat.lng,
              Math.max(-55, Math.min(72, lngLat.lat)),
            ),
            zoom,
          }),
        });
      } catch {
        setFailed(true);
        return;
      }
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      mapRef.current = map;
      // The world view refits on resize until the user takes the camera.
      let userMoved = false;
      map.on("movestart", (event) => {
        if (event.originalEvent) userMoved = true;
      });
      const fitWorld = () => {
        const camera = map.cameraForBounds(WORLD_BOUNDS, {
          padding: readPadding(element),
        });
        if (!camera) return;
        map.setMinZoom(Math.max(0, (camera.zoom ?? 0) - 0.35));
        if (!userMoved) map.jumpTo(camera);
        latest.current.onZoom?.(map.getZoom());
      };
      fitWorld();
      observer = new ResizeObserver(() => {
        map.resize();
        fitWorld();
      });
      observer.observe(element);
      map.on("load", () => {
        if (!disposed) setLoaded(true);
      });
      const pick = (event: MapMouseEvent) =>
        map.queryRenderedFeatures(event.point, {
          layers: ["locators", "heat-a"],
        })[0];
      const setHoverState = (iso: string | null) => {
        if (hoverIso.current === iso) return;
        for (const [value, hovered] of [
          [hoverIso.current, false],
          [iso, true],
        ] as const)
          if (value)
            for (const source of ["countries", "locators"])
              map.setFeatureState({ source, id: value }, { hover: hovered });
        hoverIso.current = iso;
      };
      map.on("mousemove", (event) => {
        const feature = pick(event);
        const iso = feature ? String(feature.id ?? "") || null : null;
        setHoverState(iso);
        map.getCanvas().style.cursor = iso ? "pointer" : "";
        setHover(iso ? { iso, x: event.point.x, y: event.point.y } : null);
        if (readout?.current) {
          const { lng, lat } = event.lngLat;
          readout.current.textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} · ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
        }
      });
      map.on("mouseout", () => {
        setHoverState(null);
        setHover(null);
      });
      map.on("dragstart", () => setHover(null));
      map.on("zoom", () => latest.current.onZoom?.(map.getZoom()));
      map.on("click", (event) => {
        const feature = pick(event);
        const iso = feature ? String(feature.id ?? "") || null : null;
        latest.current.onSelect(
          !iso || iso === latest.current.selectedIso ? null : iso,
        );
        // Touch has no hover, so a tap shows the tooltip for the tapped country.
        setHover(iso ? { iso, x: event.point.x, y: event.point.y } : null);
      });
      map.on("error", (event) => {
        // Imagery failures leave the statistical layers intact; only report others.
        if (!String(event.error?.message ?? "").includes("gibs"))
          console.warn(event.error);
      });
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let lastPulse = 0;
      stopPulse = subscribeFrame((now) => {
        if (motion.matches || !map.isStyleLoaded() || now - lastPulse < 120)
          return;
        lastPulse = now;
        // A slow six-second breath in city-light brightness.
        const phase = (Math.sin((now / 6000) * Math.PI * 2) + 1) / 2;
        map.setPaintProperty(
          "lights",
          "raster-brightness-max",
          0.86 + phase * 0.14,
        );
        map.setPaintProperty("glow", "line-blur", 2 + phase * 3);
      });
    })();
    return () => {
      disposed = true;
      stopPulse();
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [readout]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn({ duration: 300 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: 300 }),
      reset: () => {
        const map = mapRef.current;
        const element = container.current;
        if (!map || !element) return;
        const camera = map.cameraForBounds(WORLD_BOUNDS, {
          padding: readPadding(element),
        });
        if (camera) map.easeTo({ ...camera, duration: 700 });
      },
      focus: (iso: string) => {
        const map = mapRef.current;
        const center =
          LABELS.get(iso) ??
          locators.find((locator) => locator.iso === iso)?.coordinates;
        if (!map || !center) return;
        map.easeTo({
          center,
          zoom: Math.max(map.getZoom(), needsLocator(iso) ? 4.5 : 2.6),
          duration: 900,
        });
      },
    }),
    [locators],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const source = map.getSource<GeoJSONSource>("locators");
    source?.setData({
      type: "FeatureCollection",
      features: locators.map((locator): Feature<Point> => ({
        type: "Feature",
        properties: { iso: locator.iso },
        geometry: { type: "Point", coordinates: locator.coordinates },
      })),
    });
  }, [loaded, locators]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const state = painted.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const crossfade =
      state.key !== "" && state.key !== transitionKey && !reduced;
    const slot = crossfade ? (state.slot === "a" ? "b" : "a") : state.slot;
    const codes = new Set([
      ...state.colors.keys(),
      ...colors.keys(),
      ...NAMES.keys(),
    ]);
    for (const iso of codes) {
      const color = colors.get(iso) ?? null;
      map.setFeatureState({ source: "countries", id: iso }, { [slot]: color });
      map.setFeatureState({ source: "locators", id: iso }, { color });
    }
    if (crossfade) {
      map.setPaintProperty(`heat-${slot}`, "fill-opacity", HEAT_OPACITY);
      map.setPaintProperty(`heat-${state.slot}`, "fill-opacity", 0);
    }
    painted.current = { slot, key: transitionKey, colors };
  }, [loaded, colors, transitionKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !selectedIso) return;
    for (const source of ["countries", "locators"])
      map.setFeatureState({ source, id: selectedIso }, { selected: true });
    return () => {
      if (!map.getStyle()) return;
      for (const source of ["countries", "locators"])
        map.setFeatureState({ source, id: selectedIso }, { selected: false });
    };
  }, [loaded, selectedIso]);

  useLayoutEffect(() => {
    const element = container.current;
    const tip = tooltip.current;
    if (!element || !tip || !hover) return;
    const width = element.clientWidth;
    const height = element.clientHeight;
    tip.style.left = `${Math.max(8, Math.min(width - tip.offsetWidth - 8, hover.x + 18))}px`;
    tip.style.top = `${Math.max(8, Math.min(height - tip.offsetHeight - 8, hover.y - tip.offsetHeight / 2))}px`;
  }, [hover, colors]);

  return (
    <div className="intel-map">
      <div
        ref={container}
        className="intel-map-canvas"
        role="application"
        aria-label="Interactive world heat map. Drag or use arrow keys to pan, plus and minus to zoom. Use country search to select by keyboard."
        onKeyDown={(event) => {
          if (event.key === "Escape") onSelect(null);
        }}
      />
      {failed && (
        <p className="intel-map-error">
          The interactive map needs WebGL, which this browser could not start.
          Rankings, search and the country dossier remain available.
        </p>
      )}
      {hover && (
        <div ref={tooltip} className="intel-tooltip" role="tooltip">
          {renderTooltip(hover.iso, NAMES.get(hover.iso) ?? hover.iso)}
        </div>
      )}
    </div>
  );
}

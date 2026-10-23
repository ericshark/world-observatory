import { geoArea } from "d3-geo";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import countries from "../data/countries-50m.json" with { type: "json" };

type Properties = { iso: string; name: string; label: [number, number] };
const geography = countries as unknown as FeatureCollection<
  Polygon | MultiPolygon,
  Properties
>;
// D3 uses clockwise exterior rings on the sphere; normalize imports once.
for (const feature of geography.features) {
  if (geoArea(feature) > Math.PI * 2) {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) ring.reverse();
  }
}
export default geography;

/** A shared grid keeps coastlines aligned across neighboring country polygons. */
export function sampleDots(
  bounds: [[number, number], [number, number]],
  spacing: number,
  contains: (x: number, y: number) => boolean,
): [number, number][] {
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  const [[left, top], [right, bottom]] = bounds;
  if (![left, top, right, bottom].every(Number.isFinite)) return [];
  const points: [number, number][] = [];
  for (let y = Math.ceil(top / spacing) * spacing; y <= bottom; y += spacing)
    for (let x = Math.ceil(left / spacing) * spacing; x <= right; x += spacing)
      if (contains(x, y)) points.push([x, y]);
  return points;
}

"use client";

import { useNow } from "../lib/clock";
import { formatInteger } from "../lib/format";

/** A number derived from the shared clock. Renders a placeholder until the client clock is available. */
export function Live({
  value,
  format = formatInteger,
  className,
}: {
  value: (now: number) => number;
  format?: (value: number) => string;
  className?: string;
}) {
  const now = useNow();
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {now === null ? (
        <span className="text-ink-muted">—</span>
      ) : (
        format(value(now))
      )}
    </span>
  );
}

export function seriesColor(slot: number | undefined): string {
  return slot ? `var(--series-${slot})` : "var(--dot)";
}

/** Map legend glyphs, drawn the same way the canvas draws birth and death pulses. */
export function BirthGlyph({ color = "var(--ink)" }: { color?: string }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      aria-hidden="true"
      className="inline-block shrink-0"
    >
      <rect width="8" height="8" fill={color} />
    </svg>
  );
}

export function DeathGlyph() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      aria-hidden="true"
      className="inline-block shrink-0"
    >
      <rect
        x="0.75"
        y="0.75"
        width="6.5"
        height="6.5"
        fill="none"
        stroke="var(--ink-muted)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

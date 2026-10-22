"use client";

import { useEffect, useRef } from "react";
import { subscribeFrame } from "../lib/clock";
import { blendRevision, formatNumber, valueAt } from "../lib/metrics";
import type { MetricModel, MetricSelection } from "../lib/metrics-types";

export default function MetricCounter({
  model,
  selection,
  compact = false,
  className = "",
}: {
  model: MetricModel | null;
  selection: MetricSelection;
  compact?: boolean;
  className?: string;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const lastValue = useRef<number | null>(null);
  useEffect(() => {
    if (!model) {
      if (node.current) node.current.textContent = "—";
      lastValue.current = null;
      return;
    }
    const started = Date.now();
    const initial = lastValue.current;
    const initialTarget = valueAt(model, selection, started);
    let lastTick = 0;
    const render = (now: number) => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (now - lastTick < (reducedMotion ? 1000 : 50)) return;
      lastTick = now;
      const target = valueAt(model, selection, now);
      const value =
        initial === null || reducedMotion
          ? target
          : target +
            blendRevision(initial - initialTarget, 0, (now - started) / 1800);
      lastValue.current = value;
      if (node.current) node.current.textContent = formatNumber(value, compact);
    };
    render(started);
    return subscribeFrame(render);
  }, [model, selection, compact]);
  return (
    <span ref={node} className={`tabular-nums ${className}`} aria-live="off">
      —
    </span>
  );
}

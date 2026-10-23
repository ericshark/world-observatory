"use client";

import { useEffect, useRef } from "react";
import { subscribeFrame } from "../lib/clock";
import {
  blendRevision,
  formatNumber,
  valueAt,
  perSecondFor,
} from "../lib/metrics";
import { digitPosition } from "../lib/observatory";
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
  const last = useRef<number | null>(null);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (!model) {
      element.textContent = "—";
      element.setAttribute("aria-label", "Unavailable");
      last.current = null;
      return;
    }
    const started = Date.now();
    const offset =
      last.current === null
        ? 0
        : last.current - valueAt(model, selection, started);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let signature = "";
    let columns: { wheel: HTMLElement; place: number }[] = [];
    let lastText = "";
    const render = (now: number) => {
      const target = valueAt(model, selection, now);
      const value =
        target +
        (reduced.matches
          ? 0
          : blendRevision(offset, 0, (now - started) / 1800));
      last.current = value;
      const text = formatNumber(value, compact);
      if (text !== lastText) {
        element.setAttribute("aria-label", text);
        lastText = text;
      }
      if (compact || reduced.matches || model.historical) {
        element.textContent = text;
        signature = "";
        return;
      }
      const layout = text.replace(/\d/g, "#");
      if (layout !== signature) {
        element.replaceChildren();
        columns = [];
        let place = text.replace(/\D/g, "").length - 1;
        for (const character of text) {
          const slot = document.createElement("span");
          slot.setAttribute("aria-hidden", "true");
          if (/\d/.test(character)) {
            slot.className = "digit-slot";
            const wheel = document.createElement("span");
            wheel.className = "digit-wheel";
            for (let digit = 0; digit <= 10; digit++) {
              const row = document.createElement("span");
              row.textContent = String(digit % 10);
              wheel.append(row);
            }
            slot.append(wheel);
            columns.push({ wheel, place: place-- });
          } else slot.textContent = character;
          element.append(slot);
        }
        signature = layout;
      }
      // Slow statistics step in whole units; fast wheels track the model's fractional phase.
      const rolling =
        Math.abs(perSecondFor(model, now)) >= 10 ? value : Math.floor(value);
      for (const column of columns)
        column.wheel.style.transform = `translateY(${-digitPosition(rolling, column.place)}em)`;
    };
    render(started);
    return subscribeFrame(render);
  }, [model, selection, compact]);
  return (
    <span
      ref={node}
      className={`metric-counter ${className}`}
      role="img"
      aria-label="Loading estimate"
    >
      —
    </span>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COUNTERS } from "../../lib/observatory";
import type { MetricModel } from "../../lib/metrics-types";
import MetricCounter from "../MetricCounter";
import type { DatasetStatus } from "../useLiveDataset";

function UtcClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="utc-clock" aria-label="Coordinated universal time">
      {time ?? "--:--:--"} <small>UTC</small>
    </span>
  );
}

const STATUS_LABEL: Record<DatasetStatus, string> = {
  snapshot: "Published snapshot",
  fresh: "Live link",
  cached: "Live link",
  failed: "Refresh failed · saved data",
};

export default function HudTopBar({
  models,
  activeId,
  onPick,
  status,
  periodKeys,
}: {
  /** World models for each COUNTERS entry, in order. */
  models: (MetricModel | null)[];
  activeId: string;
  onPick: (entryId: string) => void;
  status: DatasetStatus;
  /** Remounts counters at their period boundary (UTC day or year). */
  periodKeys: { day: number; year: number };
}) {
  return (
    <header className="hud-topbar">
      <Link className="hud-brand" href="/">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="11" />
          <ellipse cx="16" cy="16" rx="5" ry="11" />
          <path d="M5 16h22M7 10h18M7 22h18" />
        </svg>
        <span>
          <strong>World Observatory</strong>
          <small>Global intelligence · open data</small>
        </span>
      </Link>
      <nav className="telemetry" aria-label="Worldwide live estimates">
        {COUNTERS.map((counter, index) => {
          const currency =
            counter.selection.metric === "gdp" ||
            counter.selection.metric === "debt";
          const period =
            counter.id === "debt"
              ? "stock"
              : counter.selection.period === "today"
                ? periodKeys.day
                : periodKeys.year;
          return (
            <button
              key={counter.id}
              className="telemetry-cell"
              aria-pressed={activeId === counter.id}
              onClick={() => onPick(counter.id)}
            >
              <span className="telemetry-label">
                {counter.label}
                <small>{counter.period}</small>
              </span>
              <strong>
                {currency && models[index] ? "$" : ""}
                <MetricCounter
                  key={`${counter.id}-${period}`}
                  model={models[index]}
                  selection={counter.selection}
                />
              </strong>
            </button>
          );
        })}
      </nav>
      <div className="hud-status">
        <UtcClock />
        <span className={`status-pill status-${status}`} role="status">
          <i aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </div>
    </header>
  );
}

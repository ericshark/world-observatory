"use client";

import { useId, useState } from "react";
import { SOURCE_NOTE } from "../data/countries";
import PixelFlip from "./PixelFlip";

export default function StatCard({
  title,
  info,
  children,
}: {
  title: string;
  info: string;
  children: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const titleId = useId();

  const front = (
    <div className="h-full min-h-[140px] bg-card p-4 md:p-6">
      <h2
        id={titleId}
        className="my-0 pr-8 text-sm font-medium uppercase tracking-tight text-ink"
      >
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </div>
  );

  const back = (
    <div className="flex h-full flex-col gap-y-2 bg-card p-4 md:p-6">
      <span className="pr-8 text-sm font-medium uppercase tracking-tight text-ink">
        {title}
      </span>
      <p className="m-0 text-sm leading-relaxed text-ink-secondary">{info}</p>
      <p className="m-0 mt-auto text-xs leading-relaxed text-ink-muted">
        {SOURCE_NOTE}
      </p>
    </div>
  );

  return (
    <section
      aria-labelledby={titleId}
      className="group relative overflow-hidden rounded-md"
    >
      <PixelFlip
        flipped={showInfo}
        front={front}
        back={back}
        className="h-full"
      />
      <button
        type="button"
        aria-label={showInfo ? `Back to ${title}` : `About ${title}`}
        aria-pressed={showInfo}
        onClick={() => setShowInfo((value) => !value)}
        className={`absolute right-2 top-2 z-20 flex cursor-pointer items-center justify-center rounded border border-border p-1 text-ink-secondary transition-[opacity,color,background-color] duration-150 hover:bg-card-hover hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink ${
          showInfo
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
        }`}
      >
        {showInfo ? <CloseIcon /> : <InfoIcon />}
      </button>
    </section>
  );
}

export function MetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="text-sm uppercase text-ink-secondary">{label}</span>
      <span className="text-sm text-ink tabular-nums">{children}</span>
    </li>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

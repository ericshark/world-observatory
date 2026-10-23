"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "../lib/theme";

type ThemeChoice = "system" | "light" | "dark";
const order: ThemeChoice[] = ["dark", "light"];

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "dark";
}

function writeChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice still applies for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const labels: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export default function ThemeToggle() {
  const choice = useSyncExternalStore(
    subscribe,
    readChoice,
    () => "dark" as const,
  );
  const next = order[(order.indexOf(choice) + 1) % order.length];

  return (
    <button
      type="button"
      onClick={() => writeChoice(next)}
      aria-label={`Theme: ${labels[choice]}. Switch to ${labels[next]}.`}
      className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs uppercase text-ink-secondary transition-colors hover:bg-card-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink cursor-pointer"
    >
      <ThemeIcon choice={choice} />
      {labels[choice]}
    </button>
  );
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    "aria-hidden": true,
  } as const;

  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1" />
      <path d="M5.5 14.5h5M8 11.5v3" />
    </svg>
  );
}

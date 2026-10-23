import type { IconId } from "../../lib/catalog";

const PATHS: Record<IconId, string> = {
  people:
    "M7 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6.5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5M11.5 12c.6-.3 1.3-.5 2-.5 2.2 0 4 1.5 4 4.5",
  cradle:
    "M3 9h14l-1.5 4.5a3 3 0 0 1-2.8 2H7.3a3 3 0 0 1-2.8-2L3 9Zm4-4.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0ZM5.5 15.5 4 18m10.5-2.5L16 18",
  candle:
    "M8 9h4v8H8zM10 9V7m0-4c1.3 1.2 1.8 2.3 0 4-1.8-1.7-1.3-2.8 0-4ZM5 17h10",
  heart:
    "M10 16.5S3 12.4 3 7.8A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.8c0 4.6-7 8.7-7 8.7ZM5.5 10h2.5l1-2 2 4 1-2h2.5",
  city: "M3 17V8l4-2v11m0-7h4v7m0-10 3-2 3 2v12M2 17h16M9 12h0m0 2h0m5-6h0m0 2h0m0 2h0",
  output: "M3 17h14M5 17v-5m3.5 5V9m3.5 8v-7m3.5 7V5M4 9l4-4 3 3 5-5m-3 0h3v3",
  "person-coin":
    "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 8c0-2.8 2-4.5 4.5-4.5 1.2 0 2.3.4 3 1.1M14.5 17.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-4.5v3",
  prices:
    "M3 10.5 10 3.5h6.5V10L9.5 17 3 10.5Zm10-4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1ZM8 9.5l3 3m-1.5-4.5 1-1",
  jobs: "M3 7.5h14v8.5H3zM7.5 7.5V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M3 11.5h14M9 11v1.5h2V11",
  ledger:
    "M5 3h10v14H5zM8 3v14M10.5 7h2.5m-2.5 3h2.5m-2.5 3h2.5M3.5 6h3m-3 4h3m-3 4h3",
  "person-ledger":
    "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 8c0-2.8 2-4.5 4.5-4.5M11.5 10h6v7.5h-6zM13.5 12.5h2m-2 2.5h2",
  gauge:
    "M3.5 14a6.5 6.5 0 1 1 13 0M10 14l3.5-4M5.5 14h-2m13 0h-2M10 7.5V6M6 9.5 5 8.5m9 1 1-1",
  smoke:
    "M4 17h12M6 17v-5h3v5m2 0V9h3v8M7.5 9.5c-1.5-1 0-2.5 1-2.5s1.5-1.5 1-2.5m3 3c-1.5-1 0-2.5 1-2.5s1.5-1.5 1-2.5",
};

export function MetricIcon({ id, size = 18 }: { id: IconId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}

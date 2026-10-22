import type { Dataset, MetricsResponse } from "./metrics-types.ts";
import { validateDataset } from "./providers.ts";

const DAY = 24 * 60 * 60 * 1000;
/** Coalesce refreshes; failures retain the complete last-known-good release. */
export function createMetricsCache(
  snapshot: Dataset,
  load: () => Promise<Dataset>,
  clock = Date.now,
) {
  let dataset = snapshot;
  let status: MetricsResponse["status"] = "snapshot";
  let refreshFailed = false;
  let lastAttempt = -Infinity;
  let pending: Promise<void> | null = null;
  return async function getMetrics(): Promise<MetricsResponse> {
    const now = clock();
    const expired = now - Date.parse(dataset.fetchedAt) >= DAY;
    if (
      (expired || refreshFailed) &&
      now - lastAttempt >= 5 * 60_000 &&
      !pending
    ) {
      lastAttempt = now;
      pending = (async () => {
        try {
          const next = await load();
          if (!validateDataset(next))
            throw new Error("Invalid refreshed dataset");
          dataset = next;
          status = "fresh";
          refreshFailed = false;
        } catch {
          refreshFailed = true;
        } finally {
          pending = null;
        }
      })();
    }
    if (pending) await pending;
    const response = { dataset, status, refreshFailed };
    if (status === "fresh") status = "cached";
    return response;
  };
}

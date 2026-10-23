"use client";

import { useEffect, useState } from "react";
import type { Dataset, MetricsResponse } from "../lib/metrics-types";
import { validateDataset } from "../lib/providers";

export type DatasetStatus = "snapshot" | "fresh" | "cached" | "failed";

/** Polls the cached metrics route every five minutes while the page is visible. */
export function useLiveDataset(initialData: Dataset) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState<DatasetStatus>("snapshot");
  useEffect(() => {
    const controller = new AbortController();
    let active = false;
    const refresh = async () => {
      if (document.hidden || active) return;
      active = true;
      try {
        const response = await fetch("/api/metrics", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Refresh failed");
        const result: MetricsResponse = await response.json();
        if (!validateDataset(result.dataset))
          throw new Error("Invalid dataset");
        if (!controller.signal.aborted) {
          setData((previous) =>
            previous.fetchedAt === result.dataset.fetchedAt
              ? previous
              : result.dataset,
          );
          setStatus(result.refreshFailed ? "failed" : result.status);
        }
      } catch {
        if (!controller.signal.aborted) setStatus("failed");
      } finally {
        active = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 300_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { data, status };
}

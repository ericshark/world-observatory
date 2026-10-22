import snapshot from "../../data/metrics-snapshot.json";
import { createMetricsCache } from "../../lib/metrics-cache";
import { fetchDataset } from "../../lib/providers";
import type { Dataset } from "../../lib/metrics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getMetrics = createMetricsCache(snapshot as Dataset, () =>
  fetchDataset(),
);
export async function GET() {
  return Response.json(await getMetrics(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

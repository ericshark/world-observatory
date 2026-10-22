import Dashboard from "./components/Dashboard";
import snapshot from "./data/metrics-snapshot.json";
import type { Dataset } from "./lib/metrics-types";

export default async function Home() {
  return (
    <Dashboard initialData={snapshot as Dataset} referenceTime={Date.parse(snapshot.fetchedAt)} />
  );
}

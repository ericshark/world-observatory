import { writeFile, rename, mkdir } from "node:fs/promises";
import { fetchDataset } from "../app/lib/providers.ts";

const data = await fetchDataset();
const target = new URL("../app/data/metrics-snapshot.json", import.meta.url);
await mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
const temporary = new URL(
  "../app/data/metrics-snapshot.json.tmp",
  import.meta.url,
);
await writeFile(temporary, JSON.stringify(data));
await rename(temporary, target);
console.log(
  `Saved ${data.countries.length} countries. Fetched ${data.fetchedAt}. ${data.sources.imf.label}.`,
);
for (const key of [
  "population",
  "birthRate",
  "deathRate",
  "migration",
  "gdp",
  "debtRatio",
  "homicideRate",
  "co2",
] as const) {
  console.log(
    `${key}: ${data.countries.filter((c) => c.series[key]?.length).length} countries`,
  );
}

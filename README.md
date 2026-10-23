# World Observatory

A cyberpunk-styled global intelligence dashboard for population, births, deaths, life expectancy, urbanization, GDP, inflation, unemployment, general-government gross debt, and CO₂ emissions. Built with Next.js, React, TypeScript, MapLibre GL JS (Web Mercator map over NASA night-lights imagery), and three.js (Earth horizon).

## Run locally

Requires Node.js 24+ (the data tools and tests use native TypeScript stripping) and pnpm.

```sh
pnpm install
pnpm dev --port 3001
```

If 3001 is occupied, increment the port. Stop the server when finished.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm start --port 3001
```

## Real data, continuously estimated

The committed `app/data/metrics-snapshot.json` is downloaded from public providers, validated, and used on first render. It contains country observations, published world aggregates, country identifiers, source dates, and the IMF forecast boundary. No API keys, database, or paid service are required.

```sh
pnpm data:refresh
```

This command fetches and validates a complete release before atomically replacing the snapshot. Review and commit the resulting data change. Failed imports preserve the existing file.

The read-only `/api/metrics` route maintains an in-process, 24-hour cache initialized from the snapshot. Requests share one refresh; failed or malformed refreshes retain the last valid complete dataset and retry after five minutes. Cache lifetime is per server process; instances do not share persistence. The browser checks the route every five minutes while visible and when returning to the page. Upstream providers are not called for every visitor or every animation frame. The UI shows source dates and warns when refreshes fail.

### Sources and definitions

- [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392): `SP.POP.TOTL`, `SP.DYN.CBRT.IN`, `SP.DYN.CDRT.IN`, `SM.POP.NETM`, `VC.IHR.PSRC.P5` (UNODC), `EN.GHG.CO2.MT.CE.AR5`, `SP.DYN.LE00.IN` (life expectancy), `SP.URB.TOTL.IN.ZS` (urban population %), `FP.CPI.TOTL.ZG` (CPI inflation, may be negative), and `SL.UEM.TOTL.ZS` (ILO modelled unemployment). Fresh imports require at least 100 countries for each of the four newest series; older snapshots without them still validate.
- Imagery: NASA [GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) `VIIRS_Black_Marble` 2016 tiles (EPSG:3857, loaded at runtime) and the Black Marble 2016 texture in `public/textures/` for the horizon. Both are 2016 composites, not live. If tiles fail, the statistical layers still render.
- [IMF DataMapper API](https://www.imf.org/external/datamapper/api/): `NGDPD` (billions of current USD, converted to dollars) and `GGXWDG_NGDP` (percent of GDP), plus release metadata. The source's global projection-year boundary labels forecasts; country-specific estimate cutoffs can differ.
- World Bank [data terms and attribution](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) and IMF [copyright and usage](https://www.imf.org/external/terms.htm) apply. The source attribution and links remain visible in the dashboard.

Population estimates use matching-year population, crude birth/death rates, and **annual** net migration. The population balance is anchored to July 1 of that observation year. World migration cancels out. Country growth estimates do not sum exactly to published world aggregates; world figures are independently sourced.

Births, deaths, GDP output, homicide counts, and CO₂ are annual flows distributed uniformly over the actual UTC calendar year. Births/deaths can also show counts since UTC midnight. Annual GDP is output, not a stock of wealth. Homicide annual counts are derived from the reported rate and population from the same year. Records older than five years remain historical and do not drive current estimates or default rankings. Latest historical homicide observations are retained even when they predate the chart window.

Debt is a stock: matching-release, matching-year GDP multiplied by gross-debt-to-GDP. The dashboard interpolates consecutive year-end USD-equivalent balances; a country can have decreasing debt. Changes include exchange-rate and valuation effects and should not be interpreted as a borrowing meter. Missing consecutive balances remain static historical data.

Per-person economic measures use the latest population observation at or before the economic source year; the population basis year is displayed. CO₂ is converted from megatonnes to tonnes and excludes land-use change and forestry. Homicides measure intentional homicides, not all crime.

Unknown values stay unavailable. Countries and economies come from the World Bank catalogue, augmented by Taiwan from IMF coverage and the map's otherwise unrepresented territories. Regional and analytical aggregates never enter country rankings. World counters use provider world aggregates. Disputed boundaries and capital locator positions are illustrative map features, not statements about sovereignty.

### Interaction and accessibility

The dark command-centre layout has a top telemetry strip, a central map and two rails. The strip shows six worldwide rolling counters: population, births today, deaths today, GDP this year, government debt and CO₂ this year. The cyan left rail holds the active signal readout, the signal library and the distribution. The magenta right rail holds the target dossier, the trend vector and the rankings. Every statistic is one entry in `app/lib/catalog.ts`. A `live` entry reuses the continuously estimated models; a `level` entry shows the latest annual observation. Adding a metric means adding one catalog entry, plus a `WB_INDICATORS` line for new data.

- **Signal library.** Rows are grouped into Demographics, Economy, Public finance and Environment. Each row shows the world value and the change between the two latest annual observations, as a percent or in percentage points. An "f" marks an IMF forecast year. Category colors identify icons only.
- **Map.** MapLibre renders Natural Earth 1:50m countries as heat fills over NASA night lights. Countries under about 5,000 km² get locator dots. Drag, scroll, pinch or use the keyboard to move; the +, − and ⌂ controls zoom and reset; Esc deselects. Hover or tap for value, unit, source year, forecast/historical status, population basis and rank. Changing the metric crossfades the fills.
- **Colors.** A violet → magenta → red → orange → amber ramp rises monotonically in lightness and was validated against the dark surface. It encodes value, not risk. Totals use a zero-compatible logarithmic scale, rates a linear one. Inflation is linear between the 5th and 90th percentiles, and both legends mark the clipped ends with ≤ and ≥. Missing and historical values are a neutral violet-gray.
- **Dossier.** It shows the world or the selected country: global and regional rank, share of world for additive totals, and eight key indicators. For a country, each indicator has a percentile bar with its source year.
- **Trend vector.** Ten annual observations, with IMF forecast years dashed, plus a hover crosshair and an annual data table.
- **Links.** Use `?metric=<catalog id>&country=XX`. Older `metric`/`view`/`mapMeasure` links map onto catalog entries.
- **Counters.** Debt counters use fixed-width digit spans updated per animation frame, from a shared monotonic UTC clock that pauses in hidden tabs. Revisions reconcile through a bounded rate correction. These are modelled estimates, not official real-time measurements. Counters always animate, while reduced motion stops the panel scans, light pulse, horizon rotation and crossfades.
- **Small screens.** Below 900px the rails stack under the map and the telemetry strip scrolls horizontally.

The MapLibre module worker is served from `/vendor/maplibre-gl-worker.mjs` (a static route reading `node_modules`), because the library otherwise looks for it next to its bundled chunk.

## Verification

Native Node tests cover the metric catalog (legacy links, level readings, derived histories, coverage), clipped and signed heat scales, new indicator imports, calendar math, matching-year joins, falling debt, missing data, provider validation and unit conversion, URL state, source revisions, cache refresh coalescing, snapshot fallback, exact debt interpolation at simulated 60/120 Hz, bounded revision rates, clock resume, heat-scale/legend agreement, normalized measures, and duplicate-ISO geometry. UI verification uses the installed Playwright skill in headless Chromium; no browser windows or previews are opened automatically.

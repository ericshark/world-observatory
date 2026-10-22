# World Pulse

An interactive dotted-map observatory for population, births, deaths, GDP, general-government gross debt, intentional homicides, and CO₂ emissions. Built with Next.js, React, TypeScript, and a canvas map using d3-geo.

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

- [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392): `SP.POP.TOTL`, `SP.DYN.CBRT.IN`, `SP.DYN.CDRT.IN`, `SM.POP.NETM`, `VC.IHR.PSRC.P5` (UNODC), and `EN.GHG.CO2.MT.CE.AR5`.
- [IMF DataMapper API](https://www.imf.org/external/datamapper/api/): `NGDPD` (billions of current USD, converted to dollars) and `GGXWDG_NGDP` (percent of GDP), plus release metadata. The source's global projection-year boundary labels forecasts; country-specific estimate cutoffs can differ.
- World Bank [data terms and attribution](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) and IMF [copyright and usage](https://www.imf.org/external/terms.htm) apply. The source attribution and links remain visible in the dashboard.

Population estimates use matching-year population, crude birth/death rates, and **annual** net migration. The population balance is anchored to July 1 of that observation year. World migration cancels out. Country growth estimates do not sum exactly to published world aggregates; world figures are independently sourced.

Births, deaths, GDP output, homicide counts, and CO₂ are annual flows distributed uniformly over the actual UTC calendar year. Births/deaths can also show counts since UTC midnight. Annual GDP is output, not a stock of wealth. Homicide annual counts are derived from the reported rate and population from the same year. Records older than five years remain historical and do not drive current estimates or default rankings. Latest historical homicide observations are retained even when they predate the chart window.

Debt is a stock: matching-release, matching-year GDP multiplied by gross-debt-to-GDP. The dashboard interpolates consecutive year-end USD-equivalent balances; a country can have decreasing debt. Changes include exchange-rate and valuation effects and should not be interpreted as a borrowing meter. Missing consecutive balances remain static historical data.

Per-person economic measures use the latest population observation at or before the economic source year; the population basis year is displayed. CO₂ is converted from megatonnes to tonnes and excludes land-use change and forestry. Homicides measure intentional homicides, not all crime.

Unknown values stay unavailable. Countries and economies come from the World Bank catalogue, augmented by Taiwan from IMF coverage and the map's otherwise unrepresented territories. Regional and analytical aggregates never enter country rankings. World counters use provider world aggregates. Disputed boundaries and capital locator positions are illustrative map features, not statements about sovereignty.

### Interaction and accessibility

Drag or pinch the map, scroll to zoom around the pointer, or use its controls. When the map has keyboard focus, arrows pan, `+`/`-` zoom, `Home` resets, and `Escape` returns to the world. Country search and ranking buttons provide a keyboard alternative to the canvas. Pin at most three countries to compare annual source history, normalized values, and source years. Metric, subview, measure, period, country, and comparison state are shareable through URL parameters.

Map totals use logarithmic shading; rates and per-person measures use linear shading. Rings represent countries too small for the dotted geometry. Country selection and comparison highlights supersede the heat color. Birth/death pulses sample country rates at capped visual frequency and random locations; they do not identify actual events. Other metrics have no incident pulses.

All moving counters derive from wall time, with short interpolation for source revisions in either direction. Values do not drift by accumulating frame increments. A shared animation clock pauses in hidden tabs; reduced motion disables pulses and updates numbers once a second. Charts show actual annual observations, gaps, and dashed forecast segments, with accessible data tables.

## Verification

Native Node tests cover calendar math, matching-year joins, falling debt, missing data, provider validation and unit conversion, URL state, source revisions, cache refresh coalescing, and snapshot fallback. UI verification uses the installed Playwright skill in headless Chromium; no browser windows or previews are opened automatically.

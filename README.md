# World Observatory

An interactive geographic observatory for population, births, deaths, GDP, general-government gross debt, and CO₂ emissions. Built with Next.js, React, TypeScript, and a canvas map using d3-geo.

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

The black, monospace dashboard presents six worldwide counters: population, births today, deaths today, GDP this year, government debt, and CO₂ this year. Select a card to explore its country estimates. The hero follows the selected country; the six overview cards always remain worldwide. Country search provides a keyboard alternative to the map. Sources and methodology are available in the collapsed About the data panel.

Drag or pinch the geographic heat map, scroll to zoom around the pointer, or use its controls. With map keyboard focus, arrows pan, `+`/`-` zoom, `Home` resets, and `Escape` returns to the world. Natural Earth v5.1.2 1:50m geometry drives cached, device-pixel-resolution polygon fills and selection. Every geometry feature is retained, including multiple features sharing a country identifier. Blue–teal–amber–red colors encode actual country values; they are not risk ratings. Totals and debt per person use a zero-compatible logarithmic scale (`log1p(value / smallestPositiveValue)`); debt / GDP uses a linear scale. Legend ticks and country fills share the same scale, whose bounds include all eligible countries. Missing and historical-only current values are neutral gray, distinct from zero. Small islands use locator rings. Hover or tap for values, units, source years, forecast/estimate status, release dates, and population basis years where relevant.

Metric and country links remain shareable. The debt map offers total debt, debt per person, and debt / GDP through a compact selector; `mapMeasure=total|perCapita|debtRatio` preserves this choice in links. The hero, overview and leaderboard continue showing total debt. Debt per person divides the interpolated balance by the latest available population at or before the debt source year; debt / GDP displays the published source-year ratio, not a live ratio. Other metrics retain their existing counter-period totals. Legacy homicide links normalize to population; comparison parameters are discarded and unsupported map measures resolve to total. The underlying source dataset retains all historical series.

Debt counters use fixed-width digit spans, updating only changed characters each animation frame. A shared monotonic clock uses `performance.now()` anchored to UTC, pauses rendering in hidden tabs, and catches up after returning or device sleep. Debt endpoints are rounded once to whole dollars; BigInt microdollar interpolation avoids accumulated arithmetic drift without implying additional source accuracy. Positive trends increase and negative trends decrease; historical and zero-growth balances stay static. Revisions start at the currently displayed estimate and reconcile through a temporary rate correction capped at 50% of the new underlying rate over at least 60 seconds. Large revisions take longer to converge. Static observations update directly when their source changes. These are estimates, not official real-time debt measurements. Other counters retain their rolling digit presentation. Fast totals may skip intermediate integers; no fake digits are introduced. Reduced motion updates counters once per second and disables map color transitions, while map controls remain responsive. Dark is the default; explicit saved light or dark choices are honored.

## Verification

Native Node tests cover calendar math, matching-year joins, falling debt, missing data, provider validation and unit conversion, URL state, source revisions, cache refresh coalescing, snapshot fallback, exact debt interpolation at simulated 60/120 Hz, bounded revision rates, clock resume, heat-scale/legend agreement, normalized measures, and duplicate-ISO geometry. UI verification uses the installed Playwright skill in headless Chromium; no browser windows or previews are opened automatically.

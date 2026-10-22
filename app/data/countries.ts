/**
 * Population inputs, based on UN DESA World Population Prospects 2024
 * (medium variant, 2025 estimates). Values are rounded.
 *
 * Each row: iso2, name, population on 1 Jul 2025, crude birth rate and crude
 * death rate (per 1,000 people per year), and net migration (people per year).
 *
 * Only countries drawn on the dotted map are listed. World totals are kept
 * separately in WORLD because many small states have no dots.
 */
type Row = [
  iso2: string,
  name: string,
  population: number,
  birthRate: number,
  deathRate: number,
  netMigration: number,
];

const rows: Row[] = [
  ["IN", "India", 1_463_870_000, 16.0, 7.0, -500_000],
  ["CN", "China", 1_416_100_000, 6.5, 8.2, -270_000],
  ["US", "United States", 347_280_000, 10.6, 9.0, 1_260_000],
  ["ID", "Indonesia", 285_720_000, 15.4, 6.8, -40_000],
  ["PK", "Pakistan", 255_220_000, 26.8, 6.9, -1_000_000],
  ["NG", "Nigeria", 237_530_000, 33.6, 12.0, -30_000],
  ["BR", "Brazil", 212_810_000, 11.8, 7.3, 0],
  ["BD", "Bangladesh", 175_690_000, 17.0, 5.6, -500_000],
  ["RU", "Russia", 143_990_000, 8.6, 13.0, 200_000],
  ["ET", "Ethiopia", 135_470_000, 30.5, 5.8, -30_000],
  ["MX", "Mexico", 131_950_000, 14.0, 6.4, -100_000],
  ["JP", "Japan", 123_100_000, 6.0, 13.1, 150_000],
  ["EG", "Egypt", 118_370_000, 19.0, 5.6, -70_000],
  ["PH", "Philippines", 116_790_000, 18.5, 6.0, -200_000],
  ["CD", "DR Congo", 112_830_000, 41.0, 9.0, -50_000],
  ["VN", "Vietnam", 101_600_000, 14.4, 6.6, -100_000],
  ["IR", "Iran", 92_420_000, 12.6, 4.9, -100_000],
  ["TR", "Türkiye", 87_690_000, 11.7, 6.0, -100_000],
  ["DE", "Germany", 84_080_000, 8.2, 12.2, 350_000],
  ["TH", "Thailand", 71_620_000, 6.8, 8.2, 20_000],
  ["TZ", "Tanzania", 70_550_000, 35.7, 5.6, -30_000],
  ["GB", "United Kingdom", 69_550_000, 10.0, 9.0, 400_000],
  ["FR", "France", 66_650_000, 10.0, 9.4, 80_000],
  ["ZA", "South Africa", 64_750_000, 18.2, 9.3, 100_000],
  ["IT", "Italy", 59_150_000, 6.4, 11.6, 250_000],
  ["KE", "Kenya", 57_530_000, 26.6, 5.9, -10_000],
  ["MM", "Myanmar", 54_850_000, 15.5, 8.0, -100_000],
  ["CO", "Colombia", 53_430_000, 12.0, 6.0, 0],
  ["KR", "South Korea", 51_670_000, 4.7, 7.0, 50_000],
  ["SD", "Sudan", 51_660_000, 33.6, 7.4, -300_000],
  ["UG", "Uganda", 51_380_000, 36.5, 5.4, 100_000],
  ["ES", "Spain", 47_890_000, 6.9, 9.4, 450_000],
  ["DZ", "Algeria", 47_440_000, 20.5, 4.5, -10_000],
  ["IQ", "Iraq", 47_020_000, 27.0, 4.6, 0],
  ["AR", "Argentina", 45_850_000, 10.8, 7.7, 4_000],
  ["AF", "Afghanistan", 43_840_000, 34.0, 6.5, -60_000],
  ["YE", "Yemen", 41_770_000, 33.0, 6.0, -10_000],
  ["CA", "Canada", 40_130_000, 9.3, 8.2, 350_000],
  ["AO", "Angola", 39_040_000, 38.0, 7.0, 0],
  ["UA", "Ukraine", 38_980_000, 5.5, 15.4, 0],
  ["MA", "Morocco", 38_430_000, 16.7, 6.6, -40_000],
  ["PL", "Poland", 38_140_000, 6.8, 11.0, 0],
  ["UZ", "Uzbekistan", 37_050_000, 23.5, 4.7, -20_000],
  ["MY", "Malaysia", 35_980_000, 12.0, 5.5, 50_000],
  ["MZ", "Mozambique", 35_630_000, 36.0, 7.5, -5_000],
  ["GH", "Ghana", 35_060_000, 26.3, 7.0, -10_000],
  ["PE", "Peru", 34_580_000, 16.0, 6.3, 0],
  ["SA", "Saudi Arabia", 34_570_000, 15.0, 3.1, 200_000],
  ["MG", "Madagascar", 32_740_000, 31.0, 6.0, 0],
  ["CI", "Côte d'Ivoire", 32_710_000, 32.5, 7.5, 20_000],
  ["CM", "Cameroon", 29_880_000, 34.0, 7.5, -20_000],
  ["NP", "Nepal", 29_620_000, 18.0, 6.6, -60_000],
  ["VE", "Venezuela", 28_520_000, 15.3, 7.0, 0],
  ["NE", "Niger", 27_920_000, 44.0, 8.0, 0],
  ["AU", "Australia", 26_970_000, 11.3, 6.8, 300_000],
  ["KP", "North Korea", 26_570_000, 12.5, 9.0, 0],
  ["SY", "Syria", 25_620_000, 21.0, 4.6, 100_000],
  ["ML", "Mali", 25_200_000, 40.0, 9.0, -40_000],
  ["BF", "Burkina Faso", 24_070_000, 34.0, 8.0, -20_000],
  ["LK", "Sri Lanka", 23_230_000, 11.0, 7.8, -50_000],
  ["ZM", "Zambia", 21_910_000, 33.5, 5.8, 0],
  ["TD", "Chad", 21_000_000, 43.0, 11.0, 100_000],
  ["KZ", "Kazakhstan", 20_840_000, 17.5, 7.0, -10_000],
  ["CL", "Chile", 19_860_000, 8.5, 6.5, 100_000],
  ["SO", "Somalia", 19_650_000, 43.0, 10.5, -40_000],
  ["RO", "Romania", 18_910_000, 8.6, 13.2, 0],
  ["SN", "Senegal", 18_930_000, 31.5, 5.3, -30_000],
  ["GT", "Guatemala", 18_690_000, 21.0, 5.0, -50_000],
  ["EC", "Ecuador", 18_290_000, 14.5, 5.4, -50_000],
  ["ZW", "Zimbabwe", 16_950_000, 29.0, 7.8, -100_000],
  ["GN", "Guinea", 15_100_000, 35.0, 8.5, -5_000],
  ["BJ", "Benin", 14_810_000, 34.0, 8.5, 0],
  ["BO", "Bolivia", 12_580_000, 21.0, 6.8, -7_000],
  ["TN", "Tunisia", 12_350_000, 11.5, 6.5, -10_000],
  ["SS", "South Sudan", 12_190_000, 30.0, 10.5, 0],
  ["JO", "Jordan", 11_520_000, 21.0, 3.8, 0],
  ["AE", "United Arab Emirates", 11_350_000, 9.0, 1.7, 200_000],
  ["HN", "Honduras", 11_000_000, 21.0, 4.6, -40_000],
  ["CU", "Cuba", 10_940_000, 7.5, 11.0, -150_000],
  ["TJ", "Tajikistan", 10_790_000, 24.5, 4.3, -10_000],
  ["PG", "Papua New Guinea", 10_760_000, 25.0, 6.5, 0],
  ["CZ", "Czechia", 10_730_000, 7.8, 10.6, 30_000],
  ["SE", "Sweden", 10_660_000, 9.3, 8.4, 30_000],
  ["PT", "Portugal", 10_410_000, 8.0, 11.0, 80_000],
  ["AZ", "Azerbaijan", 10_400_000, 10.5, 6.1, 0],
  ["GR", "Greece", 9_940_000, 7.0, 12.6, 20_000],
  ["HU", "Hungary", 9_630_000, 8.0, 13.3, 10_000],
  ["AT", "Austria", 9_110_000, 8.4, 9.6, 50_000],
  ["BY", "Belarus", 8_990_000, 6.8, 13.2, 0],
  ["LA", "Laos", 7_870_000, 20.5, 6.2, -10_000],
  ["TM", "Turkmenistan", 7_620_000, 20.5, 6.3, -5_000],
  ["LY", "Libya", 7_460_000, 17.0, 5.3, 0],
  ["KG", "Kyrgyzstan", 7_300_000, 22.0, 5.0, -5_000],
  ["PY", "Paraguay", 7_010_000, 19.0, 5.8, -10_000],
  ["NI", "Nicaragua", 7_000_000, 19.5, 5.0, -50_000],
  ["BG", "Bulgaria", 6_710_000, 8.4, 15.8, 0],
  ["RS", "Serbia", 6_690_000, 8.8, 14.8, 0],
  ["CG", "Republic of the Congo", 6_480_000, 31.0, 6.0, 0],
  ["LB", "Lebanon", 5_850_000, 14.5, 7.0, 0],
  ["LR", "Liberia", 5_730_000, 31.0, 7.2, -5_000],
  ["FI", "Finland", 5_620_000, 7.8, 10.2, 40_000],
  ["NO", "Norway", 5_620_000, 9.7, 7.9, 30_000],
  ["CF", "Central African Republic", 5_510_000, 44.0, 11.5, 0],
  ["OM", "Oman", 5_490_000, 15.0, 2.4, 50_000],
  ["SK", "Slovakia", 5_470_000, 9.0, 11.0, 2_000],
  ["IE", "Ireland", 5_310_000, 10.6, 6.5, 50_000],
  ["MR", "Mauritania", 5_310_000, 32.0, 6.5, 5_000],
  ["NZ", "New Zealand", 5_250_000, 11.3, 7.0, 20_000],
  ["CR", "Costa Rica", 5_150_000, 10.2, 5.6, 10_000],
  ["PA", "Panama", 4_570_000, 15.0, 5.0, 10_000],
  ["HR", "Croatia", 3_850_000, 8.6, 13.5, 30_000],
  ["GE", "Georgia", 3_810_000, 11.0, 12.3, 0],
  ["MN", "Mongolia", 3_520_000, 19.5, 5.6, -3_000],
  ["UY", "Uruguay", 3_380_000, 9.1, 10.0, 0],
  ["BA", "Bosnia and Herzegovina", 3_140_000, 8.4, 13.0, -10_000],
  ["NA", "Namibia", 3_090_000, 26.5, 6.8, 0],
  ["MD", "Moldova", 2_970_000, 9.5, 13.6, -10_000],
  ["LT", "Lithuania", 2_830_000, 7.0, 13.0, 10_000],
  ["GA", "Gabon", 2_590_000, 27.5, 5.8, 2_000],
  ["BW", "Botswana", 2_560_000, 22.5, 6.3, 3_000],
  ["LV", "Latvia", 1_850_000, 7.0, 14.6, -3_000],
  ["EE", "Estonia", 1_340_000, 7.4, 11.5, 0],
  ["FJ", "Fiji", 930_000, 17.0, 8.5, -6_000],
  ["GY", "Guyana", 830_000, 19.0, 7.5, 0],
  ["BT", "Bhutan", 790_000, 12.5, 6.0, -3_000],
  ["SR", "Suriname", 640_000, 15.5, 7.8, 0],
  ["EH", "Western Sahara", 590_000, 18.0, 5.1, 5_000],
  ["IS", "Iceland", 400_000, 11.5, 6.5, 5_000],
  ["GL", "Greenland", 56_000, 13.8, 8.9, -300],
  // Not listed separately in WPP. Counted as residents with no modelled change.
  ["SJ", "Svalbard and Jan Mayen", 2_600, 0, 0, 0],
  ["GS", "South Georgia", 30, 0, 0, 0],
];

export interface Country {
  iso2: string;
  name: string;
  population2025: number;
  birthsPerYear: number;
  deathsPerYear: number;
  netMigrationPerYear: number;
  /** 1-based categorical color slot, set only for the most populous countries. */
  seriesSlot?: number;
}

export const HIGHLIGHTED_COUNT = 7;

export const countries: Country[] = rows
  .map(([iso2, name, population, birthRate, deathRate, netMigration]) => ({
    iso2,
    name,
    population2025: population,
    birthsPerYear: (population * birthRate) / 1000,
    deathsPerYear: (population * deathRate) / 1000,
    netMigrationPerYear: netMigration,
  }))
  .sort((a, b) => b.population2025 - a.population2025)
  .map((country, rank) => ({
    ...country,
    seriesSlot: rank < HIGHLIGHTED_COUNT ? rank + 1 : undefined,
  }));

export const countriesByIso = new Map(countries.map((c) => [c.iso2, c]));

/** WPP 2024 world totals for 2025, which include every state, not only those on the map. */
export const WORLD = {
  population2025: 8_231_610_000,
  birthsPerYear: 132_000_000,
  deathsPerYear: 62_500_000,
} as const;

export const SOURCE_NOTE =
  "UN DESA, World Population Prospects 2024 (medium variant). Modelled from 1 Jul 2025 estimates.";

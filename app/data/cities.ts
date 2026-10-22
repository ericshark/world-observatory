export interface City {
  name: string;
  iso2: string;
  population: number;
  coordinates: [lon: number, lat: number];
}

/**
 * Ten largest cities, UN World Urbanization Prospects 2025. That edition
 * defines cities by a harmonised "degree of urbanisation" boundary rather
 * than national definitions, which is why Jakarta and Dhaka now outrank Tokyo.
 */
export const largestCities: City[] = [
  {
    name: "Jakarta",
    iso2: "ID",
    population: 41_900_000,
    coordinates: [106.8275, -6.175],
  },
  {
    name: "Dhaka",
    iso2: "BD",
    population: 36_600_000,
    coordinates: [90.4125, 23.8103],
  },
  {
    name: "Tokyo",
    iso2: "JP",
    population: 33_400_000,
    coordinates: [139.6922, 35.6897],
  },
  {
    name: "New Delhi",
    iso2: "IN",
    population: 30_200_000,
    coordinates: [77.209, 28.6139],
  },
  {
    name: "Shanghai",
    iso2: "CN",
    population: 29_600_000,
    coordinates: [121.4737, 31.2304],
  },
  {
    name: "Guangzhou",
    iso2: "CN",
    population: 27_600_000,
    coordinates: [113.2644, 23.1291],
  },
  {
    name: "Cairo",
    iso2: "EG",
    population: 25_600_000,
    coordinates: [31.2357, 30.0444],
  },
  {
    name: "Manila",
    iso2: "PH",
    population: 24_700_000,
    coordinates: [120.9842, 14.5995],
  },
  {
    name: "Kolkata",
    iso2: "IN",
    population: 22_500_000,
    coordinates: [88.3639, 22.5726],
  },
  {
    name: "Seoul",
    iso2: "KR",
    population: 22_500_000,
    coordinates: [126.978, 37.5665],
  },
];

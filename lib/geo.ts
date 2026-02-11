export type GeoResult = {
  countryName: string | null
  currency: string | null
}

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "United States": "USD",
  "United Kingdom": "GBP",
  "European Union": "EUR",
  Japan: "JPY",
  India: "INR",
  Canada: "CAD",
  Australia: "AUD",
}

export function mapCountryToCurrency(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  return COUNTRY_CURRENCY_MAP[countryName] || null
}

export interface CountryData {
  name: string;
  currency: string;
  currencySymbol?: string;
}

export const countryDataMap: Record<string, CountryData> = {
  'FR': { name: 'France', currency: 'EUR', currencySymbol: '€' },
  'IT': { name: 'Italy', currency: 'EUR', currencySymbol: '€' },
  'ES': { name: 'Spain', currency: 'EUR', currencySymbol: '€' },
  'DE': { name: 'Germany', currency: 'EUR', currencySymbol: '€' },
  'GB': { name: 'United Kingdom', currency: 'GBP', currencySymbol: '£' },
  'CH': { name: 'Switzerland', currency: 'CHF' },
  'SG': { name: 'Singapore', currency: 'SGD', currencySymbol: 'S$' },
  'AE': { name: 'United Arab Emirates', currency: 'AED', currencySymbol: 'د.إ' },
  'US': { name: 'United States', currency: 'USD', currencySymbol: '$' },
  'CN': { name: 'China', currency: 'CNY', currencySymbol: '¥' },
  'JP': { name: 'Japan', currency: 'JPY', currencySymbol: '¥' },
  'KR': { name: 'South Korea', currency: 'KRW', currencySymbol: '₩' },
  'TH': { name: 'Thailand', currency: 'THB', currencySymbol: '฿' },
  'MY': { name: 'Malaysia', currency: 'MYR', currencySymbol: 'RM' },
  'AU': { name: 'Australia', currency: 'AUD', currencySymbol: 'A$' },
  'CA': { name: 'Canada', currency: 'CAD', currencySymbol: 'C$' },
  // Add more countries as needed
};

export function getCountryData(code: string): CountryData | null {
  return countryDataMap[code.toUpperCase()] || null;
}

export function getCountryByName(name: string): string | null {
  const entry = Object.entries(countryDataMap)
    .find(([_, data]) => data.name.toLowerCase() === name.toLowerCase());
  return entry ? entry[0] : null;
}

export function getCountryByCurrency(currency: string): string | null {
  const entry = Object.entries(countryDataMap)
    .find(([_, data]) => data.currency === currency.toUpperCase());
  return entry ? entry[0] : null;
}

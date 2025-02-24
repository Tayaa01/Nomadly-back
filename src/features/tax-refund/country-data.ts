export interface CountryData {
  name: string;
  currency: string;
}

export const countryDataMap: Record<string, CountryData> = {
  // European Union
  'FR': { name: 'France', currency: 'EUR' },
  'DE': { name: 'Germany', currency: 'EUR' },
  'IT': { name: 'Italy', currency: 'EUR' },
  'ES': { name: 'Spain', currency: 'EUR' },
  'PT': { name: 'Portugal', currency: 'EUR' },
  'NL': { name: 'Netherlands', currency: 'EUR' },
  'BE': { name: 'Belgium', currency: 'EUR' },
  'GR': { name: 'Greece', currency: 'EUR' },
  'AT': { name: 'Austria', currency: 'EUR' },
  'IE': { name: 'Ireland', currency: 'EUR' },
  'FI': { name: 'Finland', currency: 'EUR' },
  'SK': { name: 'Slovakia', currency: 'EUR' },
  'LV': { name: 'Latvia', currency: 'EUR' },
  'LT': { name: 'Lithuania', currency: 'EUR' },
  'EE': { name: 'Estonia', currency: 'EUR' },
  'SI': { name: 'Slovenia', currency: 'EUR' },
  'CY': { name: 'Cyprus', currency: 'EUR' },
  'MT': { name: 'Malta', currency: 'EUR' },

  // Other European
  'GB': { name: 'United Kingdom', currency: 'GBP' },
  'CH': { name: 'Switzerland', currency: 'CHF' },
  'NO': { name: 'Norway', currency: 'NOK' },
  'SE': { name: 'Sweden', currency: 'SEK' },
  'DK': { name: 'Denmark', currency: 'DKK' },
  'PL': { name: 'Poland', currency: 'PLN' },
  'CZ': { name: 'Czech Republic', currency: 'CZK' },
  'HU': { name: 'Hungary', currency: 'HUF' },
  'RO': { name: 'Romania', currency: 'RON' },
  'BG': { name: 'Bulgaria', currency: 'BGN' },
  'HR': { name: 'Croatia', currency: 'HRK' },
  'IS': { name: 'Iceland', currency: 'ISK' },

  // Asia
  'JP': { name: 'Japan', currency: 'JPY' },
  'CN': { name: 'China', currency: 'CNY' },
  'KR': { name: 'South Korea', currency: 'KRW' },
  'SG': { name: 'Singapore', currency: 'SGD' },
  'HK': { name: 'Hong Kong', currency: 'HKD' },
  'TW': { name: 'Taiwan', currency: 'TWD' },
  'TH': { name: 'Thailand', currency: 'THB' },
  'MY': { name: 'Malaysia', currency: 'MYR' },
  'ID': { name: 'Indonesia', currency: 'IDR' },
  'PH': { name: 'Philippines', currency: 'PHP' },
  'VN': { name: 'Vietnam', currency: 'VND' },
  'IN': { name: 'India', currency: 'INR' },

  // Middle East
  'AE': { name: 'United Arab Emirates', currency: 'AED' },
  'SA': { name: 'Saudi Arabia', currency: 'SAR' },
  'QA': { name: 'Qatar', currency: 'QAR' },
  'BH': { name: 'Bahrain', currency: 'BHD' },
  'KW': { name: 'Kuwait', currency: 'KWD' },
  'OM': { name: 'Oman', currency: 'OMR' },
  'TR': { name: 'Turkey', currency: 'TRY' },

  // Americas
  'US': { name: 'United States', currency: 'USD' },
  'CA': { name: 'Canada', currency: 'CAD' },
  'MX': { name: 'Mexico', currency: 'MXN' },
  'BR': { name: 'Brazil', currency: 'BRL' },
  'AR': { name: 'Argentina', currency: 'ARS' },
  'CL': { name: 'Chile', currency: 'CLP' },
  'CO': { name: 'Colombia', currency: 'COP' },
  'PE': { name: 'Peru', currency: 'PEN' },

  // Africa
  'ZA': { name: 'South Africa', currency: 'ZAR' },
  'EG': { name: 'Egypt', currency: 'EGP' },
  'MA': { name: 'Morocco', currency: 'MAD' },
  'TN': { name: 'Tunisia', currency: 'TND' },
  'DZ': { name: 'Algeria', currency: 'DZD' },
  'NG': { name: 'Nigeria', currency: 'NGN' },
  'KE': { name: 'Kenya', currency: 'KES' },
  'GH': { name: 'Ghana', currency: 'GHS' },

  // Oceania
  'AU': { name: 'Australia', currency: 'AUD' },
  'NZ': { name: 'New Zealand', currency: 'NZD' },
  'FJ': { name: 'Fiji', currency: 'FJD' },
  'PG': { name: 'Papua New Guinea', currency: 'PGK' },

  // Others
  'RU': { name: 'Russia', currency: 'RUB' },
  'UA': { name: 'Ukraine', currency: 'UAH' },
  'BY': { name: 'Belarus', currency: 'BYN' },
  'KZ': { name: 'Kazakhstan', currency: 'KZT' }
};

export function getCountryData(code: string): CountryData | null {
  const upperCode = code.toUpperCase();
  return countryDataMap[upperCode] || null;
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

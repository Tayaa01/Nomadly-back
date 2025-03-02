declare module 'countries-list' {
  export interface Country {
    name: string;
    native: string;
    phone: string[];
    continent: string;
    capital: string;
    currency: string[];
    languages: string[];
    emoji: string;
    emojiU: string;
  }

  export const countries: {
    [key: string]: Country;
  };

  export const continents: {
    [key: string]: string;
  };

  export const languages: {
    [key: string]: {
      name: string;
      native: string;
    };
  };
}

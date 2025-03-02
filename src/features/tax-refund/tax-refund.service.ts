import { Injectable } from '@nestjs/common';
import { TaxRefundRules, TaxRefundAnalysis } from './types';
import { countries, Country } from 'countries-list';

@Injectable()
export class TaxRefundService {
  private readonly countryNames: Record<string, string> = {
    // European Countries
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'DE': 'Germany',
    'GB': 'United Kingdom',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'GR': 'Greece',
    'PT': 'Portugal',
    'NL': 'Netherlands',
    'PL': 'Poland',
    'BE': 'Belgium',
    'DK': 'Denmark',
    'SE': 'Sweden',
    'NO': 'Norway',
    'FI': 'Finland',
    'IE': 'Ireland',
    'CZ': 'Czech Republic',
    'HU': 'Hungary',
    'HR': 'Croatia',

    // Asian Countries
    'SG': 'Singapore',
    'JP': 'Japan',
    'KR': 'South Korea',
    'CN': 'China',
    'HK': 'Hong Kong',
    'TW': 'Taiwan',
    'TH': 'Thailand',
    'MY': 'Malaysia',
    'VN': 'Vietnam',
    'ID': 'Indonesia',
    'PH': 'Philippines',
    'IN': 'India',

    // Middle East
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'QA': 'Qatar',
    'BH': 'Bahrain',
    'KW': 'Kuwait',
    'OM': 'Oman',
    'TR': 'Turkey',

    // Americas
    'US': 'United States',
    'CA': 'Canada',
    'MX': 'Mexico',
    'BR': 'Brazil',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PE': 'Peru',

    // North Africa
    'MA': 'Morocco',
    'DZ': 'Algeria',
    'TN': 'Tunisia',
    'EG': 'Egypt',
    'LY': 'Libya',

    // Oceania
    'AU': 'Australia',
    'NZ': 'New Zealand',

    // Others
    'RU': 'Russia',
    'UA': 'Ukraine',
    'ZA': 'South Africa',
    'KZ': 'Kazakhstan'
  };

  private readonly countryRules: Record<string, TaxRefundRules> = {
    'FR': { // France
      vatRate: 20,
      minAmount: 100,
      refundRate: 12,
      process: 'PABLO electronic system or Detaxe counter',
      locations: ['Charles de Gaulle', 'Orly', 'Nice Airports'],
      operators: ['Global Blue', 'Premier Tax Free'],
      documentation: ['Passport', 'Original receipts', 'Detaxe form'],
      timeLimit: '3 months',
      restrictions: ['Must be non-EU resident', 'Items must leave EU within 3 months'],
      specialStores: ['Galeries Lafayette', 'Printemps', 'Le Bon Marché']
    },
    'IT': {
      vatRate: 22,
      minAmount: 154.94,
      refundRate: 13,
      process: 'Get Tax Free form from shop',
      locations: ['All major airports', 'Urban Blue counters'],
      operators: ['Global Blue', 'Premier Tax Free', 'Italian Tax Free'],
      documentation: ['Passport', 'Bills', 'Tax free forms'],
      timeLimit: '3 months',
      restrictions: ['Non-EU residents only', 'Personal use items only']
    },
    'ES': { // Spain
      vatRate: 21,
      minAmount: 90.16,
      refundRate: 15,
      process: 'DIVA electronic system',
      locations: ['All major airports', 'Main seaports'],
      operators: ['Global Blue', 'Premier Tax Free', 'Innova Tax Free'],
      documentation: ['Passport', 'DIVA forms'],
      timeLimit: '3 months',
      specialStores: ['El Corte Inglés', 'Las Rozas Village']
    },
    'DE': {
      vatRate: 19,
      minAmount: 50,
      refundRate: 14,
      process: 'Get tax free form',
      locations: ['Major airports', 'Global Blue offices'],
      operators: ['Global Blue', 'Premier Tax Free'],
      documentation: ['Passport', 'Export validation stamp'],
      timeLimit: '3 months'
    },
    'GB': { // United Kingdom
      vatRate: 20,
      minAmount: 30,
      refundRate: 14.5,
      process: 'Digital tax-free shopping system',
      locations: ['Major airports', 'Eurostar terminals'],
      operators: ['Tax Free Worldwide'],
      documentation: ['Digital receipts', 'Passport scan'],
      timeLimit: '3 months'
    },
    'CH': { // Switzerland
      vatRate: 7.7,
      minAmount: 300,
      refundRate: 6.5,
      process: 'Export validation at customs',
      locations: ['All border crossings', 'Airports'],
      operators: ['Global Blue', 'Premier Tax Free'],
      documentation: ['Tax free form', 'Export validation'],
      timeLimit: '30 days'
    },
    'SG': { // Singapore
      vatRate: 8,
      minAmount: 100,
      refundRate: 6.8,
      process: 'Electronic Tourist Refund Scheme (eTRS)',
      locations: ['Changi Airport', 'Marina Bay Sands'],
      operators: ['Global Blue', 'Premier Tax Free'],
      documentation: ['eTRS ticket', 'Passport'],
      timeLimit: '2 months'
    },
    'AE': { // UAE (Dubai)
      vatRate: 5,
      minAmount: 250,
      refundRate: 4,
      process: 'Planet Tax Free digital system',
      locations: ['Dubai airports', 'Abu Dhabi airport'],
      operators: ['Planet Payment'],
      documentation: ['Digital tax free tag', 'Passport'],
      timeLimit: '90 days',
      specialZones: ['Dubai Mall', 'Mall of the Emirates']
    },
    'US': { // United States
      vatRate: 0,
      minAmount: 0,
      refundRate: 0,
      process: 'No VAT system',
      locations: [],
      timeLimit: 'N/A',
      refundAvailable: false,
      message: 'The United States does not have a VAT refund system.'
    },
    'CN': { // China
      vatRate: 13,
      minAmount: 500,
      refundRate: 11,
      process: 'Electronic VAT refund system',
      locations: ['Major airports', 'Port cities'],
      documentation: ['Passport', 'Travel visa', 'Original receipts'],
      timeLimit: '3 months'
    },
    'TR': { // Turkey
      vatRate: 18,
      minAmount: 100,
      refundRate: 15.5,
      process: 'Tax Free Shopping Turkey system',
      locations: ['Istanbul Airport', 'Antalya Airport'],
      specialZones: ['Grand Bazaar', 'İstinye Park'],
      timeLimit: '3 months'
    },
    'MX': { // Mexico
      vatRate: 16,
      minAmount: 1200,
      refundRate: 8.9,
      process: 'Mexican Tax Administration Service',
      locations: ['Major airports'],
      restrictions: ['International credit card required'],
      timeLimit: '3 months'
    },
    'TH': { // Thailand
      vatRate: 7,
      minAmount: 5000,
      refundRate: 5,
      process: 'VAT Refund for Tourists office',
      locations: ['Suvarnabhumi Airport', 'Don Mueang Airport'],
      specialZones: ['Siam Paragon', 'Central World'],
      timeLimit: '3 months'
    },
    'JP': { // Japan
      vatRate: 10,
      minAmount: 5000,
      refundRate: 8,
      process: 'Electronic Tax-Free System',
      locations: ['Major department stores', 'Tourist shopping areas'],
      documentation: ['Passport', 'Purchase records'],
      specialZones: ['Akihabara', 'Ginza', 'Shinjuku'],
      timeLimit: '3 months'
    },
    'AT': { // Austria
      vatRate: 20,
      minAmount: 75,
      refundRate: 13,
      process: 'EU Tax-Free Shopping',
      locations: ['Vienna Airport', 'Salzburg Airport'],
      operators: ['Global Blue', 'Premier Tax Free'],
      timeLimit: '3 months'
    },
    'GR': { // Greece
      vatRate: 24,
      minAmount: 50,
      refundRate: 15,
      process: 'Hellenic Tax Free System',
      locations: ['Athens Airport', 'Major ports'],
      specialZones: ['Monastiraki', 'Plaka'],
      timeLimit: '3 months'
    },
    'MY': { // Malaysia
      vatRate: 6,
      minAmount: 300,
      refundRate: 4.8,
      process: 'Tourist Refund Scheme',
      locations: ['KLIA', 'KLIA2'],
      specialZones: ['KLCC', 'Bukit Bintang'],
      timeLimit: '2 months'
    },
    'RU': { // Russia
      vatRate: 20,
      minAmount: 10000,
      refundRate: 18,
      process: 'Tax Free System Russia',
      locations: ['Major international airports'],
      documentation: ['Passport', 'Tax Free Form'],
      timeLimit: '3 months'
    },
    'PT': { // Portugal
      vatRate: 23,
      minAmount: 50,
      refundRate: 15,
      process: 'eTaxFree Portugal',
      locations: ['Lisbon Airport', 'Porto Airport'],
      operators: ['Global Blue', 'Premier Tax Free'],
      timeLimit: '3 months'
    },
    'CA': { // Canada
      vatRate: 5,
      minAmount: 50,
      refundRate: 4.4,
      process: 'GST/HST Refund',
      locations: ['Major airports', 'Border crossings'],
      documentation: ['Original receipts', 'Proof of export'],
      timeLimit: '1 year'
    },
    'NL': { // Netherlands
      vatRate: 21,
      minAmount: 50,
      refundRate: 16,
      process: 'Dutch Tax Free Shopping',
      locations: ['Schiphol Airport', 'Major cities'],
      specialZones: ['Amsterdam Shopping District'],
      timeLimit: '3 months'
    },
    'PL': { // Poland
      vatRate: 23,
      minAmount: 200,
      refundRate: 18.7,
      process: 'Tax Free System Poland',
      locations: ['Warsaw Airport', 'Krakow Airport'],
      documentation: ['TAX FREE form', 'Passport'],
      timeLimit: '3 months'
    },
    'SA': { // Saudi Arabia
      vatRate: 15,
      minAmount: 1000,
      refundRate: 10,
      process: 'Planet Payment system',
      locations: ['Major airports', 'Shopping centers'],
      documentation: ['Digital validation', 'Passport scan'],
      timeLimit: '90 days'
    },
    'TN': { // Tunisia
      vatRate: 19,
      minAmount: 100,
      refundRate: 15.2,
      process: 'Tunisian Tax Free Shopping',
      locations: ['Tunis-Carthage Airport', 'Major tourist zones'],
      specialZones: ['Medina of Tunis', 'Sousse Market'],
      timeLimit: '3 months'
    }
  };

  private getCountryName(code: string): string {
    const upperCode = code.toUpperCase();
    return this.countryNames[upperCode] || 
           (countries[upperCode]?.name) || 
           code;
  }

  async analyzeTaxRefund(amount: number, country: string): Promise<TaxRefundAnalysis> {
    const rules = this.countryRules[country.toUpperCase()];
    const countryName = this.getCountryName(country);
    
    if (!rules) {
      return {
        eligible: false,
        message: `We don't have tax refund information for ${countryName} at the moment. Please check with local authorities for tax-free shopping options.`,
      };
    }

    // Special case for US
    if (country.toUpperCase() === 'US') {
      return {
        eligible: false,
        country: countryName,
        message: rules.message
      };
    }

    const eligible = amount >= rules.minAmount;
    const potentialRefund = eligible ? (amount * rules.refundRate / 100) : 0;

    // Default operator text if none specified
    const operatorText = rules.operators?.length 
      ? `Use ${rules.operators.join(' or ')} services`
      : 'Check with tax refund operators at the airport';

    return {
      eligible,
      country: country.toUpperCase(),
      vatRate: rules.vatRate,
      minPurchaseAmount: rules.minAmount,
      potentialRefund: Math.round(potentialRefund * 100) / 100,
      process: rules.process,
      locations: rules.locations || [],
      operators: rules.operators || [],
      documentation: rules.documentation || [],
      timeLimit: rules.timeLimit,
      requirements: [
        'Original receipt',
        'Valid passport',
        'Proof of non-residence',
        'Items in unused condition',
        `Purchase within ${rules.timeLimit}`
      ],
      tips: [
        'Combine purchases from same store',
        'Keep all packaging and tags',
        'Allow extra time at airport',
        operatorText,
        `Minimum spend: ${rules.minAmount} ${country === 'AE' ? 'AED' : 'EUR'}`,
        'Download operator apps for digital processing'
      ],
      ...(rules.specialStores && { recommendedStores: rules.specialStores }),
      ...(rules.specialZones && { specialShoppingZones: rules.specialZones }),
      restrictions: rules.restrictions || ['Non-resident purchases only', 'Export verification required']
    };
  }
}

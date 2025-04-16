import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';

interface TravelPackageSearchParams {
  departureCountry: string;
  arrivalCountry: string;
  specific?: string;
}

@Injectable()
export class TravelSerperService {
  private readonly logger = new Logger(TravelSerperService.name);
  private readonly serperKey: string;
  private readonly serperUrl = 'https://google.serper.dev/search';
  private readonly travelSearchCache = new Map<string, { data: Deal[], timestamp: number }>();
  private readonly CACHE_TTL = 1800000; // 30 minutes cache

  constructor(private configService: ConfigService) {
    this.serperKey = this.configService.get<string>('SERPER_API_KEY') || '';
    if (!this.serperKey) {
      throw new Error('SERPER_API_KEY is not defined in environment variables');
    }
  }

  async searchForTravelPackages(params: TravelPackageSearchParams): Promise<Deal[]> {
    const { departureCountry, arrivalCountry, specific } = params;
    try {
      const cacheKey = `travel-${departureCountry}-${arrivalCountry}-${specific || ''}`;
      const cached = this.travelSearchCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Returning cached travel package deals');
        return cached.data;
      }

      this.logger.debug(`Searching for travel packages from ${departureCountry} to ${arrivalCountry}${specific ? ` with specific terms: ${specific}` : ''}`);

      const searchQuery = this.buildTravelPackageSearchQuery(params);
      this.logger.debug(`Searching travel packages with query: ${searchQuery}`);

      const response = await axios.post(
        this.serperUrl,
        {
          q: searchQuery,
          gl: this.getCountryCode(arrivalCountry),
          hl: 'en',
          num: 100, // Increase from 50 to 100 for more potential results
          autocorrect: true,
          type: 'search',
        },
        {
          headers: {
            'X-API-KEY': this.serperKey,
            'Content-Type': 'application/json',
          },
        }
      );
      // Log raw response data for debugging
      this.logger.verbose(`Raw Serper response for travel packages: ${JSON.stringify(response.data)}`);

      const results = this.extractSearchResults(response.data);

      let deals = await this.parseSearchResults(results, arrivalCountry, 'travel');

      // Fallback 1 (already implemented)
      if (results.length === 0 || deals.length === 0) {
        this.logger.debug('No results found with primary query, trying fallback query');
        const fallbackQuery = this.buildFallbackTravelQuery(params);
        this.logger.debug(`Using fallback query: ${fallbackQuery}`);
        
        const fallbackResponse = await axios.post(
          this.serperUrl,
          {
            q: fallbackQuery,
            gl: this.getCountryCode(arrivalCountry),
            hl: 'en',
            num: 100,
            autocorrect: true,
            type: 'search',
          },
          {
            headers: {
              'X-API-KEY': this.serperKey,
              'Content-Type': 'application/json',
            },
          }
        );

        results.push(...this.extractSearchResults(fallbackResponse.data));
        deals = await this.parseSearchResults(results, arrivalCountry, 'travel');
      }

      // Final fallback: very broad query
      if (deals.length === 0) {
        this.logger.debug('No results after fallback, trying final broad query');
        const broadQuery = `travel packages ${arrivalCountry} (site:expedia.com OR site:booking.com OR site:kayak.com OR site:travelocity.com OR site:lastminute.com OR site:tripadvisor.com OR site:priceline.com OR site:orbitz.com OR site:agoda.com)`;
        const broadResponse = await axios.post(
          this.serperUrl,
          {
            q: broadQuery,
            gl: this.getCountryCode(arrivalCountry),
            hl: 'en',
            num: 100,
            autocorrect: true,
            type: 'search',
          },
          {
            headers: {
              'X-API-KEY': this.serperKey,
              'Content-Type': 'application/json',
            },
          }
        );
        const broadResults = this.extractSearchResults(broadResponse.data);
        deals = await this.parseSearchResults(broadResults, arrivalCountry, 'travel');
      }

      this.logger.debug(`Fetched ${results.length} raw results from Serper for travel packages`);
      this.logger.debug(`Parsed ${deals.length} valid travel package deals`);

      this.travelSearchCache.set(cacheKey, { data: deals, timestamp: Date.now() });

      return deals;
    } catch (error) {
      this.logger.error('Travel Serper search error:', error);
      return [];
    }
  }

  async searchForCheapestTravelOffers(destination: string): Promise<Deal[]> {
    // Normalize destination to lowercase for cache, query, and country code
    const normalizedDestination = destination.trim().toLowerCase();
    try {
      const cacheKey = `cheapest-travel-${normalizedDestination}`;
      const cached = this.travelSearchCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Returning cached cheapest travel offers');
        return cached.data;
      }

      const query = this.buildCheapestTravelQuery(normalizedDestination);
      this.logger.debug(`Searching travel offers with query: ${query}`);

      const response = await axios.post(
        this.serperUrl,
        {
          q: query,
          gl: this.getCountryCode(normalizedDestination),
          hl: 'en',
          num: 100,
          autocorrect: true,
          type: 'search',
        },
        {
          headers: {
            'X-API-KEY': this.serperKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const results = this.extractSearchResults(response.data);
      let deals = await this.parseSearchResults(results, normalizedDestination, 'travel');

      // Fallback: try a very broad query with just the destination and sites
      if (!deals.length) {
        const broadSites = [
          'site:expedia.com',
          'site:booking.com',
          'site:kayak.com/packages',
          'site:travelocity.com',
          'site:lastminute.com',
          'site:tripadvisor.com',
          'site:priceline.com',
          'site:orbitz.com',
          'site:agoda.com',
          'site:hotels.com/packages',
        ];
        const fallbackQuery = `${normalizedDestination} (${broadSites.join(' OR ')})`;
        this.logger.debug(`No results, trying fallback query: ${fallbackQuery}`);
        const fallbackResponse = await axios.post(
          this.serperUrl,
          {
            q: fallbackQuery,
            gl: this.getCountryCode(normalizedDestination),
            hl: 'en',
            num: 100,
            autocorrect: true,
            type: 'search',
          },
          {
            headers: {
              'X-API-KEY': this.serperKey,
              'Content-Type': 'application/json',
            },
          }
        );
        const fallbackResults = this.extractSearchResults(fallbackResponse.data);
        deals = await this.parseSearchResults(fallbackResults, normalizedDestination, 'travel');
      }

      this.travelSearchCache.set(cacheKey, { data: deals, timestamp: Date.now() });
      return deals;
    } catch (error) {
      this.logger.error('Cheapest travel search error:', error);
      return [];
    }
  }

  private buildTravelPackageSearchQuery(params: TravelPackageSearchParams): string {
    const { departureCountry, arrivalCountry, specific } = params;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const nextYear = currentYear + 1;

    let query = `travel packages from ${departureCountry} to ${arrivalCountry}`;
    query += ` ("flight and hotel" OR "vacation package" OR "all-inclusive" OR "holiday bundle" OR "flight + hotel")`;

    if (specific) {
      query += ` ${specific}`;
    }

    // Add more OTA and travel providers
    query += ` (site:expedia.com OR site:booking.com OR site:kayak.com OR site:travelocity.com OR site:lastminute.com OR site:tripadvisor.com OR site:priceline.com OR site:hotels.com OR site:orbitz.com OR site:agoda.com)`;
    
    // Add date range for current and next year
    query += ` (${currentYear} OR ${nextYear})`;

    // Soften the requirement for deals/discounts to avoid missing results
    query += ' ("% off" OR discount OR promo OR "special offer" OR sale OR price OR book OR reservation)';

    // Exclude irrelevant content
    query += ' -expired -forum -blog -review -jobs -pinterest';

    return query;
  }

  private buildFallbackTravelQuery(params: TravelPackageSearchParams): string {
    const { departureCountry, arrivalCountry, specific } = params;
    
    let query = `travel ${arrivalCountry} from ${departureCountry}`;
    query += ` (vacation OR holiday OR tour OR flights OR hotels OR packages)`;
    
    if (specific) {
      query += ` ${specific}`;
    }
    
    // Add more general travel sites
    query += ` (site:expedia.com OR site:booking.com OR site:kayak.com OR site:tripadvisor.com OR site:google.com/travel)`;
    
    // Exclude irrelevant content
    query += ' -expired -forum -blog -jobs -pinterest';
    
    return query;
  }

  private buildCheapestTravelQuery(destination: string): string {
    const sites = [
      'site:expedia.com',
      'site:booking.com',
      'site:kayak.com/packages',
      'site:travelocity.com',
      'site:lastminute.com',
      'site:tripadvisor.com',
      'site:priceline.com',
      'site:orbitz.com',
      'site:agoda.com',
      'site:hotels.com/packages',
    ];
    return `travel packages to ${destination} (${sites.join(' OR ')})`;
  }

  private extractSearchResults(data: any): any[] {
    const results = [];
    if (data.organic) results.push(...data.organic);
    if (data.shopping) results.push(...data.shopping);
    if (data.knowledgeGraph && data.knowledgeGraph.price) results.push(data.knowledgeGraph);
    return results;
  }

  private async parseSearchResults(results: any[], country: string, category: string): Promise<Deal[]> {
    // Accept all results from allowed domains for the "cheapest travel offers" endpoint
    const allowedDomains = [
      'expedia.com',
      'booking.com',
      'kayak.com',
      'travelocity.com',
      'lastminute.com',
      'tripadvisor.com',
      'priceline.com',
      'orbitz.com',
      'agoda.com',
      'hotels.com'
    ];

    const deals = results
      .filter(result => {
        try {
          const url = result.link || '';
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          return allowedDomains.some(domain => hostname.endsWith(domain));
        } catch {
          return false;
        }
      })
      .map(result => this.createDealFromResult(result, category, country))
      .filter(deal => this.isValidDeal(deal));

    const uniqueDeals = this.removeDuplicateDeals(deals);
    return this.sortDealsByQuality(uniqueDeals);
  }

  private isRelevantDeal(text: string, url: string): boolean {
    const relevantTerms = [
      'deal', 'discount', 'offer', 'promo', 'sale', 'off', 'save', 
      'package', 'bundle', 'vacation', 'holiday', 'flight and hotel', 
      'all-inclusive', 'hotel', 'flight', 'tour', 'trip', 'travel', 
      'booking', 'price', 'reservation'
    ];
    const spamTerms = ['scam', 'fake', 'expired', 'not working', 'review', 'blog', 'forum', 'jobs'];

    if (!text || text.length === 0 || !url || url.length === 0) return false;

    const hasRelevantTerm = relevantTerms.some(term => text.includes(term));
    const hasSpamTerm = spamTerms.some(term => text.includes(term));
    const isBlocked = this.isBlockedDomain(url);

    if (!hasRelevantTerm) this.logger.verbose(`No relevant term found in: "${text}"`);
    if (hasSpamTerm) this.logger.verbose(`Spam term found in: "${text}"`);
    if (isBlocked) this.logger.verbose(`Blocked domain: ${url}`);

    return hasRelevantTerm && !hasSpamTerm && !isBlocked;
  }

  private isBlockedDomain(url: string): boolean {
    const blockedDomains = ['pinterest.', 'facebook.', 'instagram.', 'twitter.', 'linkedin.', 'reddit.'];
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return blockedDomains.some(blocked => domain.includes(blocked));
    } catch {
      return true; // Invalid URL is considered blocked
    }
  }

  private createDealFromResult(result: any, category: string, country: string): Deal {
    const text = `${result.title} ${result.snippet || ''}`;
    const price = this.extractPrice(text);
    const originalPrice = this.extractOriginalPrice(text);
    const discount = this.calculateDiscount(text, price, originalPrice);
    const retailer = this.extractRetailerName(result.link);

    return {
      title: this.cleanTitle(result.title),
      description: result.snippet || this.generateDescription(result.title, category),
      url: result.link,
      price: {
        current: price,
        original: originalPrice,
        currency: this.detectCurrency(text, country),
        discountPercentage: discount,
      },
      promoCode: this.extractPromoCode(text),
      retailer: {
        name: retailer,
        website: this.extractBaseUrl(result.link),
        rating: this.extractRating(text),
      },
      category,
      location: {
        name: retailer,
        address: '',
        city: this.extractCity(text) || '',
        country: country,
        coordinates: { latitude: 0, longitude: 0 }
      },
      lastVerified: new Date(),
      source: 'Serper Google Search (Travel Packages)',
      imageUrl: result.imageUrl || result.thumbnailUrl,
      metadata: {
        confidence: this.calculateConfidenceScore(text, result),
        searchRank: result.position || 0,
        lastUpdated: result.date,
      },
    };
  }

  private cleanTitle(title: string): string {
    if (!title) return 'Untitled Travel Package';
    return title
      .replace(/\b(best|top|amazing|exclusive|cheap|lowest price)\b/gi, '')
      .replace(/\|.*$/, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s.,%$€£¥-]/gu, '')
      .trim();
  }

  private generateDescription(title: string, category: string): string {
    return `Explore this travel package deal: ${title}. Visit the provider's website for full details, dates, and booking information.`;
  }

  private extractPrice(text: string): number | null {
    const patterns = [
      /[$€£¥]\s?(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/,
      /(?:price|cost|pay|from|starting at):?\s*[$€£¥]?\s?(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
      /just\s*[$€£¥]?\s?(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
      /(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:dollars|euros|pounds|yen)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const normalizedPrice = match[1].replace(/,/g, '');
        return parseFloat(normalizedPrice);
      }
    }
    return null;
  }

  private extractOriginalPrice(text: string): number | undefined {
    const patterns = [
      /(?:was|originally|reg\.?|regular price|retail|MSRP):?\s*[$€£¥]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
      /~\s*[$€£¥]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const normalizedPrice = match[1].replace(/,/g, '');
        return parseFloat(normalizedPrice);
      }
    }
    return undefined;
  }

  private calculateDiscount(text: string, current?: number | null, original?: number): number | undefined {
    const percentMatch = text.match(/(\d{1,2}(?:\.\d{1,2})?)%?\s*(?:off|discount|saving)/i);
    if (percentMatch) {
      const discount = parseFloat(percentMatch[1]);
      return discount > 0 && discount <= 100 ? Math.round(discount) : undefined;
    }
    if (current != null && original != null && original > current && current >= 0) {
      const discount = Math.round(((original - current) / original) * 100);
      return discount > 0 && discount <= 100 ? discount : undefined;
    }
    const savingsMatch = text.match(/save\s*[$€£¥]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i);
    if (savingsMatch && current != null && current >= 0) {
      const savings = parseFloat(savingsMatch[1].replace(/,/g, ''));
      if (savings > 0) {
        const calculatedOriginal = current + savings;
        const discount = Math.round((savings / calculatedOriginal) * 100);
        return discount > 0 && discount <= 100 ? discount : undefined;
      }
    }
    return undefined;
  }

  private detectCurrency(text: string, countryHint: string): string {
    if (text.includes('€') || text.toLowerCase().includes('euro')) return 'EUR';
    if (text.includes('£') || text.toLowerCase().includes('pound')) return 'GBP';
    if (text.includes('¥') || text.toLowerCase().includes('yen')) return 'JPY';
    if (text.includes('$')) {
      const countryCode = this.getCountryCode(countryHint);
      if (countryCode === 'ca') return 'CAD';
      if (countryCode === 'au') return 'AUD';
      return 'USD';
    }
    const countryCode = this.getCountryCode(countryHint);
    const countryCurrencyMap = {
      'us': 'USD', 'ca': 'CAD', 'gb': 'GBP', 'au': 'AUD', 'jp': 'JPY',
      'de': 'EUR', 'fr': 'EUR', 'es': 'EUR', 'it': 'EUR',
    };
    return countryCurrencyMap[countryCode] || 'USD';
  }

  private extractRetailerName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const name = hostname
        .replace(/^www\./i, '')
        .replace(/\.(com|co\.uk|net|org|io|dev|app|ca|fr|de|es|it|jp|au)(\.[a-z]{2})?$/i, '')
        .split('.')
        .pop()
        ?.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || hostname;
      return name || 'Unknown Provider';
    } catch {
      return 'Unknown Provider';
    }
  }

  private extractBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      return '';
    }
  }

  private extractRating(text: string): number | undefined {
    const patterns = [
      /([\d.,]+)\s*(?:out of|\/)\s*5\s*(?:stars?|rating)/i,
      /rating:\s*([\d.,]+)/i,
      /rated\s*([\d.,]+)\s*(?:stars?)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const rating = parseFloat(match[1].replace(',', '.'));
        return rating >= 0 && rating <= 5 ? rating : undefined;
      }
    }
    return undefined;
  }

  private extractCity(text: string): string | undefined {
    const cityPattern = /\b(?:in|near|at|for|to)\s+([A-Z][a-z]+(?:(?:\s+|-)[A-Z][a-z]+)*)\b/;
    const match = text.match(cityPattern);
    if (match && match[1] && match[1].length > 3 && !['The', 'And', 'For'].includes(match[1])) {
      return match[1].trim();
    }
    return undefined;
  }

  private extractPromoCode(text: string): { code: string; description: string } | undefined {
    const codePatterns = [
      /(?:code|promo|coupon|voucher)\s*:?\s*["']?([A-Z0-9]{4,})["']?/i,
      /(?:use|enter|apply)\s+(?:code|promo|coupon)\s+["']?([A-Z0-9]{4,})["']?/i,
      /([A-Z]{4,}[0-9]+|[0-9]+[A-Z]{4,})\b/
    ];
    for (const pattern of codePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const code = match[1].toUpperCase();
        if (code.length >= 4 && code.length <= 20 && (/\d/.test(code) || /[A-Z]/.test(code))) {
          return { code: code, description: 'Apply at checkout for savings' };
        }
      }
    }
    return undefined;
  }

  private calculateConfidenceScore(text: string, result: any): number {
    let score = 0;
    const lowerText = text.toLowerCase();
    if (lowerText.includes('package') || lowerText.includes('bundle') || lowerText.includes('flight and hotel') || lowerText.includes('all-inclusive')) score += 30;
    if (lowerText.includes('% off') || lowerText.includes('discount') || lowerText.includes('sale')) score += 15;
    if (lowerText.includes('deal') || lowerText.includes('offer')) score += 10;
    if (lowerText.includes('limited time') || lowerText.includes('ends soon')) score += 10;
    if (this.extractPromoCode(text)) score += 15;
    if (this.extractPrice(text) !== null) score += 10;
    if (result.position && result.position <= 5) score += 10;
    if (result.snippet?.length > 100) score += 5;
    if (result.link && (result.link.includes('package') || result.link.includes('deal'))) score += 5;
    if (lowerText.includes('expired') || lowerText.includes('ended')) score -= 30;
    if (lowerText.includes('review') || lowerText.includes('blog')) score -= 10;
    return Math.max(0, Math.min(score, 100));
  }

  private isValidDeal(deal: Deal): boolean {
    const hasValidTitle = deal.title && deal.title.length > 5 && deal.title !== 'Untitled Travel Package';
    const hasValidUrl = deal.url && deal.url.length > 10 && deal.url.startsWith('http');
    const hasValidRetailer = deal.retailer?.name && deal.retailer.name !== 'Unknown Provider';
    const reasonablePrice = deal.price?.current == null || (deal.price.current >= 0 && deal.price.current < 100000);

    return hasValidTitle && hasValidUrl && hasValidRetailer && reasonablePrice;
  }

  private removeDuplicateDeals(deals: Deal[]): Deal[] {
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    return deals.filter(deal => {
      const normUrl = (deal.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const normTitle = (deal.title || '').toLowerCase().substring(0, 50);
      if (!normUrl || seenUrls.has(normUrl)) return false;
      if (seenTitles.has(normTitle + deal.retailer.name)) return false;
      seenUrls.add(normUrl);
      seenTitles.add(normTitle + deal.retailer.name);
      return true;
    });
  }

  private sortDealsByQuality(deals: Deal[]): Deal[] {
    return deals.sort((a, b) => {
      const scoreA = a.metadata?.confidence || 0;
      const scoreB = b.metadata?.confidence || 0;
      return scoreB - scoreA;
    });
  }

  private getCountryCode(country: string): string {
    if (!country) return 'us';
    const normalizedCountry = country.toLowerCase().trim();
    if (COUNTRY_CODES[normalizedCountry]) return COUNTRY_CODES[normalizedCountry];
    if (normalizedCountry.length === 2 && /^[a-z]{2}$/.test(normalizedCountry)) {
      if (Object.values(COUNTRY_CODES).includes(normalizedCountry)) return normalizedCountry;
    }
    if (normalizedCountry.includes('united states') || normalizedCountry === 'usa') return 'us';
    if (normalizedCountry.includes('united kingdom') || normalizedCountry === 'uk') return 'gb';
    if (normalizedCountry.includes('canada')) return 'ca';
    if (normalizedCountry.includes('australia')) return 'au';
    if (normalizedCountry.includes('germany')) return 'de';
    if (normalizedCountry.includes('france')) return 'fr';
    if (normalizedCountry.includes('japan')) return 'jp';
    this.logger.warn(`Could not find country code for "${country}", defaulting to 'us'.`);
    return 'us';
  }
}

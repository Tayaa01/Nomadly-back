import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly serperKey: string;
  private readonly serperUrl = 'https://google.serper.dev/search';
  private readonly searchCache = new Map<string, { data: Deal[], timestamp: number }>();
  private readonly CACHE_TTL = 1800000; // 30 minutes cache

  constructor(private configService: ConfigService) {
    this.serperKey = this.configService.get<string>('SERPER_API_KEY') || '';
    if (!this.serperKey) {
      throw new Error('SERPER_API_KEY is not defined in environment variables');
    }
  }

  async searchForDeals(country: string, category: string, specific?: string): Promise<Deal[]> {
    try {
      const cacheKey = `${country}-${category}-${specific || ''}`;
      const cached = this.searchCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Returning cached deals');
        return cached.data;
      }

      const searchQuery = this.buildSearchQuery(country, category, specific);
      this.logger.debug(`Searching with query: ${searchQuery}`);

      const response = await axios.post(
        this.serperUrl,
        {
          q: searchQuery,
          gl: this.getCountryCode(country),
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
      this.logger.debug(`Fetched ${results.length} raw results from Serper for ${category} in ${country}`);

      const deals = await this.parseSearchResults(results, country, category);
      this.searchCache.set(cacheKey, { data: deals, timestamp: Date.now() });

      return deals;
    } catch (error) {
      this.logger.error('Serper search error:', error);
      return [];
    }
  }

  private extractSearchResults(data: any): any[] {
    const results = [];

    if (data.organic) {
      results.push(...data.organic);
    }

    if (data.shopping) {
      results.push(...data.shopping);
    }

    if (data.knowledgeGraph && data.knowledgeGraph.price) {
      results.push(data.knowledgeGraph);
    }

    return results;
  }

  private buildSearchQuery(country: string, category: string, specific?: string): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

    let query = `best ${category} deals`;

    switch (category.toLowerCase()) {
      case 'travel':
        query += ' (flights OR trains OR "car rental" OR "bus tickets" OR "local transport")';
        query += ' ("best price" OR "cheap tickets" OR "discount fares")';
        query += ' (site:kayak.com OR site:skyscanner.com OR site:booking.com)';
        break;
      case 'groceries':
        query += ' (supermarket OR "grocery store" OR "food market" OR "fresh produce")';
        query += ' ("weekly deals" OR "special offers" OR "loyalty discount")';
        query += ' (site:instacart.com OR site:walmart.com OR site:amazon.com)';
        break;
      case 'restaurants':
        query += ' (dining OR "food delivery" OR takeaway OR "restaurant week")';
        query += ' ("meal deals" OR "happy hour" OR "dining offers" OR vouchers)';
        query += ' (site:groupon.com OR site:opentable.com OR site:thefork.com)';
        break;
      case 'fashion':
        query += ' (clothing OR shoes OR accessories OR "designer brands")';
        query += ' ("seasonal sale" OR "clearance" OR "outlet prices")';
        query += ' (site:nordstrom.com OR site:macys.com OR site:asos.com)';
        break;
      case 'electronics':
        query += ' (gadgets OR smartphones OR laptops OR "home appliances")';
        query += ' ("tech deals" OR "latest models" OR "authorized retailer")';
        query += ' (site:bestbuy.com OR site:amazon.com OR site:newegg.com)';
        break;
      default:
        query += ` ${category}`;
    }

    if (specific) {
      query += ` ${specific}`;
    }

    if (country.toLowerCase() !== 'global') {
      query += ` in ${country}`;
    }

    query += ` ${currentMonth} ${currentYear}`;
    query += ' ("% off" OR coupon OR promo OR "special offer" OR sale)';
    query += ' -expired -forum -blog -review -jobs -pinterest';

    return query;
  }

  private async parseSearchResults(results: any[], country: string, category: string): Promise<Deal[]> {
    const deals = results
      .filter(result => {
        const text = `${result.title} ${result.snippet || ''}`.toLowerCase();
        return this.isRelevantDeal(text, result.link);
      })
      .map(result => this.createDealFromResult(result, category, country))
      .filter(deal => this.isValidDeal(deal));

    const uniqueDeals = this.removeDuplicateDeals(deals);

    return this.sortDealsByQuality(uniqueDeals);
  }

  private isRelevantDeal(text: string, url: string): boolean {
    const relevantTerms = ['deal', 'discount', 'offer', 'promo', 'sale', 'off', 'save', 'package', 'bundle'];
    const spamTerms = ['scam', 'fake', 'expired', 'not working', 'review', 'blog', 'forum'];

    return (
      text.length > 0 &&
      url?.length > 0 &&
      relevantTerms.some(term => text.includes(term)) &&
      !spamTerms.some(term => text.includes(term)) &&
      !this.isBlockedDomain(url)
    );
  }

  private isBlockedDomain(url: string): boolean {
    const blockedDomains = ['pinterest.', 'facebook.', 'instagram.', 'twitter.', 'linkedin.', 'reddit.'];
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return blockedDomains.some(blocked => domain.includes(blocked));
    } catch {
      return true;
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
        country,
        coordinates: {
          latitude: 0,
          longitude: 0
        }
      },
      lastVerified: new Date(),
      source: 'Serper Google Search',
      imageUrl: result.imageUrl || result.thumbnailUrl,
      metadata: {
        confidence: this.calculateConfidenceScore(text, result),
        searchRank: result.position || 0,
        lastUpdated: result.date,
      },
    };
  }

  private cleanTitle(title: string): string {
    if (!title) return 'Untitled Deal';
    return title
      .replace(/\b(best|top|amazing|exclusive|cheap|lowest price)\b/gi, '')
      .replace(/\|.*$/,'')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s.,%$€£¥-]/gu, '')
      .trim();
  }

  private generateDescription(title: string, category: string): string {
    return `Check out this ${category} deal: ${title}. Visit the retailer's website for full details and availability.`;
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
      return name || 'Unknown Retailer';
    } catch {
      return 'Unknown Retailer';
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
    const cityPattern = /\b(?:in|near|at|for)\s+([A-Z][a-z]+(?:(?:\s+|-)[A-Z][a-z]+)*)\b/;
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
        if (code.length >= 4 && code.length <= 20 && /\d/.test(code) && /[A-Z]/.test(code)) {
           return {
             code: code,
             description: 'Apply at checkout for savings',
           };
        }
        if (pattern !== codePatterns[2] && code.length >= 4 && code.length <= 20) {
             return {
             code: code,
             description: 'Apply at checkout for savings',
           };
        }
      }
    }
    return undefined;
  }

  private calculateConfidenceScore(text: string, result: any): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    if (lowerText.includes('% off') || lowerText.includes('discount') || lowerText.includes('sale')) score += 20;
    if (lowerText.includes('deal') || lowerText.includes('offer')) score += 10;
    if (lowerText.includes('limited time') || lowerText.includes('ends soon')) score += 15;
    if (lowerText.includes('today only') || lowerText.includes('flash sale')) score += 25;
    if (lowerText.includes('package') || lowerText.includes('bundle')) score += 15;
    if (this.extractPromoCode(text)) score += 25;
    if (this.extractPrice(text) !== null) score += 15;
    if (this.extractOriginalPrice(text) !== undefined) score += 10;
    if (result.position && result.position <= 5) score += 25;
    else if (result.position && result.position <= 10) score += 15;
    if (result.snippet?.length > 120) score += 10;
    if (result.imageUrl) score += 5;
    if (result.link && (result.link.includes('deal') || result.link.includes('offer'))) score += 10;

    if (lowerText.includes('expired') || lowerText.includes('ended')) score -= 30;
    if (lowerText.includes('review') || lowerText.includes('blog')) score -= 10;

    return Math.max(0, Math.min(score, 100));
  }

  private isValidDeal(deal: Deal): boolean {
    const hasValidTitle = deal.title && deal.title.length > 5 && deal.title !== 'Untitled Deal';
    const hasValidUrl = deal.url && deal.url.length > 10 && deal.url.startsWith('http');
    const hasValidRetailer = deal.retailer?.name && deal.retailer.name !== 'Unknown Retailer';
    const hasPriceInfo = (deal.price?.current != null && deal.price.current >= 0) ||
                         (deal.price?.discountPercentage != null && deal.price.discountPercentage > 0);
    const hasPromo = deal.promoCode?.code != null;

    const reasonablePrice = deal.price?.current == null || (deal.price.current >= 0 && deal.price.current < 100000);

    return hasValidTitle && hasValidUrl && hasValidRetailer && (hasPriceInfo || hasPromo) && reasonablePrice;
  }

  private removeDuplicateDeals(deals: Deal[]): Deal[] {
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    return deals.filter(deal => {
      const normUrl = (deal.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const normTitle = (deal.title || '').toLowerCase().substring(0, 50);

      if (!normUrl || seenUrls.has(normUrl)) {
          return false;
      }
      if (seenTitles.has(normTitle + deal.retailer.name)) {
          return false;
      }

      seenUrls.add(normUrl);
      seenTitles.add(normTitle + deal.retailer.name);
      return true;
    });
  }

  private sortDealsByQuality(deals: Deal[]): Deal[] {
    return deals.sort((a, b) => {
      const scoreA = (a.metadata?.confidence || 0) * 2 + (a.price?.discountPercentage || 0);
      const scoreB = (b.metadata?.confidence || 0) * 2 + (b.price?.discountPercentage || 0);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const priceA = a.price?.current ?? Infinity;
      const priceB = b.price?.current ?? Infinity;
      return priceA - priceB;
    });
  }

  private getCountryCode(country: string): string {
    if (!country) return 'us';
    const normalizedCountry = country.toLowerCase().trim();

    if (COUNTRY_CODES[normalizedCountry]) {
      return COUNTRY_CODES[normalizedCountry];
    }

    if (normalizedCountry.length === 2 && /^[a-z]{2}$/.test(normalizedCountry)) {
        if (Object.values(COUNTRY_CODES).includes(normalizedCountry)) {
             return normalizedCountry;
        }
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
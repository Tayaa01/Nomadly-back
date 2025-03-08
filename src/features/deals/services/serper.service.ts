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
          num: 100, // Increased to get more potential results
          autocorrect: true,
          type: 'search', // Explicitly set type
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
    
    // Extract organic results
    if (data.organic) {
      results.push(...data.organic);
    }
    
    // Extract shopping results if available
    if (data.shopping) {
      results.push(...data.shopping);
    }
    
    // Extract knowledge graph if it contains relevant deal information
    if (data.knowledgeGraph && data.knowledgeGraph.price) {
      results.push(data.knowledgeGraph);
    }

    return results;
  }

  private buildSearchQuery(country: string, category: string, specific?: string): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    
    let query = `best ${category} deals`;
    
    // Add category-specific terms
    switch (category.toLowerCase()) {
      case 'travel':
        query += ' (flights OR trains OR "car rental" OR "bus tickets" OR "local transport")';
        query += ' ("best price" OR "cheap tickets" OR "discount fares")';
        break;
      case 'groceries':
        query += ' (supermarket OR "grocery store" OR "food market" OR "fresh produce")';
        query += ' ("weekly deals" OR "special offers" OR "loyalty discount")';
        break;
      case 'restaurants':
        query += ' (dining OR "food delivery" OR takeaway OR "restaurant week")';
        query += ' ("meal deals" OR "happy hour" OR "dining offers" OR vouchers)';
        break;
      case 'fashion':
        query += ' (clothing OR shoes OR accessories OR "designer brands")';
        query += ' ("seasonal sale" OR "clearance" OR "outlet prices")';
        break;
      case 'electronics':
        query += ' (gadgets OR smartphones OR laptops OR "home appliances")';
        query += ' ("tech deals" OR "latest models" OR "authorized retailer")';
        break;
      default:
        query += ` ${category}`;
    }

    // Add temporal relevance
    query += ` ${currentMonth} ${currentYear}`;

    // Add deal-specific terms
    query += ' ("% off" OR coupon OR promo OR "special offer" OR sale)';

    // Add location context if not global
    if (country.toLowerCase() !== 'global') {
      query += ` in ${country}`;
    }

    // Add specific search terms if provided
    if (specific) {
      query += ` ${specific}`;
    }

    // Exclude irrelevant content
    query += ' -expired -forum -blog -review';
    
    // Include trusted deal sites based on category
    switch (category.toLowerCase()) {
      case 'travel':
        query += ' (site:kayak.com OR site:skyscanner.com OR site:booking.com)';
        break;
      case 'groceries':
        query += ' (site:instacart.com OR site:walmart.com OR site:amazon.com)';
        break;
      case 'restaurants':
        query += ' (site:groupon.com OR site:opentable.com OR site:thefork.com)';
        break;
      case 'fashion':
        query += ' (site:nordstrom.com OR site:macys.com OR site:asos.com)';
        break;
      case 'electronics':
        query += ' (site:bestbuy.com OR site:amazon.com OR site:newegg.com)';
        break;
    }

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

    // Remove duplicates based on URL
    const uniqueDeals = this.removeDuplicateDeals(deals);

    // Sort by confidence in deal quality
    return this.sortDealsByQuality(uniqueDeals);
  }

  private isRelevantDeal(text: string, url: string): boolean {
    const relevantTerms = ['deal', 'discount', 'offer', 'promo', 'sale', 'off', 'save'];
    const spamTerms = ['scam', 'fake', 'expired', 'not working'];
    
    return (
      text.length > 0 &&
      url?.length > 0 &&
      relevantTerms.some(term => text.includes(term)) &&
      !spamTerms.some(term => text.includes(term)) &&
      !this.isBlockedDomain(url)
    );
  }

  private isBlockedDomain(url: string): boolean {
    const blockedDomains = ['pinterest', 'facebook', 'instagram', 'twitter'];
    try {
      const domain = new URL(url).hostname;
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
        currency: this.detectCurrency(text),
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
    return title
      .replace(/\b(best|top|amazing|exclusive)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim();
  }

  private generateDescription(title: string, category: string): string {
    return `Exclusive ${category} deal: ${title}. Limited time offer - check details on the retailer's website.`;
  }

  private extractPrice(text: string): number | null {
    const patterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
      /(?:price|cost|pay):?\s*\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /just\s*\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*dollars/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }
    return null;
  }

  private extractOriginalPrice(text: string): number | undefined {
    const patterns = [
      /was \$([0-9,.]+)/i,
      /originally \$([0-9,.]+)/i,
      /reg\.?\s*\$([0-9,.]+)/i,
      /regular price:?\s*\$([0-9,.]+)/i,
      /retail:?\s*\$([0-9,.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }
    return undefined;
  }

  private calculateDiscount(text: string, current?: number | null, original?: number): number | undefined {
    // First try to extract explicit discount percentage
    const percentMatch = text.match(/(\d+)%\s*(?:off|discount)/i);
    if (percentMatch) {
      const discount = parseInt(percentMatch[1]);
      return discount <= 100 ? discount : undefined;
    }

    // Calculate from prices if available
    if (current && original && original > current) {
      const discount = Math.round(((original - current) / original) * 100);
      return discount <= 100 ? discount : undefined;
    }

    // Try to extract savings amount
    const savingsMatch = text.match(/save\s*\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (savingsMatch && current) {
      const savings = parseFloat(savingsMatch[1].replace(/,/g, ''));
      const calculatedOriginal = current + savings;
      const discount = Math.round((savings / calculatedOriginal) * 100);
      return discount <= 100 ? discount : undefined;
    }

    return undefined;
  }

  private detectCurrency(text: string): string {
    const currencyMap = {
      '$': 'USD',
      '£': 'GBP',
      '€': 'EUR',
      '¥': 'JPY',
    };
    
    for (const [symbol, currency] of Object.entries(currencyMap)) {
      if (text.includes(symbol)) {
        return currency;
      }
    }
    return 'USD';
  }

  private extractRetailerName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const name = hostname
        .replace(/^www\./, '')
        .split('.')[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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
      /([\d.]+)\s*(?:\/\s*5|\s*stars?)/i,
      /rating:\s*([\d.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const rating = parseFloat(match[1]);
        return rating <= 5 ? rating : undefined;
      }
    }
    return undefined;
  }

  private extractCity(text: string): string | undefined {
    const cityPattern = /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = text.match(cityPattern);
    return match ? match[1] : undefined;
  }

  private extractPromoCode(text: string): { code: string; description: string } | undefined {
    const codePatterns = [
      /(?:code|promo|discount):?\s*["']([A-Z0-9]{4,})["']/i,
      /use\s+(?:code|promo)\s+["']([A-Z0-9]{4,})["']/i,
      /enter\s+["']([A-Z0-9]{4,})["']\s+at\s+checkout/i,
    ];

    for (const pattern of codePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          code: match[1].toUpperCase(),
          description: 'Apply at checkout for savings',
        };
      }
    }
    return undefined;
  }

  private calculateConfidenceScore(text: string, result: any): number {
    let score = 0;
    
    // Relevance indicators
    if (text.includes('% off')) score += 20;
    if (text.includes('deal')) score += 10;
    if (text.includes('limited time')) score += 15;
    if (text.includes('today only')) score += 25;
    
    // Result quality indicators
    if (result.position && result.position <= 10) score += 20;
    if (result.snippet?.length > 100) score += 10;
    if (result.imageUrl) score += 5;
    
    // Price and discount indicators
    if (this.extractPrice(text)) score += 15;
    if (this.extractOriginalPrice(text)) score += 10;
    if (this.extractPromoCode(text)) score += 25;
    
    return Math.min(score, 100);
  }

  private isValidDeal(deal: Deal): boolean {
    const hasValidTitle = deal.title?.length > 0 && deal.title !== 'Unnamed Deal';
    const hasValidUrl = deal.url?.length > 0;
    const hasValidRetailer = deal.retailer?.name !== 'Unknown Retailer';
    const hasValidPrice = deal.price?.current !== undefined || deal.price?.discountPercentage !== undefined;
    const hasValidPromoCode = deal.promoCode !== undefined;

    return hasValidTitle && hasValidUrl && hasValidRetailer && (hasValidPrice || hasValidPromoCode);
  }

  private removeDuplicateDeals(deals: Deal[]): Deal[] {
    const seen = new Set();
    return deals.filter(deal => {
      const key = deal.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sortDealsByQuality(deals: Deal[]): Deal[] {
    return deals.sort((a, b) => {
      const scoreA = (a.metadata?.confidence || 0) + (a.price?.discountPercentage || 0);
      const scoreB = (b.metadata?.confidence || 0) + (b.price?.discountPercentage || 0);
      return scoreB - scoreA;
    });
  }

  private getCountryCode(country: string): string {
    const normalizedCountry = country.toLowerCase().trim();
    return COUNTRY_CODES[normalizedCountry] || 'us';
  }
}
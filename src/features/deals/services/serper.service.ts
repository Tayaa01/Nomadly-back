import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly serperKey = 'cd9724facdf17368ae057d320d99b3239c63a2c9';
  private readonly serperUrl = 'https://google.serper.dev/search';

  constructor(private configService: ConfigService) {}

  async searchForDeals(
    country: string,
    category: string,
    specific?: string,
    page: number = 1,
  ): Promise<any> {
    try {
      // Get deals from Serper.dev
      const serperResults = await this.getSerperDeals(country, category, specific, page);
      
      // Extract main retailers from results
      const mainRetailers = this.extractMainRetailers(serperResults?.organic || [], country, category);
      
      // Enrich with additional details
      const enrichedDeals = await this.enrichSearchResults(mainRetailers, country, category);

      return {
        organic: enrichedDeals,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(enrichedDeals.length / 20),
          totalItems: enrichedDeals.length,
          itemsPerPage: 20,
        },
      };
    } catch (error) {
      this.logger.error('Search error:', error);
      throw new HttpException(
        `Failed to fetch search results: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getSerperDeals(
    country: string,
    category: string,
    specific?: string,
    page: number = 1,
  ): Promise<any> {
    try {
      const searchQuery = this.buildSearchQuery(country, category, specific);
      const response = await axios.post(
        this.serperUrl,
        {
          q: searchQuery,
          gl: this.getCountryCode(country),
          hl: 'en',
          type: 'search',
          page,
          num: 20,
        },
        {
          headers: {
            'X-API-KEY': this.serperKey,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.warn('Serper API error:', error);
      return { organic: [] };
    }
  }

  private extractMainRetailers(results: any[], country: string, category: string): any[] {
    const retailers = this.getMainRetailers(category);
    return results.filter(result => {
      const domain = new URL(result.link).hostname.toLowerCase();
      return retailers.some(retailer => domain.includes(retailer.domain));
    });
  }

  private getMainRetailers(category: string): any[] {
    const retailers = {
      'shoes': [
        { name: 'Nike', domain: 'nike.com' },
        { name: 'Adidas', domain: 'adidas' },
        { name: 'Foot Locker', domain: 'footlocker' },
        { name: 'JD Sports', domain: 'jdsports' },
        { name: 'Zalando', domain: 'zalando' },
      ],
      'electronics': [
        { name: 'Amazon', domain: 'amazon' },
        { name: 'Best Buy', domain: 'bestbuy' },
        { name: 'MediaMarkt', domain: 'mediamarkt' },
        { name: 'Saturn', domain: 'saturn' },
      ],
      // Add more categories as needed
    };

    return retailers[category.toLowerCase()] || [];
  }

  private async enrichSearchResults(
    results: any[],
    country: string,
    category: string,
  ): Promise<Deal[]> {
    return Promise.all(results.map(async (result) => {
      const promoCode = this.extractPromoCode(result.snippet);
      const dealType = this.identifyDealType(result.snippet);
      const city = this.extractCity(result.snippet);
      
      const deal: Deal = {
        title: result.title,
        description: result.snippet,
        url: result.link,
        price: {
          current: parseFloat(this.extractPrice(result.snippet, 'discounted')) || 0,
          currency: 'USD',
          discountPercentage: this.calculateDiscountPercentage(
            this.extractPrice(result.snippet, 'original'),
            this.extractPrice(result.snippet, 'discounted'),
          ),
        },
        retailer: {
          name: result.title.split(' - ')[1] || 'Unknown Retailer',
          rating: this.extractRating(result.snippet),
        },
        category: category,
        location: {
          name: result.title.split(' - ')[1] || 'Unknown Store',
          address: result.address || '',
          city: result.city || '',
          country: country,
          coordinates: undefined,
        },
        lastVerified: new Date(),
        source: 'Serper',
      };
      return deal;
    }));
  }

  private extractPromoCode(text: string): string | undefined {
    const promoPatterns = [
      /(?:promo|coupon|discount)\s+code:?\s*["']?([A-Z0-9-_]+)["']?/i,
      /use\s+code\s+["']?([A-Z0-9-_]+)["']?/i,
      /code:\s*["']?([A-Z0-9-_]+)["']?/i,
    ];

    for (const pattern of promoPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private identifyDealType(text: string): 'promo_code' | 'bundle' | 'sale' | 'flash_deal' | 'seasonal' | 'standard' {
    if (text.match(/coupon|promo\s+code|discount\s+code/i)) return 'promo_code';
    if (text.match(/bundle|package\s+deal/i)) return 'bundle';
    if (text.match(/clearance|sale/i)) return 'sale';
    if (text.match(/flash\s+deal|limited\s+time/i)) return 'flash_deal';
    if (text.match(/seasonal|holiday/i)) return 'seasonal';
    return 'standard';
  }

  private extractCity(text: string): string | undefined {
    const cityPattern = /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = text.match(cityPattern);
    return match ? match[1] : undefined;
  }

  private extractVenueName(title: string, description: string): string {
    const businessPattern = /^([^-|:]+)/;
    const match = title.match(businessPattern);
    return match ? match[1].trim() : 'Unknown Venue';
  }

  private extractRating(text: string): number | undefined {
    const ratingPattern = /(\d(?:\.\d)?)\s*(?:\/\s*5|\s*stars?)/i;
    const match = text.match(ratingPattern);
    return match ? parseFloat(match[1]) : undefined;
  }

  private extractPriceRange(text: string): string | undefined {
    const pricePattern = /(\$+)/;
    const match = text.match(pricePattern);
    return match ? match[1] : undefined;
  }

  private extractTerms(text: string): string[] {
    const terms: string[] = [];
    const termsPattern = /(?:terms?|conditions?|restrictions?):\s*([^.]+)/gi;
    let match;
    while ((match = termsPattern.exec(text)) !== null) {
      terms.push(match[1].trim());
    }
    return terms;
  }

  private extractPrice(text: string, type: 'original' | 'discounted'): string | undefined {
    const pricePattern = type === 'original'
      ? /(?:original|regular|normal)\s+price:?\s*[$€£](\d+(?:\.\d{2})?)/i
      : /(?:now|only|special|discounted)\s+[$€£](\d+(?:\.\d{2})?)/i;
    const match = text.match(pricePattern);
    return match ? match[1] : undefined;
  }

  private calculateDiscountPercentage(original?: string, discounted?: string): number | undefined {
    if (!original || !discounted) return undefined;
    const originalPrice = parseFloat(original);
    const discountedPrice = parseFloat(discounted);
    if (isNaN(originalPrice) || isNaN(discountedPrice)) return undefined;
    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
  }

  private isVerifiedSource(url: string): boolean {
    const trustedDomains = [
      'nike.com',
      'adidas',
      'amazon',
      'footlocker',
      'jdsports',
      'zalando',
    ];
    const domain = new URL(url).hostname.toLowerCase();
    return trustedDomains.some(trusted => domain.includes(trusted));
  }

  private calculatePopularityScore(result: any): number {
    let score = 50; // Base score
    if (result.position <= 3) score += 30;
    if (result.position <= 10) score += 20;
    if (this.isVerifiedSource(result.link)) score += 20;
    return Math.min(score, 100);
  }

  private buildSearchQuery(
    country: string,
    category: string,
    specific?: string,
  ): string {
    let query = `best deals discounts ${category}`;
    if (specific) {
      query += ` ${specific}`;
    }
    query += ` in ${country}`;
    query += ` sale offers promo codes`;
    return query;
  }

  private getCountryCode(country: string): string {
    const normalizedCountry = country.toLowerCase().trim();
    const countryCode = COUNTRY_CODES[normalizedCountry];
    
    if (!countryCode) {
      throw new HttpException(
        `Invalid country: ${country}. Please provide a valid country name.`,
        HttpStatus.BAD_REQUEST
      );
    }
    
    return countryCode;
  }
} 
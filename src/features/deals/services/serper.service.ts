import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly apiKey = 'cd9724facdf17368ae057d320d99b3239c63a2c9';
  private readonly baseUrl = 'https://google.serper.dev/search';

  constructor(private configService: ConfigService) {}

  async searchForDeals(
    country: string,
    category: string,
    specific?: string,
    page: number = 1,
  ): Promise<any> {
    try {
      const searchQuery = this.buildSearchQuery(country, category, specific);
      this.logger.debug(`Searching with query: ${searchQuery}`);

      const response = await axios.post(
        this.baseUrl,
        {
          q: searchQuery,
          gl: this.getCountryCode(country),
          hl: 'en',
          type: 'search',
          page: page,
          num: 20,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      const enrichedResults = await this.enrichSearchResults(
        response.data.organic || [],
        country,
        category,
      );

      const resultsWithCoordinates = await Promise.all(
        enrichedResults.map(async (deal) => {
          if (deal.location.city) {
            const coordinates = await this.getCoordinates(
              deal.location.city,
              deal.location.country,
            );
            deal.location.coordinates = coordinates;
          }
          return deal;
        }),
      );

      return {
        organic: resultsWithCoordinates,
        knowledge: response.data.knowledge || null,
        relatedSearches: response.data.relatedSearches || [],
        places: response.data.places || [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((response.data.totalResults || 100) / 20),
          totalItems: response.data.totalResults || 0,
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

  private async enrichSearchResults(
    results: any[],
    country: string,
    category: string,
  ): Promise<Deal[]> {
    return results.map((result) => {
      const promoCode = this.extractPromoCode(result.snippet);
      const dealType = this.identifyDealType(result.snippet);
      
      const deal: Deal = {
        title: result.title,
        description: result.snippet,
        url: result.link,
        location: {
          country: country,
          address: this.extractAddress(result.snippet),
          city: this.extractCity(result.snippet),
          coordinates: undefined, // Will be filled later
        },
        venue: {
          name: this.extractVenueName(result.title, result.snippet),
          type: category,
          rating: this.extractRating(result.snippet),
          priceRange: this.extractPriceRange(result.snippet),
          contact: {
            phone: this.extractPhone(result.snippet),
            website: result.link,
            socialMedia: this.extractSocialMedia(result.snippet),
          },
        },
        dealDetails: {
          startDate: this.extractDate(result.snippet, 'start'),
          endDate: this.extractDate(result.snippet, 'end'),
          terms: this.extractTerms(result.snippet),
          originalPrice: this.extractPrice(result.snippet, 'original'),
          discountedPrice: this.extractPrice(result.snippet, 'discounted'),
          discountPercentage: this.calculateDiscountPercentage(
            this.extractPrice(result.snippet, 'original'),
            this.extractPrice(result.snippet, 'discounted'),
          ),
          availability: this.extractAvailability(result.snippet),
          redemptionInstructions: this.extractRedemptionInstructions(result.snippet),
          promoCode: promoCode,
          dealType: dealType,
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          source: new URL(result.link).hostname,
          verified: this.isVerifiedSource(result.link),
          popularity: this.calculatePopularityScore(result),
        },
      };
      return deal;
    });
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

  private identifyDealType(text: string): string {
    if (text.match(/coupon|promo\s+code|discount\s+code/i)) return 'promo_code';
    if (text.match(/bundle|package\s+deal/i)) return 'bundle';
    if (text.match(/clearance|sale/i)) return 'sale';
    if (text.match(/flash\s+deal|limited\s+time/i)) return 'flash_deal';
    if (text.match(/seasonal|holiday/i)) return 'seasonal';
    return 'standard';
  }

  private extractPhone(text: string): string | undefined {
    const phonePattern = /(?:phone|tel|call):\s*([+\d\s-()]{10,})/i;
    const match = text.match(phonePattern);
    return match ? match[1].trim() : undefined;
  }

  private extractSocialMedia(text: string): { [key: string]: string } {
    const socialMedia: { [key: string]: string } = {};
    const patterns = {
      facebook: /facebook\.com\/([^\/\s]+)/i,
      instagram: /instagram\.com\/([^\/\s]+)/i,
      twitter: /twitter\.com\/([^\/\s]+)/i,
    };

    Object.entries(patterns).forEach(([platform, pattern]) => {
      const match = text.match(pattern);
      if (match) socialMedia[platform] = match[1];
    });

    return Object.keys(socialMedia).length > 0 ? socialMedia : undefined;
  }

  private extractAvailability(text: string): string | undefined {
    const availabilityPattern = /availability:\s*([^.]+)/i;
    const match = text.match(availabilityPattern);
    return match ? match[1].trim() : undefined;
  }

  private extractRedemptionInstructions(text: string): string | undefined {
    const instructionPatterns = [
      /how\s+to\s+redeem:\s*([^.]+)/i,
      /redemption:\s*([^.]+)/i,
      /to\s+claim:\s*([^.]+)/i,
    ];

    for (const pattern of instructionPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return undefined;
  }

  private async getCoordinates(city: string, country: string): Promise<{ latitude: number; longitude: number } | undefined> {
    try {
      // Note: In a production environment, you would want to use a geocoding service
      // This is a simplified example that returns mock coordinates
      const mockCoordinates = {
        'istanbul': { latitude: 41.0082, longitude: 28.9784 },
        'ankara': { latitude: 39.9334, longitude: 32.8597 },
        'izmir': { latitude: 38.4237, longitude: 27.1428 },
      };

      return mockCoordinates[city.toLowerCase()] || undefined;
    } catch (error) {
      this.logger.error('Error getting coordinates:', error);
      return undefined;
    }
  }

  private extractAddress(text: string): string | undefined {
    // Look for common address patterns
    const addressPattern = /(?:located at|address:|location:)\s*([^.]+)/i;
    const match = text.match(addressPattern);
    return match ? match[1].trim() : undefined;
  }

  private extractCity(text: string): string | undefined {
    // Look for city names in the text
    const cityPattern = /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = text.match(cityPattern);
    return match ? match[1] : undefined;
  }

  private extractVenueName(title: string, description: string): string {
    // Try to extract business name from title or description
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

  private extractDate(text: string, type: 'start' | 'end'): string | undefined {
    // Look for date patterns in the text
    const datePattern = type === 'start' 
      ? /(?:starts?|beginning|from)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i
      : /(?:ends?|until|through)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i;
    const match = text.match(datePattern);
    return match ? new Date(match[1]).toISOString() : undefined;
  }

  private extractTerms(text: string): string[] {
    const terms: string[] = [];
    // Look for common terms and conditions patterns
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
    // List of trusted domains
    const trustedDomains = [
      'groupon.com',
      'booking.com',
      'tripadvisor.com',
      'expedia.com',
      'hotels.com',
      // Add more trusted domains as needed
    ];
    const domain = new URL(url).hostname.replace('www.', '');
    return trustedDomains.some(trusted => domain.includes(trusted));
  }

  private calculatePopularityScore(result: any): number {
    let score = 0;
    // Factor in various signals
    if (result.position <= 3) score += 30;
    if (result.position <= 10) score += 20;
    if (result.snippet?.includes('popular')) score += 10;
    if (result.snippet?.includes('best seller')) score += 15;
    if (result.snippet?.includes('trending')) score += 10;
    return Math.min(score, 100); // Cap at 100
  }

  private buildSearchQuery(
    country: string,
    category: string,
    specific?: string,
  ): string {
    let query = `current deals discounts ${category}`;
    if (specific) {
      query += ` ${specific}`;
    }
    query += ` in ${country}`;
    query += ` promo codes coupons offers location venue price reviews ratings`;
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
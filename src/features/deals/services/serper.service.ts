import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly serperKey: string;
  private readonly serperUrl = 'https://google.serper.dev/search';

  constructor(private configService: ConfigService) {
    this.serperKey = this.configService.get<string>('SERPER_API_KEY') || '';
    if (!this.serperKey) {
      this.logger.warn('SERPER_API_KEY is not defined in environment variables');
    }
  }

  async searchForDeals(
    country: string,
    category: string,
    specific?: string,
  ): Promise<Deal[]> {
    try {
      const searchQuery = this.buildSearchQuery(country, category, specific);
      const response = await axios.post(
        this.serperUrl,
        {
          q: searchQuery,
          gl: this.getCountryCode(country),
          hl: 'en',
          type: 'search',
          num: 20,
        },
        {
          headers: {
            'X-API-KEY': this.serperKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data?.organic) {
        return [];
      }

      return this.parseSearchResults(response.data.organic, country, category);
    } catch (error) {
      this.logger.error('Search error:', error);
      return [];
    }
  }

  private parseSearchResults(results: any[], country: string, category: string): Deal[] {
    return results.map(result => {
      const price = this.extractPrice(result.snippet);
      const discountPercentage = this.extractDiscount(result.snippet);
      const retailerName = this.extractRetailerName(result.title);
      
      return {
        title: result.title,
        description: result.snippet,
        url: result.link,
        price: {
          current: price || 0,
          currency: 'USD',
          discountPercentage: discountPercentage || 0,
        },
        retailer: {
          name: retailerName,
          rating: this.extractRating(result.snippet),
        },
        category,
        location: {
          name: retailerName,
          address: '',
          city: this.extractCity(result.snippet) || '',
          country: country,
          coordinates: undefined,
        },
        lastVerified: new Date(),
        source: 'Google Search',
      };
    });
  }

  private extractPrice(text: string): number {
    const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
    return priceMatch ? parseFloat(priceMatch[1]) : 0;
  }

  private extractDiscount(text: string): number {
    const discountMatch = text.match(/(\d+)%\s*off/i);
    return discountMatch ? parseInt(discountMatch[1]) : 0;
  }

  private extractRetailerName(title: string): string {
    const parts = title.split(/[-|]/);
    return parts.length > 1 ? parts[1].trim() : 'Unknown Retailer';
  }

  private extractRating(text: string): number | undefined {
    const ratingMatch = text.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|\s*stars?)/i);
    return ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
  }

  private extractCity(text: string): string | undefined {
    const cityPattern = /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = text.match(cityPattern);
    return match ? match[1] : undefined;
  }

  private buildSearchQuery(
    country: string,
    category: string,
    specific?: string,
  ): string {
    let query = `best deals ${category}`;
    if (specific) {
      query += ` ${specific}`;
    }
    query += ` in ${country}`;
    query += ` discount sale`;
    return query;
  }

  private getCountryCode(country: string): string {
    const normalizedCountry = country.toLowerCase().trim();
    return COUNTRY_CODES[normalizedCountry] || 'US';
  }
} 
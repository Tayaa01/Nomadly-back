import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Deal, DealSearchParams, DealAnalysis } from '../interfaces/deal.interface';
import { SerperService } from './serper.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class DealsAggregatorService {
  private readonly logger = new Logger(DealsAggregatorService.name);
  private readonly cache = new Map<string, { data: DealAnalysis; timestamp: number }>();
  private readonly CACHE_TTL = 900000; // 15 minutes cache

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serperService: SerperService,
    private readonly geminiService: GeminiService,
  ) {}

  async searchDeals(params: DealSearchParams): Promise<DealAnalysis> {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Returning cached analysis');
        return cached.data;
      }

      const deals = await this.serperService.searchForDeals(
        params.country,
        params.category,
        params.specific,
      );

      this.logger.debug(`Fetched ${deals.length} raw deals from Serper`);

      if (deals.length === 0) {
        throw new HttpException(
          `No deals found for ${params.category} in ${params.country}`,
          HttpStatus.NOT_FOUND
        );
      }

      const enrichedDeals = await this.enrichDealsWithLocation(deals);
      const filteredDeals = this.filterDeals(enrichedDeals, params);
      
      if (filteredDeals.length === 0) {
        throw new HttpException(
          'No deals match the specified criteria',
          HttpStatus.NOT_FOUND
        );
      }

      const analyzedResults = await this.geminiService.analyzeDeals(
        { deals: filteredDeals, ...params },
        params.category,
      );

      const finalResults = {
        ...analyzedResults,
        recommendations: this.sortDeals(analyzedResults.recommendations, params.sortBy),
        metadata: {
          ...analyzedResults.metadata,
          timestamp: new Date().toISOString(),
          query: {
            category: params.category,
            country: params.country,
            specific: params.specific,
          }
        }
      };

      this.cache.set(cacheKey, {
        data: finalResults,
        timestamp: Date.now(),
      });

      return finalResults;
    } catch (error) {
      this.logger.error('Error aggregating deals:', error);
      throw new HttpException(
        error.message || 'Failed to fetch deals',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generateCacheKey(params: DealSearchParams): string {
    return `${params.category}-${params.country}-${params.specific || ''}-${params.minDiscount || ''}-${params.maxPrice || ''}`;
  }

  private async enrichDealsWithLocation(deals: Deal[]): Promise<Deal[]> {
    return Promise.all(
      deals.map(async deal => {
        if (!deal.retailer.name || deal.location?.coordinates) return deal;

        try {
          const location = await this.getLocationFromOpenStreetMap(
            deal.retailer.name,
            deal.location?.city || '',
          );
          
          if (location) {
            deal.location = {
              ...deal.location,
              ...location,
            };
            deal.metadata = {
              ...deal.metadata,
              locationConfidence: this.calculateLocationConfidence(location),
            };
          }
          
          return deal;
        } catch (error) {
          this.logger.warn(`Location lookup failed for ${deal.retailer.name}:`, error);
          return deal;
        }
      }),
    );
  }

  private calculateLocationConfidence(location: any): number {
    let confidence = 0;
    if (location.coordinates?.latitude && location.coordinates?.longitude) confidence += 30;
    if (location.address) confidence += 25;
    if (location.city) confidence += 25;
    if (location.country) confidence += 20;
    return confidence;
  }

  private async getLocationFromOpenStreetMap(businessName: string, city: string): Promise<any> {
    try {
      const query = encodeURIComponent(`${businessName} ${city}`);
      const response = await firstValueFrom(
        this.httpService.get(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': `DealsApp/1.0 (${this.configService.get('APP_URL')})`,
            },
          },
        ),
      );

      if (!response.data.length) return null;

      const place = response.data[0];
      return {
        name: businessName,
        address: place.display_name,
        city: city || place.address?.city || '',
        country: place.address?.country || '',
        coordinates: {
          latitude: parseFloat(place.lat),
          longitude: parseFloat(place.lon),
        },
      };
    } catch (error) {
      this.logger.warn('OpenStreetMap API error:', error);
      return null;
    }
  }

  private filterDeals(deals: Deal[], params: DealSearchParams): Deal[] {
    return deals.filter(deal => {
      // Basic validation
      if (!deal.title || !deal.url || !deal.retailer.name) return false;

      // Price filters
      if (params.minDiscount && (!deal.price?.discountPercentage || deal.price.discountPercentage < params.minDiscount)) return false;
      if (params.maxPrice && deal.price?.current && deal.price.current > params.maxPrice) return false;

      // Location filters
      if (params.latitude && params.longitude && params.radius) {
        if (!deal.location?.coordinates) return false;
        const distance = this.calculateDistance(
          params.latitude,
          params.longitude,
          deal.location.coordinates.latitude,
          deal.location.coordinates.longitude,
        );
        return distance <= params.radius;
      }

      return true;
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private sortDeals(deals: Deal[], sortBy?: string): Deal[] {
    return [...deals].sort((a, b) => {
      switch (sortBy) {
        case 'discount':
          return (b.price?.discountPercentage || 0) - (a.price?.discountPercentage || 0);
        case 'price':
          return (a.price?.current || Infinity) - (b.price?.current || Infinity);
        case 'rating':
          return (b.retailer.rating || 0) - (a.retailer.rating || 0);
        case 'confidence':
          return (b.metadata?.confidence || 0) - (a.metadata?.confidence || 0);
        default:
          // Default sorting by a composite score
          const scoreA = this.calculateDealScore(a);
          const scoreB = this.calculateDealScore(b);
          return scoreB - scoreA;
      }
    });
  }

  private calculateDealScore(deal: Deal): number {
    let score = 0;
    
    // Discount weight (40%)
    score += (deal.price?.discountPercentage || 0) * 0.4;
    
    // Confidence weight (30%)
    score += (deal.metadata?.confidence || 0) * 0.3;
    
    // Rating weight (20%)
    score += (deal.retailer.rating || 0) * 4; // Convert 5-star scale to percentage
    
    // Completeness weight (10%)
    score += this.calculateCompletenessScore(deal) * 0.1;
    
    return score;
  }

  private calculateCompletenessScore(deal: Deal): number {
    let score = 0;
    if (deal.price?.current) score += 20;
    if (deal.price?.original) score += 20;
    if (deal.promoCode) score += 20;
    if (deal.location?.coordinates) score += 20;
    if (deal.imageUrl) score += 20;
    return score;
  }
}
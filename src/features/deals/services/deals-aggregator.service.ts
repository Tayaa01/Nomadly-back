import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Deal, DealSearchParams } from '../interfaces/deal.interface';
import { SerperService } from './serper.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class DealsAggregatorService {
  private readonly logger = new Logger(DealsAggregatorService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serperService: SerperService,
    private readonly geminiService: GeminiService,
  ) {}

  async searchDeals(params: DealSearchParams): Promise<Deal[]> {
    try {
      // Get deals from Serper
      const deals = await this.serperService.searchForDeals(
        params.country,
        params.category,
        params.specific,
      );
      
      // Analyze deals with Gemini
      const analysis = await this.geminiService.analyzeDeals(
        { deals },
        params.category
      );
      
      // Enrich deals with location data
      const dealsWithLocation = await this.enrichDealsWithLocation(analysis.recommendations);
      
      // Sort and return results
      return this.sortDeals(dealsWithLocation, params.sortBy);
    } catch (error) {
      this.logger.error('Error aggregating deals:', error);
      throw new HttpException(
        'Failed to fetch deals',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async enrichDealsWithLocation(deals: Deal[]): Promise<Deal[]> {
    return Promise.all(
      deals.map(async (deal) => {
        if (!deal.retailer.name) return deal;

        try {
          const location = await this.getLocationFromOpenStreetMap(
            deal.retailer.name,
            deal.location?.city || ''
          );
          
          if (location) {
            deal.location = {
              ...deal.location,
              ...location,
            };
          }
          return deal;
        } catch (error) {
          this.logger.warn(`Location lookup failed for ${deal.retailer.name}:`, error);
          return deal;
        }
      })
    );
  }

  private async getLocationFromOpenStreetMap(businessName: string, city: string): Promise<any> {
    try {
      const query = encodeURIComponent(`${businessName} ${city}`);
      const response = await firstValueFrom(
        this.httpService.get(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'Nomadly/1.0',
            },
          }
        )
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

  private sortDeals(deals: Deal[], sortBy?: string): Deal[] {
    switch (sortBy) {
      case 'discount':
        return deals.sort((a, b) => 
          (b.price?.discountPercentage || 0) - (a.price?.discountPercentage || 0)
        );
      case 'price':
        return deals.sort((a, b) => 
          (a.price?.current || 0) - (b.price?.current || 0)
        );
      case 'rating':
        return deals.sort((a, b) => 
          (b.retailer.rating || 0) - (a.retailer.rating || 0)
        );
      default:
        return deals;
    }
  }
} 
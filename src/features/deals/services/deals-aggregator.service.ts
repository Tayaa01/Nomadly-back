import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Deal, DealSearchParams } from '../interfaces/deal.interface';

@Injectable()
export class DealsAggregatorService {
  private readonly logger = new Logger(DealsAggregatorService.name);
  private readonly rapidApiKey: string;
  private readonly rapidApiHost = 'real-time-product-search.p.rapidapi.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.rapidApiKey = this.configService.get<string>('RAPID_API_KEY') || '';
    if (!this.rapidApiKey) {
      this.logger.warn('No RAPID_API_KEY provided, will use default deals');
    }
  }

  async searchDeals(params: DealSearchParams): Promise<Deal[]> {
    try {
      // Get deals from a reliable API source
      const deals = await this.fetchDealsFromAPI(params);
      
      // Enrich deals with location data
      const dealsWithLocation = await this.enrichDealsWithLocation(deals);
      
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

  private async fetchDealsFromAPI(params: DealSearchParams): Promise<Deal[]> {
    if (!this.rapidApiKey) {
      this.logger.warn('No API key available, using default deals');
      return this.getDefaultDeals(params);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://real-time-product-search.p.rapidapi.com/search', {
          params: {
            q: `${params.category} ${params.specific || ''} deals`,
            country: params.country,
            limit: '50',
          },
          headers: {
            'X-RapidAPI-Key': this.rapidApiKey,
            'X-RapidAPI-Host': this.rapidApiHost,
          },
        })
      );

      if (!response.data?.data?.length) {
        this.logger.warn('No deals found from API, using defaults');
        return this.getDefaultDeals(params);
      }

      return response.data.data.map(deal => this.mapDealResponse(deal, params));
    } catch (error) {
      this.logger.warn('API fetch error:', error?.message || error);
      return this.getDefaultDeals(params);
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

  private mapDealResponse(apiDeal: any, params: DealSearchParams): Deal {
    const price = apiDeal.offer?.price || apiDeal.price;
    const originalPrice = apiDeal.offer?.original_price || apiDeal.original_price;
    const discountPercentage = originalPrice && price ? 
      Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

    return {
      title: apiDeal.title || '',
      description: apiDeal.description || apiDeal.snippet || '',
      url: apiDeal.url || apiDeal.link || '',
      price: {
        current: parseFloat(price) || 0,
        currency: apiDeal.currency_code || 'USD',
        discountPercentage,
      },
      retailer: {
        name: apiDeal.merchant || apiDeal.seller || 'Unknown Retailer',
        rating: apiDeal.rating || undefined,
      },
      category: apiDeal.category || params.category || 'General',
      location: {
        name: apiDeal.merchant || apiDeal.seller || 'Unknown Store',
        address: apiDeal.location || '',
        city: apiDeal.city || '',
        country: apiDeal.country || params.country || '',
        coordinates: undefined,
      },
      lastVerified: new Date(),
      source: 'RapidAPI',
    };
  }

  private getDefaultDeals(params: DealSearchParams): Deal[] {
    // Return some sample deals when API is not available
    return [
      {
        title: 'Sample Electronics Deal',
        description: '20% off on latest electronics',
        url: 'https://example.com/deal',
        price: {
          current: 799.99,
          currency: 'USD',
          discountPercentage: 20,
        },
        retailer: {
          name: 'TechStore',
          rating: 4.5,
        },
        category: params.category,
        location: {
          name: 'TechStore Main',
          address: '123 Tech Street',
          city: 'San Francisco',
          country: params.country,
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
        },
        lastVerified: new Date(),
        source: 'Default',
      },
      // Add more default deals if needed
    ];
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
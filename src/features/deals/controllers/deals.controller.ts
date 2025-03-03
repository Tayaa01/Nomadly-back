import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SerperService } from '../services/serper.service';
import { GeminiService } from '../services/gemini.service';
import { DealsAggregatorService } from '../services/deals-aggregator.service';
import { DealSearchParams } from '../interfaces/deal.interface';

@Controller('deals')
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(
    private readonly serperService: SerperService,
    private readonly geminiService: GeminiService,
    private readonly dealsAggregator: DealsAggregatorService,
  ) {}

  @Get('search')
  async searchDeals(
    @Query('country') country: string,
    @Query('category') category: string,
    @Query('specific') specific?: string,
    @Query('radius') radius?: number,
    @Query('latitude') latitude?: number,
    @Query('longitude') longitude?: number,
    @Query('minDiscount') minDiscount?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('sortBy') sortBy?: 'discount' | 'price' | 'distance' | 'rating',
  ) {
    try {
      this.logger.debug(`Searching deals for ${category} in ${country}`);
      
      // Search for deals using multiple sources
      const searchParams: DealSearchParams = {
        country,
        category,
        specific,
        radius,
        latitude,
        longitude,
        minDiscount,
        maxPrice,
        sortBy,
      };

      const deals = await this.dealsAggregator.searchDeals(searchParams);
      this.logger.debug(`Found ${deals.length} deals from multiple sources`);

      // Get additional deals from Serper as backup
      const serperResults = await this.serperService.searchForDeals(
        country,
        category,
        specific,
      );
      this.logger.debug(`Found ${serperResults.length} additional deals from Serper`);

      // Combine all deals
      const allDeals = [...deals, ...serperResults];

      // Analyze results with Gemini
      const analyzedResults = await this.geminiService.analyzeDeals(
        { deals: allDeals, ...searchParams },
        category,
      );

      return {
        success: true,
        data: {
          ...analyzedResults,
          metadata: {
            timestamp: new Date().toISOString(),
            country,
            category,
            resultsCount: allDeals.length,
            sources: ['RetailMeNot', 'Groupon', 'Coupons API', 'Serper'],
          },
        },
      };
    } catch (error) {
      this.logger.error('Error in searchDeals:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}
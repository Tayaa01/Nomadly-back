import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SerperService } from '../services/serper.service';
import { GeminiService } from '../services/gemini.service';

@Controller('deals')
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(
    private readonly serperService: SerperService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get('search')
  async searchDeals(
    @Query('country') country: string,
    @Query('category') category: string,
    @Query('specific') specific?: string,
  ) {
    try {
      this.logger.debug(`Searching deals for ${category} in ${country}`);
      
      // Get search results
      const searchResults = await this.serperService.searchForDeals(
        country,
        category,
        specific,
      );

      this.logger.debug(`Found ${searchResults.organic?.length || 0} results`);

      // Analyze results
      const analyzedResults = await this.geminiService.analyzeDeals(
        searchResults,
        category,
      );

      return {
        success: true,
        data: analyzedResults,
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
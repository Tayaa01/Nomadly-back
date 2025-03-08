import { Controller, Get, Query, Logger } from '@nestjs/common';
import { DealsAggregatorService } from '../services/deals-aggregator.service';
import { DealSearchParams, DealResponse, Deal } from '../interfaces/deal.interface';

@Controller('deals')
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsAggregator: DealsAggregatorService) {}

  @Get('search')
  async searchDeals(
    @Query('country') country = 'global',
    @Query('category') category = 'travel',
    @Query('specific') specific?: string,
    @Query('radius') radius?: number,
    @Query('latitude') latitude?: number,
    @Query('longitude') longitude?: number,
    @Query('minDiscount') minDiscount?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('sortBy') sortBy?: 'discount' | 'price' | 'distance' | 'rating',
    @Query('page') page = 1,
    @Query('limit') limit = 5,
  ): Promise<DealResponse> {
    try {
      // Validate category
      const validCategories = ['travel', 'groceries', 'restaurants', 'fashion', 'electronics'];
      if (!validCategories.includes(category.toLowerCase())) {
        throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }

      this.logger.debug(`Searching ${category} deals in ${country}`);

      // Normalize inputs
      country = country.toLowerCase().trim();
      category = category.toLowerCase().trim();

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

      const analysis = await this.dealsAggregator.searchDeals(searchParams);
      
      if (!analysis.recommendations.length) {
        return {
          success: false,
          error: `No ${category} deals found in ${country}`,
          data: null,
        };
      }

      // Calculate pagination
      const totalItems = analysis.recommendations.length;
      const totalPages = Math.ceil(totalItems / limit);
      const start = (page - 1) * limit;
      const paginatedDeals = analysis.recommendations.slice(start, start + limit);

      return {
        success: true,
        data: {
          recommendations: paginatedDeals.map(deal => ({
            title: deal.title,
            description: deal.description,
            url: deal.url,
            price: deal.price,
            promoCode: deal.promoCode,
            retailer: deal.retailer,
            category: deal.category,
            lastVerified: deal.lastVerified,
            source: deal.source,
            imageUrl: deal.imageUrl,
            metadata: {
              ...deal.metadata,
              categorySpecific: this.getCategorySpecificMetadata(deal, category),
            },
          })),
          discounts: analysis.discounts || paginatedDeals.map(d => `${d.price?.discountPercentage || 0}% off at ${d.retailer.name}`),
          reasons: analysis.reasons || paginatedDeals.flatMap(d => d.metadata?.reasons || []),
          savingsTips: analysis.savingsTips,
          metadata: {
            ...analysis.metadata,
            timestamp: new Date().toISOString(),
            country,
            category,
            resultsCount: totalItems,
          },
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      this.logger.error('Error in searchDeals:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch deals',
        data: null,
      };
    }
  }

  private getCategorySpecificMetadata(deal: Deal, category: string): any {
    switch (category) {
      case 'travel':
        return {
          transportType: this.extractTransportType(deal.title),
          duration: this.extractDuration(deal.description),
          restrictions: this.extractRestrictions(deal.description),
        };
      case 'groceries':
        return {
          storeName: deal.retailer.name,
          inStore: deal.location?.coordinates ? true : false,
          delivery: deal.description.toLowerCase().includes('delivery'),
          minPurchase: this.extractMinPurchase(deal.description),
        };
      case 'restaurants':
        return {
          cuisine: this.extractCuisineType(deal.title, deal.description),
          dineIn: !deal.description.toLowerCase().includes('takeaway only'),
          takeaway: deal.description.toLowerCase().includes('takeaway'),
          groupSize: this.extractGroupSize(deal.description),
        };
      case 'fashion':
        return {
          brand: deal.retailer.name,
          season: this.extractSeason(deal.description),
          sizes: this.extractSizes(deal.description),
          collection: this.extractCollection(deal.description),
        };
      case 'electronics':
        return {
          brand: this.extractBrand(deal.title),
          model: this.extractModel(deal.title),
          warranty: this.extractWarranty(deal.description),
          condition: this.extractCondition(deal.description),
        };
      default:
        return {};
    }
  }

  private extractTransportType(title: string): string {
    const types = ['flight', 'train', 'bus', 'car rental'];
    return types.find(type => title.toLowerCase().includes(type)) || 'other';
  }

  private extractDuration(text: string): string | undefined {
    const match = text.match(/(\d+)(?:\s*)(day|hour|minute)s?/i);
    return match ? `${match[1]} ${match[2]}(s)` : undefined;
  }

  private extractRestrictions(text: string): string[] {
    const restrictions = [];
    if (text.toLowerCase().includes('non-refundable')) restrictions.push('Non-refundable');
    if (text.toLowerCase().includes('no changes')) restrictions.push('No changes allowed');
    if (text.toLowerCase().includes('minimum stay')) restrictions.push('Minimum stay required');
    return restrictions;
  }

  private extractMinPurchase(text: string): number | undefined {
    const match = text.match(/minimum(?:\s+purchase(?:\s+of)?)?\s+\$?(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractCuisineType(title: string, description: string): string {
    const cuisines = ['italian', 'chinese', 'japanese', 'mexican', 'indian', 'french'];
    const text = `${title} ${description}`.toLowerCase();
    return cuisines.find(cuisine => text.includes(cuisine)) || 'various';
  }

  private extractGroupSize(text: string): number | undefined {
    const match = text.match(/up to (\d+) people|(\d+) people max|max (\d+) persons/i);
    return match ? parseInt(match[1] || match[2] || match[3]) : undefined;
  }

  private extractSeason(text: string): string {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    return seasons.find(season => text.toLowerCase().includes(season)) || 'current';
  }

  private extractSizes(text: string): string[] {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return sizes.filter(size => text.toUpperCase().includes(size));
  }

  private extractCollection(text: string): string {
    const collections = ['new arrival', 'clearance', 'limited edition', 'seasonal'];
    return collections.find(c => text.toLowerCase().includes(c)) || 'regular';
  }

  private extractBrand(text: string): string {
    const brands = ['apple', 'samsung', 'sony', 'lg', 'dell', 'hp'];
    return brands.find(brand => text.toLowerCase().includes(brand)) || 'unknown';
  }

  private extractModel(text: string): string | undefined {
    const match = text.match(/model[:\s]+([A-Za-z0-9-]+)/i);
    return match ? match[1] : undefined;
  }

  private extractWarranty(text: string): string | undefined {
    const match = text.match(/(\d+)(?:\s*|-)(year|month)(?:\s+warranty)/i);
    return match ? `${match[1]} ${match[2]}(s)` : undefined;
  }

  private extractCondition(text: string): string {
    if (text.toLowerCase().includes('refurbished')) return 'refurbished';
    if (text.toLowerCase().includes('open box')) return 'open box';
    if (text.toLowerCase().includes('used')) return 'used';
    return 'new';
  }
}
import { Controller, Get, Query, Logger, BadRequestException } from '@nestjs/common'; // Import BadRequestException
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DealsAggregatorService } from '../services/deals-aggregator.service';
import { DealSearchParams, DealResponse, Deal } from '../interfaces/deal.interface';

@ApiTags('Deals') // Add Swagger tag for the Deals module
@Controller('deals')
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsAggregator: DealsAggregatorService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for deals', description: 'Search for deals based on various filters and parameters.' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of deals with pagination and metadata.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  price: { type: 'object' },
                  promoCode: { type: 'string', nullable: true },
                  retailer: { type: 'object' },
                  category: { type: 'string' },
                  lastVerified: { type: 'string', format: 'date-time' },
                  source: { type: 'string' },
                  imageUrl: { type: 'string', nullable: true },
                  metadata: { type: 'object' },
                },
              },
            },
            discounts: { type: 'array', items: { type: 'string' } },
            reasons: { type: 'array', items: { type: 'string' } },
            savingsTips: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            totalItems: { type: 'number' },
            itemsPerPage: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'country', required: false, description: 'Country to search deals in (default: global)', example: 'US' })
  @ApiQuery({ name: 'category', required: false, description: 'Category of deals (default: travel)', example: 'travel' })
  @ApiQuery({ name: 'specific', required: false, description: 'Specific keyword to filter deals', example: 'flights' })
  @ApiQuery({ name: 'radius', required: false, description: 'Search radius in kilometers', example: 50 })
  @ApiQuery({ name: 'latitude', required: false, description: 'Latitude for location-based search', example: 37.7749 })
  @ApiQuery({ name: 'longitude', required: false, description: 'Longitude for location-based search', example: -122.4194 })
  @ApiQuery({ name: 'minDiscount', required: false, description: 'Minimum discount percentage', example: 10 })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price for deals', example: 100 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort deals by discount, price, distance, or rating', example: 'discount' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default: 5)', example: 5 })
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
    @Query('limit') limit = 8,
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

  @Get('travel')
  @ApiOperation({ summary: 'Search for travel deals', description: 'Search specifically for travel deals based only on country, with pagination.' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of travel deals with pagination and metadata.',
    schema: { // Reusing the same schema as searchDeals
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  price: { type: 'object' },
                  promoCode: { type: 'string', nullable: true },
                  retailer: { type: 'object' },
                  category: { type: 'string', example: 'travel' }, // Example fixed to travel
                  lastVerified: { type: 'string', format: 'date-time' },
                  source: { type: 'string' },
                  imageUrl: { type: 'string', nullable: true },
                  metadata: { type: 'object' },
                },
              },
            },
            discounts: { type: 'array', items: { type: 'string' } },
            reasons: { type: 'array', items: { type: 'string' } },
            savingsTips: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            totalItems: { type: 'number' },
            itemsPerPage: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'country', required: false, description: 'Country to search deals in (default: global)', example: 'US' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default: 5)', example: 5 })
  async searchTravelDeals(
    @Query('country') country = 'global',
    @Query('page') page = 1,
    @Query('limit') limit = 8,
  ): Promise<DealResponse> {
    const category = 'travel'; // Hardcode category to 'travel'
    try {
      this.logger.debug(`Searching ${category} deals in ${country} (simplified)`);

      // Normalize inputs
      country = country.toLowerCase().trim();

      const searchParams: DealSearchParams = {
        country,
        category, // Use the hardcoded category
        specific: undefined,
        radius: undefined,
        latitude: undefined,
        longitude: undefined,
        minDiscount: undefined,
        maxPrice: undefined,
        sortBy: undefined,
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
            category: deal.category, // Will always be 'travel'
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
      this.logger.error(`Error in searchTravelDeals for ${category} in ${country}:`, error);
      return {
        success: false,
        error: error.message || `Failed to fetch ${category} deals`,
        data: null,
      };
    }
  }

  @Get('travel/packages')
  @ApiOperation({ summary: 'Search for travel packages', description: 'Search for travel packages (e.g., flight + hotel) between two countries.' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of travel package deals with pagination and metadata.',
    schema: { // Reusing the same schema as searchDeals/searchTravelDeals
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  price: { type: 'object' },
                  promoCode: { type: 'string', nullable: true },
                  retailer: { type: 'object' },
                  category: { type: 'string', example: 'travel' }, // Example fixed to travel
                  lastVerified: { type: 'string', format: 'date-time' },
                  source: { type: 'string' },
                  imageUrl: { type: 'string', nullable: true },
                  metadata: { type: 'object' },
                },
              },
            },
            discounts: { type: 'array', items: { type: 'string' } },
            reasons: { type: 'array', items: { type: 'string' } },
            savingsTips: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            totalItems: { type: 'number' },
            itemsPerPage: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'departureCountry', required: true, description: 'Departure country name or code', example: 'USA' })
  @ApiQuery({ name: 'arrivalCountry', required: true, description: 'Arrival country name or code', example: 'France' })
  @ApiQuery({ name: 'specific', required: false, description: 'Specific keywords for the package (e.g., beach, city break)', example: 'beach' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default: 5)', example: 5 })
  async searchTravelPackages(
    @Query('departureCountry') departureCountry: string,
    @Query('arrivalCountry') arrivalCountry: string,
    @Query('specific') specific?: string, // Optional specific keywords
    @Query('page') page = 1,
    @Query('limit') limit = 8,
  ): Promise<DealResponse> {
    const category = 'travel'; // Hardcode category

    // Basic validation
    if (!departureCountry || !arrivalCountry) {
        throw new BadRequestException('Departure and arrival countries are required.');
    }

    try {
      this.logger.debug(`Searching ${category} packages from ${departureCountry} to ${arrivalCountry}`);

      // Normalize inputs
      const normDepartureCountry = departureCountry.toLowerCase().trim();
      const normArrivalCountry = arrivalCountry.toLowerCase().trim();

      const searchParams: DealSearchParams = {
        country: normArrivalCountry, // Use arrival country as primary context for Serper 'gl' param
        category,
        departureCountry: normDepartureCountry,
        arrivalCountry: normArrivalCountry,
        specific, // Pass specific keywords if provided
        // Set other params to undefined as they are not used for this endpoint
        radius: undefined,
        latitude: undefined,
        longitude: undefined,
        minDiscount: undefined,
        maxPrice: undefined,
        sortBy: undefined, // Let SerperService sorting handle package relevance
      };

      // Assuming DealsAggregatorService.searchDeals now accepts the updated DealSearchParams
      const analysis = await this.dealsAggregator.searchDeals(searchParams);

      if (!analysis.recommendations.length) {
        return {
          success: false,
          error: `No ${category} packages found from ${departureCountry} to ${arrivalCountry}`,
          data: null,
        };
      }

      // Calculate pagination
      const totalItems = analysis.recommendations.length;
      const totalPages = Math.ceil(totalItems / limit);
      const start = (page - 1) * limit;
      const paginatedDeals = analysis.recommendations.slice(start, start + limit);

      // Format response (similar to other endpoints)
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
            category: deal.category, // Should be 'travel'
            lastVerified: deal.lastVerified,
            source: deal.source,
            imageUrl: deal.imageUrl,
            metadata: {
              ...deal.metadata,
              // Add package specific metadata if possible/needed later
              categorySpecific: this.getCategorySpecificMetadata(deal, category),
            },
          })),
          discounts: analysis.discounts || paginatedDeals.map(d => `${d.price?.discountPercentage || 0}% off at ${d.retailer.name}`),
          reasons: analysis.reasons || paginatedDeals.flatMap(d => d.metadata?.reasons || []),
          savingsTips: analysis.savingsTips,
          metadata: {
            ...analysis.metadata,
            timestamp: new Date().toISOString(),
            departureCountry: normDepartureCountry, // Add package context to metadata
            arrivalCountry: normArrivalCountry,
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
      this.logger.error(`Error in searchTravelPackages from ${departureCountry} to ${arrivalCountry}:`, error);
      // Handle potential BadRequestException from validation
      if (error instanceof BadRequestException) {
          throw error;
      }
      return {
        success: false,
        error: error.message || `Failed to fetch ${category} packages`,
        data: null,
      };
    }
  }

  @Get('travel/cheapest')
  async searchCheapestTravelOffers(
    @Query('destination') destination: string,
    @Query('page') page = 1,
    @Query('limit') limit = 8,
  ): Promise<DealResponse> {
    if (!destination) {
      throw new BadRequestException('Destination is required');
    }
    try {
      const deals = await this.dealsAggregator.searchCheapestTravelOffers(destination);

      if (!deals.length) {
        return {
          success: false,
          error: `No travel offers found to ${destination}`,
          data: null,
        };
      }

      const totalItems = deals.length;
      const totalPages = Math.ceil(totalItems / limit);
      const start = (page - 1) * limit;
      const paginatedDeals = deals.slice(start, start + limit);

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
            metadata: deal.metadata,
          })),
          discounts: [],
          reasons: [],
          savingsTips: [],
          metadata: {
            timestamp: new Date().toISOString(),
            country: destination,
            arrivalCountry: destination,
            category: 'travel',
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
      this.logger.error('Error in searchCheapestTravelOffers:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch cheapest travel offers',
        data: null,
      };
    }
  }

  @Get('hunt')
  @ApiOperation({ summary: 'Hunt for deals', description: 'Quickly find the best deals with minimal input.' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of the best deals.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  price: { type: 'object' },
                  retailer: { type: 'object' },
                  category: { type: 'string' },
                  lastVerified: { type: 'string', format: 'date-time' },
                },
              },
            },
            discounts: { type: 'array', items: { type: 'string' } },
            reasons: { type: 'array', items: { type: 'string' } },
            savingsTips: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'category', required: false, description: 'Category of deals (default: travel)', example: 'travel' })
  @ApiQuery({ name: 'country', required: false, description: 'Country to search deals in (default: global)', example: 'US' })
  async huntDeals(
    @Query('category') category = 'travel',
    @Query('country') country = 'global',
  ): Promise<DealResponse> {
    try {
      this.logger.debug(`Hunting for ${category} deals in ${country}`);

      const searchParams: DealSearchParams = {
        country: country.toLowerCase().trim(),
        category: category.toLowerCase().trim(),
        specific: undefined,
        radius: undefined,
        latitude: undefined,
        longitude: undefined,
        minDiscount: 10,
        maxPrice: undefined,
        sortBy: 'discount' as 'discount',
      };

      const analysis = await this.dealsAggregator.searchDeals(searchParams);

      if (!analysis.recommendations.length) {
        return {
          success: false,
          error: `No ${category} deals found in ${country}`,
          data: null,
        };
      }

      const topDeals = analysis.recommendations.slice(0, 5);

      return {
        success: true,
        data: {
          recommendations: topDeals.map(deal => ({
            title: deal.title,
            description: deal.description,
            url: deal.url,
            price: deal.price,
            retailer: deal.retailer,
            category: deal.category,
            lastVerified: deal.lastVerified,
            source: deal.source, // Include the source property
            imageUrl: deal.imageUrl,
          })),
          discounts: topDeals.map(deal => `${deal.price?.discountPercentage || 0}% off at ${deal.retailer.name}`),
          reasons: topDeals.flatMap(deal => deal.metadata?.reasons || []),
          savingsTips: analysis.savingsTips || [],
          metadata: {
            timestamp: new Date().toISOString(),
            country,
            category,
            resultsCount: topDeals.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error in huntDeals:', error);
      return {
        success: false,
        error: error.message || 'Failed to hunt deals',
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
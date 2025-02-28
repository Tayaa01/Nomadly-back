import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { Deal } from '../interfaces/deal.interface';
import { COUNTRY_CODES } from '../constants/country-codes.constant';
import { ConfigService } from '@nestjs/config';
import * as Parser from 'rss-parser';
import * as cheerio from 'cheerio';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly serperKey = 'cd9724facdf17368ae057d320d99b3239c63a2c9';
  private readonly serperUrl = 'https://google.serper.dev/search';
  private readonly rssParser = new Parser();

  constructor(private configService: ConfigService) {}

  async searchForDeals(
    country: string,
    category: string,
    specific?: string,
    page: number = 1,
  ): Promise<any> {
    try {
      // Fetch deals from multiple sources in parallel
      const [serperDeals, rssDeals, retailDeals, scrapedDeals] = await Promise.all([
        this.getSerperDeals(country, category, specific, page),
        this.getRSSDeals(country, category, specific),
        this.getRetailDeals(country, category, specific),
        this.scrapeRetailerWebsites(country, category, specific),
      ]);

      // Merge and deduplicate deals
      const allDeals = this.mergeDeals([
        ...(serperDeals?.organic || []),
        ...(rssDeals || []),
        ...(retailDeals || []),
        ...(scrapedDeals || []),
      ]);

      // Enrich with coordinates and additional details
      const enrichedDeals = await this.enrichSearchResults(allDeals, country, category);

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

  private async getRSSDeals(
    country: string,
    category: string,
    specific?: string,
  ): Promise<any[]> {
    try {
      const feeds = this.getRSSFeedsForCountry(country);
      const allDeals = await Promise.all(
        feeds.map(async (feedUrl) => {
          try {
            const feed = await this.rssParser.parseURL(feedUrl);
            return feed.items
              .filter(item => this.matchesCategory(item, category))
              .filter(item => !specific || this.matchesSpecific(item, specific))
              .map(item => this.convertRSSItemToDeal(item, country));
          } catch (error) {
            this.logger.warn(`RSS feed error for ${feedUrl}:`, error);
            return [];
          }
        })
      );
      return allDeals.flat();
    } catch (error) {
      this.logger.warn('RSS deals error:', error);
      return [];
    }
  }

  private async getRetailDeals(
    country: string,
    category: string,
    specific?: string,
  ): Promise<any[]> {
    try {
      // Example implementation using RetailMeNot-like API
      const retailEndpoints = this.getRetailEndpointsForCountry(country);
      const allDeals = await Promise.all(
        retailEndpoints.map(async (endpoint) => {
          try {
            const response = await axios.get(endpoint);
            return response.data.deals
              .filter(deal => this.matchesCategory(deal, category))
              .filter(deal => !specific || this.matchesSpecific(deal, specific))
              .map(deal => this.convertRetailDealToDeal(deal, country));
          } catch (error) {
            this.logger.warn(`Retail API error for ${endpoint}:`, error);
            return [];
          }
        })
      );
      return allDeals.flat();
    } catch (error) {
      this.logger.warn('Retail deals error:', error);
      return [];
    }
  }

  private async scrapeRetailerWebsites(
    country: string,
    category: string,
    specific?: string,
  ): Promise<any[]> {
    try {
      const retailers = this.getRetailersForCountry(country, category);
      const allDeals = await Promise.all(
        retailers.map(async (retailer) => {
          try {
            const response = await axios.get(retailer.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            const $ = cheerio.load(response.data);
            return this.extractDealsFromHtml($, retailer, country, category, specific);
          } catch (error) {
            this.logger.warn(`Scraping error for ${retailer.name}:`, error);
            return [];
          }
        })
      );
      return allDeals.flat();
    } catch (error) {
      this.logger.warn('Scraping error:', error);
      return [];
    }
  }

  private getRetailersForCountry(country: string, category: string): any[] {
    const retailers = {
      'germany': [
        {
          name: 'Adidas',
          url: 'https://www.adidas.de/en/outlet',
          selectors: {
            items: '.gl-product-card',
            title: '.gl-product-card__name',
            price: '.gl-price-item:not(.gl-price-item--crossed)',
            originalPrice: '.gl-price-item--crossed',
            description: '.gl-product-card__description',
            link: 'a.gl-product-card__media-link',
            promoCode: '.promotion-code',
            size: '.gl-product-card__size',
            color: '.gl-product-card__color',
            badge: '.badge-text',
          },
          baseUrl: 'https://www.adidas.de',
        },
        {
          name: 'Nike',
          url: 'https://www.nike.com/de/w/sale-3yaep',
          selectors: {
            items: '.product-card__body',
            title: '.product-card__title',
            price: '.product-price__sales',
            originalPrice: '.product-price__retail',
            description: '.product-card__subtitle',
            link: 'a.product-card__link-overlay',
            promoCode: '.promo-code',
            size: '.available-sizes',
            color: '.product-card__color',
            badge: '.product-card__badge',
          },
          baseUrl: 'https://www.nike.com',
        },
        {
          name: 'Zalando',
          url: 'https://www.zalando.de/outlet/',
          selectors: {
            items: 'article[data-card]',
            title: '[data-testid="product-name"]',
            price: '[data-testid="price"]',
            originalPrice: '[data-testid="original-price"]',
            description: '[data-testid="product-description"]',
            link: 'a[data-testid="product-link"]',
            promoCode: '[data-testid="promotion-code"]',
            size: '[data-testid="size"]',
            brand: '[data-testid="brand-name"]',
          },
          baseUrl: 'https://www.zalando.de',
        },
        {
          name: 'SportScheck',
          url: 'https://www.sportscheck.com/sale/',
          selectors: {
            items: '.product-tile',
            title: '.product-tile__title',
            price: '.price__amount--reduced',
            originalPrice: '.price__amount--original',
            description: '.product-tile__subtitle',
            link: 'a.product-tile__link',
            promoCode: '.voucher-code',
            brand: '.product-tile__brand',
          },
          baseUrl: 'https://www.sportscheck.com',
        },
        {
          name: 'Foot Locker DE',
          url: 'https://www.footlocker.de/en/sale',
          selectors: {
            items: '.ProductCard',
            title: '.ProductName',
            price: '.ProductPrice',
            originalPrice: '.ProductPrice--original',
            description: '.ProductDescription',
            link: 'a.ProductCard-link',
            promoCode: '.PromoCode',
            size: '.ProductSize',
          },
          baseUrl: 'https://www.footlocker.de',
        },
        {
          name: 'JD Sports DE',
          url: 'https://www.jdsports.de/sale/',
          selectors: {
            items: '.productListItem',
            title: '.itemTitle',
            price: '.itemPrice',
            originalPrice: '.was',
            description: '.itemDescription',
            link: 'a.itemImage',
            promoCode: '.promoCode',
            size: '.availableSizes',
          },
          baseUrl: 'https://www.jdsports.de',
        },
      ],
      // Add more countries here
    };

    return retailers[country.toLowerCase()] || [];
  }

  private extractDealsFromHtml($: any, retailer: any, country: string, category: string, specific?: string): any[] {
    const deals: any[] = [];
    
    $(retailer.selectors.items).each((i: number, elem: any) => {
      const $item = $(elem);
      const title = $item.find(retailer.selectors.title).text().trim();
      
      // Skip if specific term provided and not found in title
      if (specific && !title.toLowerCase().includes(specific.toLowerCase())) {
        return;
      }

      const originalPrice = $item.find(retailer.selectors.originalPrice).text().trim();
      const currentPrice = $item.find(retailer.selectors.price).text().trim();
      const description = $item.find(retailer.selectors.description).text().trim();
      const relativeLink = $item.find(retailer.selectors.link).attr('href');
      const promoCode = $item.find(retailer.selectors.promoCode).text().trim();
      const size = $item.find(retailer.selectors.size).text().trim();
      const color = $item.find(retailer.selectors.color).text().trim();
      const brand = $item.find(retailer.selectors.brand).text().trim();
      const badge = $item.find(retailer.selectors.badge).text().trim();
      
      const url = relativeLink?.startsWith('http') 
        ? relativeLink 
        : `${retailer.baseUrl}${relativeLink}`;

      // Extract prices and calculate discount
      const priceMatch = (price: string) => {
        const match = price.match(/[\d,.]+/);
        return match ? parseFloat(match[0].replace(',', '.')) : null;
      };

      const origPrice = priceMatch(originalPrice);
      const currPrice = priceMatch(currentPrice);
      const discountPercentage = origPrice && currPrice
        ? Math.round(((origPrice - currPrice) / origPrice) * 100)
        : undefined;

      // Only include deals with actual discounts
      if (!origPrice || !currPrice || origPrice <= currPrice) {
        return;
      }

      deals.push({
        title,
        description: description || `${title} on sale at ${retailer.name}`,
        url,
        location: {
          country,
          city: this.extractCity(description) || undefined,
        },
        venue: {
          name: retailer.name,
          type: category,
          brand: brand || undefined,
        },
        dealDetails: {
          originalPrice: origPrice?.toString(),
          discountedPrice: currPrice?.toString(),
          discountPercentage,
          promoCode: promoCode || undefined,
          dealType: this.identifyDealType(`${title} ${description} ${badge}`),
          terms: [],
          availability: size ? `Available sizes: ${size}` : undefined,
          color: color || undefined,
          badge: badge || undefined,
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          source: retailer.name,
          verified: true,
          popularity: this.calculateScrapedDealPopularity(discountPercentage, !!promoCode, !!badge),
        },
      });
    });

    return deals;
  }

  private calculateScrapedDealPopularity(discount?: number, hasPromo?: boolean, hasBadge?: boolean): number {
    let score = 50; // Base score
    if (discount) {
      if (discount >= 50) score += 30;
      else if (discount >= 30) score += 20;
      else if (discount >= 20) score += 10;
    }
    if (hasPromo) score += 10;
    if (hasBadge) score += 10;
    return Math.min(score, 100);
  }

  private getRSSFeedsForCountry(country: string): string[] {
    // Map countries to their respective deal RSS feeds
    const feedMap: { [key: string]: string[] } = {
      'germany': [
        'https://www.mydealz.de/rss/alle',
        'https://www.pepper.de/rss/alle',
      ],
      'united kingdom': [
        'https://www.hotukdeals.com/rss/all',
      ],
      'france': [
        'https://www.dealabs.com/rss/all',
      ],
      // Add more countries and their feeds
    };
    return feedMap[country.toLowerCase()] || [];
  }

  private getRetailEndpointsForCountry(country: string): string[] {
    // Map countries to their respective retail API endpoints
    const endpointMap: { [key: string]: string[] } = {
      'germany': [
        'https://api.retailmenot.com/v1/deals?country=de',
        'https://api.dealsplus.com/v1/deals?country=de',
      ],
      'united kingdom': [
        'https://api.retailmenot.com/v1/deals?country=uk',
      ],
      // Add more countries and endpoints
    };
    return endpointMap[country.toLowerCase()] || [];
  }

  private matchesCategory(item: any, category: string): boolean {
    const itemCategories = [
      item.category,
      item.tags,
      item.description,
      item.title,
    ].filter(Boolean).join(' ').toLowerCase();
    return itemCategories.includes(category.toLowerCase());
  }

  private matchesSpecific(item: any, specific: string): boolean {
    const itemContent = [
      item.title,
      item.description,
      item.content,
    ].filter(Boolean).join(' ').toLowerCase();
    return itemContent.includes(specific.toLowerCase());
  }

  private convertRSSItemToDeal(item: any, country: string): any {
    return {
      title: item.title,
      description: item.contentSnippet || item.description,
      url: item.link,
      location: {
        country: country,
      },
      dealDetails: {
        startDate: item.isoDate,
        terms: this.extractTerms(item.content || ''),
      },
      metadata: {
        lastUpdated: item.isoDate || new Date().toISOString(),
        source: new URL(item.link).hostname,
        verified: true, // RSS feeds are typically community-verified
        popularity: this.calculatePopularityScore(item),
      },
    };
  }

  private convertRetailDealToDeal(deal: any, country: string): any {
    return {
      title: deal.title,
      description: deal.description,
      url: deal.url,
      location: {
        country: country,
        address: deal.store?.address,
        city: deal.store?.city,
      },
      venue: {
        name: deal.store?.name,
        type: deal.category,
      },
      dealDetails: {
        startDate: deal.startDate,
        endDate: deal.endDate,
        terms: deal.terms,
        promoCode: deal.code,
        dealType: this.mapRetailDealType(deal.type),
      },
      metadata: {
        lastUpdated: deal.lastUpdated || new Date().toISOString(),
        source: deal.store?.name,
        verified: deal.verified,
        popularity: deal.popularity || 50,
      },
    };
  }

  private mapRetailDealType(type: string): 'promo_code' | 'bundle' | 'sale' | 'flash_deal' | 'seasonal' | 'standard' {
    const typeMap: { [key: string]: any } = {
      'coupon': 'promo_code',
      'code': 'promo_code',
      'bundle': 'bundle',
      'sale': 'sale',
      'flash': 'flash_deal',
      'seasonal': 'seasonal',
    };
    return typeMap[type?.toLowerCase()] || 'standard';
  }

  private mergeDeals(deals: any[]): any[] {
    // Remove duplicates based on URL and title similarity
    const uniqueDeals = new Map();
    deals.forEach(deal => {
      const key = deal.url || deal.title;
      if (!uniqueDeals.has(key)) {
        uniqueDeals.set(key, deal);
      }
    });
    return Array.from(uniqueDeals.values());
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
      const coordinates = await this.getCoordinates(city, country);
      
      const deal: Deal = {
        title: result.title,
        description: result.snippet,
        url: result.link,
        location: {
          country: country,
          address: this.extractAddress(result.snippet),
          city: city,
          coordinates: coordinates,
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
      // Comprehensive mapping of major cities and their coordinates
      const cityCoordinates: { [key: string]: { latitude: number; longitude: number } } = {
        // Germany
        'berlin': { latitude: 52.5200, longitude: 13.4050 },
        'munich': { latitude: 48.1351, longitude: 11.5820 },
        'hamburg': { latitude: 53.5511, longitude: 9.9937 },
        'frankfurt': { latitude: 50.1109, longitude: 8.6821 },
        'cologne': { latitude: 50.9375, longitude: 6.9603 },
        'stuttgart': { latitude: 48.7758, longitude: 9.1829 },
        'dusseldorf': { latitude: 51.2277, longitude: 6.7735 },
        'dortmund': { latitude: 51.5136, longitude: 7.4653 },
        'essen': { latitude: 51.4556, longitude: 7.0116 },
        'leipzig': { latitude: 51.3397, longitude: 12.3731 },
        'bremen': { latitude: 53.0793, longitude: 8.8017 },
        'dresden': { latitude: 51.0504, longitude: 13.7373 },
        'hannover': { latitude: 52.3759, longitude: 9.7320 },
        'nuremberg': { latitude: 49.4521, longitude: 11.0767 },
        'duisburg': { latitude: 51.4344, longitude: 6.7623 },
        'bochum': { latitude: 51.4818, longitude: 7.2162 },
        'wuppertal': { latitude: 51.2562, longitude: 7.1508 },
        'bielefeld': { latitude: 52.0302, longitude: 8.5325 },
        'bonn': { latitude: 50.7374, longitude: 7.0982 },
        'munster': { latitude: 51.9607, longitude: 7.6261 },
        'karlsruhe': { latitude: 49.0069, longitude: 8.4037 },
        'mannheim': { latitude: 49.4875, longitude: 8.4660 },
        'augsburg': { latitude: 48.3705, longitude: 10.8978 },
        'wiesbaden': { latitude: 50.0782, longitude: 8.2398 },
        'metzingen': { latitude: 48.5373, longitude: 9.2852 },
        'gelsenkirchen': { latitude: 51.5179, longitude: 7.0854 },
        
        // Add more cities as needed for other countries
      };

      const normalizedCity = city?.toLowerCase().trim();
      const normalizedCountry = country?.toLowerCase().trim();

      // If we have exact coordinates for the city
      if (normalizedCity && cityCoordinates[normalizedCity]) {
        return cityCoordinates[normalizedCity];
      }

      // For German cities not in our database, provide approximate coordinates for Germany
      if (normalizedCountry === 'germany' && !cityCoordinates[normalizedCity]) {
        return { latitude: 51.1657, longitude: 10.4515 }; // Center of Germany
      }

      this.logger.debug(`Coordinates not found for ${city}, ${country}`);
      return undefined;
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
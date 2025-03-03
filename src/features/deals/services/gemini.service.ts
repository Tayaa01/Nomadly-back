import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { Deal, DealAnalysis } from '../interfaces/deal.interface';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async analyzeDeals(data: { deals: Deal[] } & Record<string, any>, category: string): Promise<DealAnalysis> {
    try {
      this.logger.debug('Analyzing deals with Gemini');
      
      if (!Array.isArray(data.deals) || data.deals.length === 0) {
        this.logger.warn('No deals to analyze');
        return this.generateFallbackAnalysis([]);
      }

      const prompt = this.buildAnalysisPrompt(data.deals, category);
      
      const result = await this.model.generateContent({
        contents: [{
          parts: [{ text: prompt }]
        }]
      });
      
      const response = await result.response;
      const text = response.text();
      
      this.logger.debug('Received response from Gemini');
      return this.parseGeminiResponse(text, data.deals);
    } catch (error) {
      this.logger.error('Gemini analysis error:', error);
      return this.generateFallbackAnalysis(data.deals || []);
    }
  }

  private buildAnalysisPrompt(deals: Deal[], category: string): string {
    const dealsJson = deals.map(deal => ({
      title: deal.title,
      description: deal.description,
      price: deal.price,
      retailer: deal.retailer.name,
      location: deal.location?.city,
    }));

    return `
      You are a deals and savings expert. Analyze these ${category} deals and create a structured response.
      
      Deals to analyze:
      ${JSON.stringify(dealsJson, null, 2)}

      Provide a response in this exact format:
      RECOMMENDATIONS:
      1. [Deal title] from [Retailer]
      - Price: [Price details]
      - Why: [Reason for recommendation]

      2. [Next best deal]
      ...

      SAVINGS TIPS:
      * [Specific tip for ${category}]
      * [General saving tip]
      * [Another relevant tip]

      REASONS:
      * [Reason why these deals are good]
      * [Market insight]
      * [Timing or availability insight]

      Keep recommendations factual and based on the actual deals provided.
      Focus on real savings and value for money.
      Provide specific tips for ${category} shopping.
    `;
  }

  private parseGeminiResponse(response: string, originalDeals: Deal[]): DealAnalysis {
    try {
      const sections = response.split('\n\n');
      const recommendations: Deal[] = [];
      const discounts: string[] = [];
      const reasons: string[] = [];
      const savingsTips: string[] = [];

      let currentSection = '';
      for (const section of sections) {
        if (section.trim().startsWith('RECOMMENDATIONS:')) {
          currentSection = 'recommendations';
          continue;
        } else if (section.trim().startsWith('SAVINGS TIPS:')) {
          currentSection = 'tips';
          continue;
        } else if (section.trim().startsWith('REASONS:')) {
          currentSection = 'reasons';
          continue;
        }

        switch (currentSection) {
          case 'recommendations':
            const dealMatch = section.match(/\d+\.\s+(.*?)\s+from\s+(.*?)\n/);
            if (dealMatch) {
              const title = dealMatch[1];
              const retailer = dealMatch[2];
              const originalDeal = originalDeals.find(d => 
                d.title.includes(title) || d.retailer.name.includes(retailer)
              );
              if (originalDeal) {
                recommendations.push(originalDeal);
                if (originalDeal.price?.discountPercentage) {
                  discounts.push(`${originalDeal.price.discountPercentage}% off at ${retailer}`);
                }
              }
            }
            break;
          case 'tips':
            if (section.trim().startsWith('*')) {
              savingsTips.push(section.trim().replace('* ', ''));
            }
            break;
          case 'reasons':
            if (section.trim().startsWith('*')) {
              reasons.push(section.trim().replace('* ', ''));
            }
            break;
        }
      }

      // Get category and country from first recommendation if available
      const firstDeal = originalDeals[0] || {
        category: 'general',
        location: { country: 'unknown' }
      } as Deal;
      const category = firstDeal.category || 'general';
      const country = firstDeal.location?.country || 'unknown';

      return {
        recommendations: recommendations.length > 0 ? recommendations : originalDeals.slice(0, 3),
        discounts: discounts.length > 0 ? discounts : this.extractDiscounts(originalDeals),
        reasons: reasons.length > 0 ? reasons : this.generateDefaultReasons(originalDeals),
        savingsTips: savingsTips.length > 0 ? savingsTips : this.generateDefaultTips(),
        metadata: {
          timestamp: new Date().toISOString(),
          category,
          country,
          resultsCount: originalDeals.length,
          averageDiscount: this.calculateAverageDiscount(originalDeals),
          nearbyStores: this.countNearbyStores(originalDeals),
        },
      };
    } catch (error) {
      this.logger.error('Error parsing Gemini response:', error);
      return this.generateFallbackAnalysis(originalDeals);
    }
  }

  private generateFallbackAnalysis(deals: Deal[]): DealAnalysis {
    // Get category and country from first deal if available
    const firstDeal = deals[0] || {
      category: 'general',
      location: { country: 'unknown' }
    } as Deal;
    const category = firstDeal.category || 'general';
    const country = firstDeal.location?.country || 'unknown';

    return {
      recommendations: deals.slice(0, 3),
      discounts: this.extractDiscounts(deals),
      reasons: this.generateDefaultReasons(deals),
      savingsTips: this.generateDefaultTips(),
      metadata: {
        timestamp: new Date().toISOString(),
        category,
        country,
        resultsCount: deals.length,
        averageDiscount: this.calculateAverageDiscount(deals),
        nearbyStores: this.countNearbyStores(deals),
      },
    };
  }

  private extractDiscounts(deals: Deal[]): string[] {
    return deals
      .filter(deal => deal.price?.discountPercentage)
      .map(deal => `${deal.price!.discountPercentage}% off at ${deal.retailer.name}`)
      .slice(0, 5);
  }

  private calculateAverageDiscount(deals: Deal[]): number {
    const discounts = deals
      .map(deal => deal.price?.discountPercentage || 0)
      .filter(discount => discount > 0);
    
    if (discounts.length === 0) return 0;
    return Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length);
  }

  private generateDefaultReasons(deals: Deal[]): string[] {
    const avgDiscount = this.calculateAverageDiscount(deals);
    return [
      `Average savings of ${avgDiscount}% across available deals`,
      'Multiple trusted retailers offering competitive prices',
      'Limited time offers available now',
    ];
  }

  private generateDefaultTips(): string[] {
    return [
      'Compare prices across different retailers',
      'Check for additional cashback or reward points',
      'Sign up for retailer newsletters for exclusive discounts',
      'Consider bulk purchases for better value',
      'Look for seasonal sales and special events',
    ];
  }

  private countNearbyStores(deals: Deal[]): number {
    return deals.filter(deal => deal.location?.coordinates).length;
  }
} 
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Deal, DealAnalysis } from '../interfaces/deal.interface';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async analyzeDeals(searchResults: any, category: string): Promise<DealAnalysis> {
    try {
      this.logger.debug('Analyzing deals with Gemini');
      const prompt = this.buildAnalysisPrompt(searchResults, category);
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const response = await result.response;
      const text = response.text();
      this.logger.debug('Received response from Gemini');

      return this.parseGeminiResponse(text, searchResults);
    } catch (error) {
      this.logger.error('Gemini analysis error:', error);
      return this.generateFallbackAnalysis(searchResults);
    }
  }

  private buildAnalysisPrompt(searchResults: any, category: string): string {
    const deals = searchResults.organic.map((deal: Deal) => ({
      title: deal.title,
      description: deal.description,
      venue: deal.venue,
      location: deal.location,
      dealDetails: deal.dealDetails,
    }));

    return `
      As a deals and discounts expert, analyze these ${category} deals and provide a detailed, user-friendly report.
      Focus on practical, actionable information that shoppers can use immediately.
      
      Deals Data:
      ${JSON.stringify(deals, null, 2)}

      Please provide a structured analysis in this exact format:

      TOP RECOMMENDATIONS:
      For each of the best 5 deals:
      - Store/Venue: [Name]
      - Location: [Full address with coordinates if available]
      - Deal Type: [Promo code/Sale/Bundle/etc.]
      - Discount Details: [Specific discount amount/percentage]
      - Promo Code: [If applicable]
      - Valid Until: [End date if available]
      - Why It's Great: [2-3 specific reasons]
      - Pro Tips: [How to best use this deal]

      SAVINGS BREAKDOWN:
      - Average Discount: [%]
      - Best Value Deal: [Name + Why]
      - Price Range Analysis: [Min-Max prices found]
      - Special Conditions: [Any requirements or restrictions]

      LOCATION INSIGHTS:
      - Popular Areas: [List with deal counts]
      - Transportation Tips: [How to get to major deal locations]
      - Area-Specific Deals: [Any location-based promotions]

      SMART SHOPPING GUIDE:
      1. Best Times to Shop: [Specific days/hours]
      2. Loyalty Programs: [Available programs and benefits]
      3. Stacking Strategies: [How to combine deals]
      4. Hidden Savings: [Lesser-known ways to save]
      5. Red Flags: [What to watch out for]

      TRENDING PATTERNS:
      - Most Popular Categories: [List with percentages]
      - Emerging Deals: [New trends]
      - Seasonal Opportunities: [Upcoming sales/events]

      Format the response to be easily readable and actionable.
      Include specific numbers, dates, and instructions whenever possible.
      Focus on verified deals and include any available promo codes.
    `;
  }

  private parseGeminiResponse(response: string, originalResults: any): DealAnalysis {
    try {
      const sections = response.split('\n\n');
      const deals = originalResults.organic || [];
      
      const analysis: DealAnalysis = {
        recommendations: [],
        discounts: [],
        reasons: [],
        savingsTips: [],
        trending: {
          categories: [],
          venues: [],
          locations: [],
        },
        statistics: {
          averageDiscount: this.calculateAverageDiscount(deals),
          totalDeals: deals.length,
          bestValue: {
            deal: this.findBestValueDeal(deals),
            reason: 'Highest combined discount and rating score',
          },
        },
      };

      // Parse each section
      sections.forEach(section => {
        if (section.includes('TOP RECOMMENDATIONS')) {
          analysis.recommendations = this.extractDetailedRecommendations(section, deals);
        } else if (section.includes('SAVINGS BREAKDOWN')) {
          analysis.discounts = this.extractSavingsBreakdown(section);
        } else if (section.includes('SMART SHOPPING GUIDE')) {
          analysis.savingsTips = this.extractSmartShoppingTips(section);
        } else if (section.includes('TRENDING PATTERNS')) {
          analysis.trending = this.extractDetailedTrends(section);
        }
      });

      // Ensure we have recommendations
      if (analysis.recommendations.length === 0) {
        analysis.recommendations = this.getTopDeals(deals, 5);
      }

      return analysis;
    } catch (error) {
      this.logger.error('Error parsing Gemini response:', error);
      return this.generateFallbackAnalysis(originalResults);
    }
  }

  private extractDetailedRecommendations(section: string, originalDeals: Deal[]): Deal[] {
    const recommendations: Deal[] = [];
    const dealBlocks = section.split(/\d+\./g).filter(block => block.trim());

    dealBlocks.forEach(block => {
      const lines = block.split('\n').map(line => line.trim());
      const dealInfo: any = {};

      lines.forEach(line => {
        if (line.startsWith('Store/Venue:')) dealInfo.venueName = line.split(':')[1].trim();
        if (line.startsWith('Location:')) dealInfo.location = line.split(':')[1].trim();
        if (line.startsWith('Deal Type:')) dealInfo.dealType = line.split(':')[1].trim();
        if (line.startsWith('Discount Details:')) dealInfo.discount = line.split(':')[1].trim();
        if (line.startsWith('Promo Code:')) dealInfo.promoCode = line.split(':')[1].trim();
        if (line.startsWith('Valid Until:')) dealInfo.endDate = line.split(':')[1].trim();
      });

      // Find matching original deal
      const matchingDeal = originalDeals.find(d => 
        d.venue?.name?.toLowerCase().includes(dealInfo.venueName?.toLowerCase()) ||
        dealInfo.venueName?.toLowerCase().includes(d.venue?.name?.toLowerCase())
      );

      if (matchingDeal) {
        const enrichedDeal = {
          ...matchingDeal,
          dealDetails: {
            ...matchingDeal.dealDetails,
            promoCode: dealInfo.promoCode,
            dealType: dealInfo.dealType,
            endDate: dealInfo.endDate || matchingDeal.dealDetails.endDate,
          },
        };
        recommendations.push(enrichedDeal);
      }
    });

    return recommendations;
  }

  private extractSavingsBreakdown(section: string): string[] {
    return section
      .split('\n')
      .filter(line => line.includes(':'))
      .map(line => line.trim());
  }

  private extractSmartShoppingTips(section: string): string[] {
    return section
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }

  private extractDetailedTrends(section: string): {
    categories: string[];
    venues: string[];
    locations: string[];
  } {
    const trends = {
      categories: [],
      venues: [],
      locations: [],
    };

    const lines = section.split('\n');
    let currentCategory: keyof typeof trends | null = null;

    lines.forEach(line => {
      if (line.includes('Most Popular Categories:')) currentCategory = 'categories';
      else if (line.includes('Popular Venues:')) currentCategory = 'venues';
      else if (line.includes('Popular Areas:')) currentCategory = 'locations';
      else if (currentCategory && line.startsWith('-')) {
        trends[currentCategory].push(line.substring(1).trim());
      }
    });

    return trends;
  }

  private calculateAverageDiscount(deals: Deal[]): number {
    const discounts = deals
      .map(deal => deal.dealDetails?.discountPercentage)
      .filter(discount => discount !== undefined) as number[];
    
    return discounts.length > 0
      ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
      : 0;
  }

  private findBestValueDeal(deals: Deal[]): Deal {
    return deals.reduce((best, current) => {
      const currentScore = this.calculateDealScore(current);
      const bestScore = this.calculateDealScore(best);
      return currentScore > bestScore ? current : best;
    }, deals[0]);
  }

  private calculateDealScore(deal: Deal): number {
    let score = 0;
    if (deal.dealDetails?.discountPercentage) score += deal.dealDetails.discountPercentage;
    if (deal.venue?.rating) score += deal.venue.rating * 10;
    if (deal.metadata?.verified) score += 20;
    if (deal.metadata?.popularity) score += deal.metadata.popularity * 0.5;
    return score;
  }

  private getTopDeals(deals: Deal[], count: number): Deal[] {
    return deals
      .sort((a, b) => this.calculateDealScore(b) - this.calculateDealScore(a))
      .slice(0, count);
  }

  private generateFallbackAnalysis(results: any): DealAnalysis {
    const deals = results.organic || [];
    return {
      recommendations: this.getTopDeals(deals, 5),
      discounts: [],
      reasons: ['Based on available deal data'],
      savingsTips: [
        'Compare prices across different platforms',
        'Sign up for newsletters to receive exclusive discounts',
        'Check for seasonal sales and special events',
        'Look for combo deals or package offers',
        'Consider loyalty programs for additional savings',
      ],
      trending: {
        categories: [],
        venues: [],
        locations: [],
      },
      statistics: {
        averageDiscount: this.calculateAverageDiscount(deals),
        totalDeals: deals.length,
        bestValue: {
          deal: this.findBestValueDeal(deals),
          reason: 'Highest combined discount and rating score',
        },
      },
    };
  }
} 
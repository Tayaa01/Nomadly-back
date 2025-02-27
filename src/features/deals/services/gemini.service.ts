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
      // Return fallback analysis instead of throwing an error
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
      As a deals and discounts expert, analyze these ${category} deals and create a comprehensive report.
      
      Deals Data:
      ${JSON.stringify(deals, null, 2)}

      Please provide a structured analysis in the following format:

      1. Top Recommendations:
      - List the best 5 deals with their venue names, locations, and specific discounts
      - Include why each deal is recommended
      - Highlight any time-sensitive offers

      2. Value Analysis:
      - Calculate average discount percentage
      - Identify the best value deal
      - Note any unusual or standout offers

      3. Location Insights:
      - Group deals by city/area
      - Identify areas with highest concentration of deals
      - Note any location-specific trends

      4. Venue Analysis:
      - List top-rated venues
      - Identify common venue types
      - Note any chain vs. independent business patterns

      5. Smart Shopping Tips:
      - Provide category-specific saving strategies
      - Note best times/days for deals
      - Mention any loyalty programs or special conditions

      6. Trending Patterns:
      - Identify popular deal types
      - Note emerging trends
      - Highlight seasonal patterns

      Format the response to be easily parsed into sections.
      Focus on concrete details and specific numbers when available.
    `;
  }

  private parseGeminiResponse(response: string, originalResults: any): DealAnalysis {
    try {
      const sections = response.split('\n\n');
      const deals = originalResults.organic || [];
      
      // Initialize analysis object
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
            reason: 'Highest discount percentage with verified source',
          },
        },
      };

      // Parse each section
      sections.forEach(section => {
        if (section.includes('Top Recommendations')) {
          analysis.recommendations = this.extractRecommendations(section, deals);
        } else if (section.includes('Smart Shopping Tips')) {
          analysis.savingsTips = this.extractSavingsTips(section);
        } else if (section.includes('Trending Patterns')) {
          analysis.trending = this.extractTrends(section);
        }
      });

      // If we don't have enough recommendations, add from original results
      if (analysis.recommendations.length < 5) {
        analysis.recommendations.push(...this.getTopDeals(deals, 5 - analysis.recommendations.length));
      }

      return analysis;
    } catch (error) {
      this.logger.error('Error parsing Gemini response:', error);
      return this.generateFallbackAnalysis(originalResults);
    }
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

  private extractRecommendations(section: string, originalDeals: Deal[]): Deal[] {
    const recommendations: Deal[] = [];
    const lines = section.split('\n');
    let currentDeal: Partial<Deal> = {};

    lines.forEach(line => {
      if (line.startsWith('-')) {
        const text = line.substring(1).trim();
        if (text.includes('Venue:')) {
          currentDeal.venue = { name: text.split('Venue:')[1].trim(), type: '' };
        } else if (text.includes('Discount:')) {
          currentDeal.dealDetails = {
            discountedPrice: text.split('Discount:')[1].trim(),
          };
        } else if (text.includes('Location:')) {
          currentDeal.location = {
            address: text.split('Location:')[1].trim(),
            country: originalDeals[0]?.location?.country || '',
          };
        }
      } else if (Object.keys(currentDeal).length > 0) {
        // Find matching original deal
        const matchingDeal = originalDeals.find(
          d => d.venue?.name === currentDeal.venue?.name
        );
        if (matchingDeal) {
          recommendations.push({
            ...matchingDeal,
            ...currentDeal as Deal,
          });
        }
        currentDeal = {};
      }
    });

    return recommendations;
  }

  private extractSavingsTips(section: string): string[] {
    return section
      .split('\n')
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  }

  private extractTrends(section: string): {
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
      if (line.includes('Popular Categories:')) currentCategory = 'categories';
      else if (line.includes('Popular Venues:')) currentCategory = 'venues';
      else if (line.includes('Popular Locations:')) currentCategory = 'locations';
      else if (currentCategory && line.startsWith('-')) {
        trends[currentCategory].push(line.substring(1).trim());
      }
    });

    return trends;
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
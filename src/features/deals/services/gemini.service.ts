import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Deal } from '../interfaces/deal.interface';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI('AIzaSyDGJblFh6oMUcJn4ivsJcv5Rl5jenuM2ts');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async analyzeDeals(searchResults: { deals: Deal[] } & Record<string, any>, category: string): Promise<any> {
    try {
      this.logger.debug(`Analyzing ${searchResults.deals.length} deals with Gemini for ${category}`);
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
      throw new HttpException(
        `Failed to analyze deals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildAnalysisPrompt(searchResults: { deals: Deal[] } & Record<string, any>, category: string): string {
    const { deals, country = 'global' } = searchResults;
    const currentDate = new Date().toISOString();

    // Category-specific analysis criteria
    const categoryAnalysis = {
      travel: {
        priorities: ['price comparison', 'booking flexibility', 'cancellation policy', 'seasonal timing'],
        valueMetrics: ['price per distance', 'comfort level', 'travel time', 'flexibility'],
        redFlags: ['hidden fees', 'strict cancellation', 'multiple stops', 'long layovers']
      },
      groceries: {
        priorities: ['bulk savings', 'freshness guarantee', 'price per unit', 'store location'],
        valueMetrics: ['price comparison', 'quantity', 'quality', 'expiration dates'],
        redFlags: ['limited stock', 'store-specific deals', 'membership required', 'bulk only']
      },
      restaurants: {
        priorities: ['value for money', 'menu variety', 'timing restrictions', 'location'],
        valueMetrics: ['discount percentage', 'included items', 'reservation requirements', 'group size'],
        redFlags: ['limited menu', 'specific times only', 'minimum spend', 'excluded items']
      },
      fashion: {
        priorities: ['size availability', 'return policy', 'seasonal relevance', 'brand authenticity'],
        valueMetrics: ['original price comparison', 'material quality', 'brand value', 'style longevity'],
        redFlags: ['final sale', 'limited sizes', 'past season', 'irregular items']
      },
      electronics: {
        priorities: ['warranty coverage', 'authenticity', 'model year', 'specs comparison'],
        valueMetrics: ['price history', 'features included', 'support period', 'accessories'],
        redFlags: ['refurbished', 'international model', 'no warranty', 'older model']
      }
    };

    const analysis = categoryAnalysis[category.toLowerCase()] || {
      priorities: ['value', 'reliability', 'availability', 'terms'],
      valueMetrics: ['price', 'quality', 'convenience', 'support'],
      redFlags: ['restrictions', 'limitations', 'exclusions', 'conditions']
    };

    return `
      You are an expert ${category} deals analyst. Analyze these ${deals.length} deals from ${country} as of ${currentDate}.
      
      ANALYSIS PRIORITIES:
      ${analysis.priorities.map(p => `- ${p}`).join('\n')}
      
      VALUE METRICS:
      ${analysis.valueMetrics.map(m => `- ${m}`).join('\n')}
      
      RED FLAGS TO CHECK:
      ${analysis.redFlags.map(f => `- ${f}`).join('\n')}

      DEALS TO ANALYZE:
      ${JSON.stringify(deals.map(d => ({
        title: d.title,
        description: d.description,
        price: d.price,
        retailer: d.retailer,
        url: d.url,
        promoCode: d.promoCode,
        location: d.location,
        validUntil: d.validUntil,
      })), null, 2)}

      REQUIRED ANALYSIS:
      1. Deal Quality Assessment:
         - Value proposition
         - Price competitiveness
         - Terms and conditions
         - Reliability and trust factors

      2. Comparative Analysis:
         - Market position
         - Historical pricing
         - Competitor offerings
         - Regional variations

      3. Practical Considerations:
         - Accessibility
         - Usage requirements
         - Time sensitivity
         - Additional costs

      4. User Recommendations:
         - Best use cases
         - Maximization strategies
         - Alternative options
         - Risk mitigation

      FORMAT RESPONSE AS:
      {
        "recommendations": [
          {
            "title": string,
            "description": string,
            "price": {
              "current": number,
              "original": number,
              "discountPercentage": number,
              "currency": string,
              "valueScore": number,
              "notes": string[]
            },
            "qualityMetrics": {
              "overallScore": number,
              "valueScore": number,
              "reliabilityScore": number,
              "convenienceScore": number,
              "reasons": string[]
            },
            "userGuide": {
              "bestFor": string[],
              "requirements": string[],
              "tips": string[],
              "warnings": string[]
            },
            "timing": {
              "bestTimeToUse": string,
              "expiryRisk": string,
              "urgencyLevel": string
            }
          }
        ],
        "marketInsights": {
          "trends": string[],
          "bestTimeToBook": string,
          "priceAnalysis": {
            "average": number,
            "range": { "low": number, "high": number },
            "seasonalFactors": string[]
          }
        },
        "savingsTips": {
          "general": string[],
          "advanced": string[],
          "categorySpecific": string[]
        }
      }

      SORTING CRITERIA (in order of importance):
      1. Value Score (price vs. market average)
      2. Reliability Score (retailer reputation)
      3. Convenience Score (accessibility)
      4. Time Sensitivity (urgency)
      5. Overall Quality Score

      CRITICAL RULES:
      1. Focus on practical value over raw discount
      2. Consider regional market differences
      3. Prioritize verified retailers
      4. Flag potential restrictions
      5. Include specific usage guidance
    `;
  }

  private parseGeminiResponse(response: string, originalResults: { deals: Deal[] } & Record<string, any>): any {
    try {
      const sections = response.split(/###\s+/).filter(Boolean);
      const recommendations: Deal[] = [];
      const savingsTips: string[] = [];
      let metadata: any = {
        timestamp: new Date().toISOString(),
        country: originalResults.country || 'global',
        category: originalResults.category || 'unknown',
        resultsCount: originalResults.deals.length,
      };

      for (const section of sections) {
        const title = section.split('\n')[0].trim();
        const content = section.replace(title, '').trim();

        if (title.includes('TOP DEAL PICKS')) {
          const dealBlocks = content.split(/\d+\.\s*\*\*/).filter(Boolean);
          for (const block of dealBlocks) {
            const rec = this.parseRecommendation(block, originalResults.deals, originalResults);
            if (rec) recommendations.push(rec);
          }
        } else if (title.includes('MONEY-SAVING HACKS')) {
          savingsTips.push(...content.split('\n- ').filter(Boolean).map(t => t.trim()));
        } else if (title.includes('QUICK STATS')) {
          metadata = { ...metadata, ...this.parseStats(content) };
        }
      }

      if (recommendations.length === 0) {
        recommendations.push(...this.extractFromOriginalResults(originalResults.deals.slice(0, 5)));
      }
      if (savingsTips.length === 0) savingsTips.push(...this.getDefaultSavingsTips(originalResults.category));

      return {
        recommendations,
        savingsTips,
        metadata,
      };
    } catch (error) {
      this.logger.error('Error parsing Gemini response:', error);
      return {
        recommendations: this.extractFromOriginalResults(originalResults.deals.slice(0, 5)),
        savingsTips: this.getDefaultSavingsTips(originalResults.category),
        metadata: {
          timestamp: new Date().toISOString(),
          country: originalResults.country || 'unknown',
          category: originalResults.category || 'unknown',
          resultsCount: originalResults.deals.length,
        },
      };
    }
  }

  private parseRecommendation(
    block: string,
    deals: Deal[],
    originalResults: { deals: Deal[] } & Record<string, any>
  ): Deal {
    const lines = block.split('\n').map(line => line.trim());
    const recommendation: any = { metadata: {} };
    let currentKey = '';

    for (const line of lines) {
      if (line.startsWith('**') && line.includes('** - *')) {
        const [titlePart, tagline] = line.split(' - *');
        recommendation.title = titlePart.replace(/\*\*/g, '').trim();
        recommendation.metadata.tagline = tagline.replace(/\*/g, '').trim();
      } else if (line.startsWith('**')) {
        currentKey = line.replace(/[*]/g, '').trim();
      } else if (line.startsWith('- ') && currentKey === "Why It's a Steal") {
        recommendation.metadata.reasons = recommendation.metadata.reasons || [];
        recommendation.metadata.reasons.push(line.slice(2).trim());
      } else if (line.includes(': ')) {
        const [key, value] = line.split(': ').map(part => part.trim());
        switch (key) {
          case 'Savings Alert':
            const matches = value.match(/\$(\d+\.?\d*).*\$(\d+\.?\d*).*(\d+)%/) || [];
            recommendation.price = {
              current: parseFloat(matches[1]) || null,
              original: parseFloat(matches[2]) || undefined,
              discountPercentage: parseInt(matches[3]) || undefined,
              currency: 'USD',
            };
            break;
          case 'The Scoop':
            recommendation.description = value;
            break;
          case 'Grab It Now':
            recommendation.metadata.instructions = value;
            break;
          case 'Promo Code':
            if (value !== 'None') {
              recommendation.promoCode = { code: value, description: 'Apply at checkout' };
            }
            break;
          case 'Hurry':
            recommendation.validUntil = value !== 'Limited time—move fast!' ? new Date(value) : undefined;
            break;
        }
      }
    }

    const matchingDeal: Deal | undefined = deals.find(d => d.title === recommendation.title);
    return {
      title: recommendation.title || matchingDeal?.title || 'Unnamed Deal',
      description: recommendation.description || matchingDeal?.description || 'Check this deal out!',
      url: matchingDeal?.url || '',
      price: recommendation.price || matchingDeal?.price || { current: null, currency: 'USD' },
      promoCode: recommendation.promoCode || matchingDeal?.promoCode,
      retailer: {
        name: matchingDeal?.retailer?.name || 'Unknown Retailer',
        rating: matchingDeal?.retailer?.rating,
      },
      category: matchingDeal?.category || originalResults.category || 'unknown',
      lastVerified: new Date(),
      source: matchingDeal?.source || 'Serper Google Search',
      location: matchingDeal?.location,
      metadata: {
        tagline: recommendation.metadata.tagline,
        reasons: recommendation.metadata.reasons || ['Worth a look', 'Potential savings'],
        instructions: recommendation.metadata.instructions || `Visit ${matchingDeal?.url || 'the retailer site'} and check for deals.`,
      },
    };
  }

  private parseStats(content: string): any {
    const stats: any = {};
    content.split('\n- ').filter(Boolean).forEach(line => {
      const [key, value] = line.split(': ').map(part => part.trim());
      if (key === 'Average Discount') stats.averageDiscount = parseFloat(value.replace('%', '')) || 0;
      if (key === 'Top Retailer') stats.topRetailer = value;
    });
    return stats;
  }

  private extractFromOriginalResults(deals: Deal[]): Deal[] {
    return deals.map(deal => ({
      title: deal.title || 'Unnamed Deal',
      description: deal.description || 'Explore this offer!',
      url: deal.url || '',
      price: deal.price || { current: null, currency: 'USD' },
      retailer: { name: deal.retailer?.name || 'Unknown Retailer' },
      category: deal.category || 'unknown',
      lastVerified: new Date(),
      source: deal.source || 'Fallback',
      metadata: {
        tagline: 'Hot Deal Alert!',
        reasons: ['Found in search', 'Could save you big', 'Check it out'],
        instructions: `Visit ${deal.url || 'the retailer'} and look for discounts.`,
      },
    }));
  }

  private getDefaultSavingsTips(category: string): string[] {
    return [
      `Scour X for ${category} flash sales—real-time goldmine!`,
      'Stack codes like a ninja—retailer sites hide extras.',
      `Book ${category} midweek for sneaky price drops!`,
      'Join loyalty clubs—unlock VIP savings.',
      'Set alerts—snag ${category} deals before they vanish!',
    ];
  }
}
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI('AIzaSyDGJblFh6oMUcJn4ivsJcv5Rl5jenuM2ts');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async analyzeDeals(searchResults: any, category: string): Promise<any> {
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
      throw new HttpException(
        `Failed to analyze deals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildAnalysisPrompt(searchResults: any, category: string): string {
    return `
      You are a deals and discounts expert. Analyze these search results for ${category} and create a structured list of the best deals.
      
      Search Results:
      ${JSON.stringify(searchResults.organic, null, 2)}

      Create a response in this exact format:
      1. [Deal Name]
      - Discount: [Discount details]
      - Description: [Brief description]
      - Reason: [Why this is recommended]

      2. [Deal Name]
      ...

      TIPS:
      * [Saving tip 1]
      * [Saving tip 2]
      ...

      Only include real deals found in the search results. Be specific about discounts and promotions.
    `;
  }

  private parseGeminiResponse(response: string, originalResults: any): any {
    try {
      const recommendations = [];
      const savingsTips = [];
      
      // Split response into sections
      const sections = response.split('\n\n');
      
      for (const section of sections) {
        if (section.trim().startsWith('*')) {
          // This is a saving tip
          savingsTips.push(section.trim().replace('* ', ''));
        } else if (/^\d+\./.test(section.trim())) {
          // This is a recommendation
          const lines = section.split('\n');
          const title = lines[0].replace(/^\d+\.\s*/, '').trim();
          let discount = '', description = '', reason = '';
          
          for (const line of lines.slice(1)) {
            if (line.includes('Discount:')) {
              discount = line.split('Discount:')[1].trim();
            } else if (line.includes('Description:')) {
              description = line.split('Description:')[1].trim();
            } else if (line.includes('Reason:')) {
              reason = line.split('Reason:')[1].trim();
            }
          }

          if (title) {
            recommendations.push({
              title,
              discount,
              description,
              reason,
            });
          }
        }
      }

      // If we still don't have recommendations, try to extract from original results
      if (recommendations.length === 0 && originalResults.organic) {
        recommendations.push(...this.extractFromOriginalResults(originalResults.organic));
      }

      return {
        recommendations,
        savingsTips: savingsTips.length > 0 ? savingsTips : this.getDefaultSavingsTips(originalResults),
        metadata: {
          timestamp: new Date().toISOString(),
          country: originalResults.country || 'france',
          category: originalResults.category || 'restaurants',
          resultsFound: originalResults.organic?.length || 0,
          searchType: originalResults.specific ? 'specific' : 'general'
        }
      };
    } catch (error) {
      this.logger.error('Error parsing response:', error);
      return {
        recommendations: this.extractFromOriginalResults(originalResults.organic),
        savingsTips: this.getDefaultSavingsTips(originalResults),
        metadata: {
          timestamp: new Date().toISOString(),
          country: originalResults.country || 'unknown',
          category: originalResults.category || 'unknown',
          resultsFound: originalResults.organic?.length || 0
        }
      };
    }
  }

  private extractFromOriginalResults(organic: any[]): any[] {
    if (!organic || !Array.isArray(organic)) return [];
    
    return organic.slice(0, 3).map(result => ({
      title: result.title || 'Unknown Deal',
      description: result.snippet || 'No description available',
      discount: 'Check website for current offers',
      reason: 'Found in search results'
    }));
  }

  private getDefaultSavingsTips(results: any): string[] {
    return [
      'Compare prices across different platforms',
      'Sign up for newsletters to receive exclusive discounts',
      'Check for seasonal sales and special events',
      'Look for combo deals or package offers',
      'Consider loyalty programs for additional savings'
    ];
  }
}
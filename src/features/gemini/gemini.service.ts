import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private visionModel: any;
  private readonly currencySymbolMap = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
  };

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('TAYAA_API_KEY');
    if (!apiKey) {
      throw new Error('Missing TAYAA_API_KEY in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      if (!response || !response.text) {
        throw new Error('Invalid response from Gemini API');
      }

      return response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response: ' + error.message);
    }
  }

  async analyzeImage(imageBuffer: Buffer) {
    try {
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new HttpException('Invalid image buffer', HttpStatus.BAD_REQUEST);
      }

      const prompt = "Analyze this image and extract the total amount and currency if present. Return the result in JSON format with 'amount' and 'currency' fields. If no currency symbol is visible, set currency as null.";

      const imageParts = [{
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }];

      const result = await this.visionModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;

      if (!response) {
        throw new Error('No response from Gemini API');
      }

      const text = response.text();
      console.log('Gemini API response:', text);

      try {
        const parsedResponse = JSON.parse(text);
        if (parsedResponse.currency && this.currencySymbolMap[parsedResponse.currency]) {
          parsedResponse.currency = this.currencySymbolMap[parsedResponse.currency];
        }
        return parsedResponse;
      } catch (parseError) {
        const numberMatch = text.match(/\d+([.,]\d+)?/);
        const amount = numberMatch ? parseFloat(numberMatch[0].replace(',', '.')) : 0;

        const currencyMatch = text.match(/[$€£¥]/);
        const currency = currencyMatch ? this.currencySymbolMap[currencyMatch[0]] : null;

        return { amount, currency };
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      throw new HttpException(
        `Failed to analyze image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async analyzeImageWithDescription(imageBuffer: Buffer): Promise<{
    amount: number;
    currency: string;
    description: string;
    category: string; // Changed from establishment to category
    items?: string[];
  }> {
    try {
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new HttpException('Invalid image buffer', HttpStatus.BAD_REQUEST);
      }

      // Modified prompt to focus on generic categories instead of specific establishments
      const prompt = `Analyze this receipt/bill image and extract the following information:
        1. The total amount paid
        2. The currency used
        3. The general category of purchase (e.g., restaurant, supermarket, clothing store, pharmacy, doctor, insurance)
        4. Up to 3 main items purchased or categories of items, if visible
        5. Create a brief description (max 5 words) of what this purchase was for

        Return the result as a JSON object with these fields:
        - amount: the total amount as a number
        - currency: the currency code or symbol
        - category: the general category of purchase (restaurant, supermarket, etc.)
        - items: array of main items purchased (if visible)
        - description: brief description of what was purchased

        Examples:
        {"amount": 52.79, "currency": "EUR", "category": "supermarket", "items": ["groceries", "produce"], "description": "Weekly grocery shopping"}
        {"amount": 86.50, "currency": "EUR", "category": "restaurant", "items": ["dinner", "wine"], "description": "Dinner with wine"}
        {"amount": 125.00, "currency": "EUR", "category": "clothing", "items": ["jeans", "shirt"], "description": "Clothing purchase"}
        {"amount": 42.30, "currency": "EUR", "category": "pharmacy", "items": ["medicine"], "description": "Medicine and toiletries"}`;

      const imageParts = [{
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }];

      const result = await this.visionModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;

      if (!response) {
        throw new Error('No response from Gemini API');
      }

      const text = this.stripMarkdownCodeBlocks(response.text());
      console.log('Enhanced image analysis response:', text);

      try {
        const parsedResponse = JSON.parse(text);
        return {
          amount: parseFloat(parsedResponse.amount) || 0,
          currency: this.currencySymbolMap[parsedResponse.currency] || parsedResponse.currency,
          description: parsedResponse.description || 'General Purchase',
          category: parsedResponse.category || 'shopping', // Default to "shopping" if no category
          items: parsedResponse.items || []
        };
      } catch (parseError) {
        console.error('Parse error:', parseError);
        // Fallback to basic analysis if JSON parsing fails
        const basicAnalysis = await this.analyzeImage(imageBuffer);
        return {
          ...basicAnalysis,
          description: 'General Purchase'
        };
      }
    } catch (error) {
      console.error('Image analysis with description error:', error);
      throw new HttpException(
        `Failed to analyze image with description: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateDescriptions(context: string, imageAnalysis?: any): Promise<{
    purchaseDescription: string;
    refundDescription: string;
  }> {
    try {
      const result = await this.model.generateContent(context);
      const response = await result.response;

      if (!response || !response.text) {
        console.warn('Invalid response from Gemini API in generateDescriptions. Falling back to defaults.');
        return {
          purchaseDescription: imageAnalysis?.description || 'Automated Purchase Description (API error)',
          refundDescription: 'Tax Refund Service (API error)',
        };
      }

      const responseText = response.text();
      const purchaseMatch = responseText.match(/purchase: (.+)/);
      const refundMatch = responseText.match(/refund: (.+)/);

      const purchaseDescription = purchaseMatch?.[1]?.trim() || imageAnalysis?.description || 'International Purchase';
      const refundDescription = refundMatch?.[1]?.trim() || 'Tax Refund Service';

      return {
        purchaseDescription: purchaseDescription,
        refundDescription: refundDescription,
      };
    } catch (error) {
      const fallbackPurchaseDescription = imageAnalysis?.description || 'Automated Purchase Description (fallback)';
      const fallbackRefundDescription = 'Tax Refund Service (fallback)';

      if (error.message && (error.message.includes('429 Too Many Requests') || error.message.includes('Quota exceeded'))) {
        console.warn(`Quota exceeded in GeminiService.generateDescriptions. Falling back to defaults. Error: ${error.message}`);
      } else {
        console.error(`Error in GeminiService.generateDescriptions. Falling back to defaults. Error: ${error.message}`, error);
      }

      return {
        purchaseDescription: fallbackPurchaseDescription,
        refundDescription: fallbackRefundDescription,
      };
    }
  }

  // New helper method to strip Markdown code blocks
  private stripMarkdownCodeBlocks(text: string): string {
    // Remove Markdown code block markers (```json and ```)
    let cleaned = text.replace(/```json\s+/g, '').replace(/```\s*$/g, '');

    // If after cleaning we have a {, assume it's JSON
    if (cleaned.trim().startsWith('{')) {
      return cleaned.trim();
    }

    // Try to extract JSON between code block markers if the first replace didn't work
    const jsonMatch = text.match(/```(?:json)?\s+(\{[\s\S]+?\})\s+```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }

    return text; // Return original if no pattern matches
  }

  // Helper method to extract meaningful phrases when JSON parsing fails
  private extractMeaningfulPhrase(text: string, type: 'purchase' | 'refund'): string | null {
    // Search for typical patterns in the model's response
    const phrases = text.match(/["']([^"']{3,30})["']/g);
    if (!phrases) return null;

    // Filter phrases by relevance to type
    const relevantPhrases = phrases.filter(phrase => {
      const p = phrase.toLowerCase();
      if (type === 'purchase') {
        return p.includes('purchase') || p.includes('shopping') ||
          p.includes('goods') || p.includes('store') ||
          p.includes('luxury') || p.includes('buy');
      } else {
        return p.includes('refund') || p.includes('tax') ||
          p.includes('vat') || p.includes('rebate') ||
          p.includes('return');
      }
    });

    if (relevantPhrases.length > 0) {
      return relevantPhrases[0].replace(/["']/g, '');
    }
    return null;
  }

  // Provide smart defaults based on country and amount
  private getDefaultDescription(country: string, amount: number, category?: string): string {
    if (category) {
      const categoryMap = {
        'restaurant': 'Restaurant Meal',
        'supermarket': 'Grocery Shopping',
        'clothing': 'Clothing Purchase',
        'electronics': 'Electronics Purchase',
        'pharmacy': 'Pharmacy Items',
        'insurance': 'Insurance Payment',
        'medical': 'Medical Services',
        'hotel': 'Hotel Stay'
      };

      return categoryMap[category.toLowerCase()] || `${category} Purchase`;
    }

    const countryMap = {
      'FR': 'French Luxury Purchase',
      'IT': 'Italian Designer Items',
      'ES': 'Spanish Fashion Goods',
      'DE': 'German Quality Products',
      'GB': 'British Retail Shopping',
      'CH': 'Swiss Premium Merchandise',
      'SG': 'Singapore Shopping Trip',
      'JP': 'Japanese Retail Purchase',
      'AE': 'Dubai Shopping Experience'
    };

    // Add price categorization
    const priceCategory = amount < 200 ? 'Standard ' : amount < 500 ? 'Premium ' : 'Luxury ';

    return countryMap[country] || `${priceCategory}International Purchase`;
  }

  private getDefaultRefundDescription(country: string): string {
    const refundMap = {
      'FR': 'French VAT Refund',
      'IT': 'Italian Tax Rebate',
      'ES': 'Spanish Tax Free',
      'DE': 'German VAT Return',
      'GB': 'UK VAT Reclaim',
      'CH': 'Swiss Tax Rebate',
      'SG': 'Singapore GST Refund',
      'JP': 'Japan Consumption Tax Refund',
      'AE': 'UAE Tax-Free Shopping'
    };

    return refundMap[country] || 'International Tax Refund';
  }
}

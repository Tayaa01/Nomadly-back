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
    if (!apiKey || apiKey === 'your_valid_api_key_here') {
      throw new Error('Invalid or missing TAYAA_API_KEY in environment variables');
    }
    console.log('API Key length:', apiKey.length); // Debug log
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
      console.log('Gemini API response:', text); // Add this for debugging

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
      console.error('Image analysis error:', error); // Add detailed error logging
      throw new HttpException(
        `Failed to analyze image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

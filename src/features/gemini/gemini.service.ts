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
      throw new Error('TAYAA_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Updated model name
  }

  async generateResponse(prompt: string) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async analyzeImage(imageBuffer: Buffer) {
    try {
      const prompt = "Analyze this image and extract the total amount and currency if present. Return the result in JSON format with 'amount' and 'currency' fields. If no currency symbol is visible, set currency as null.";
      
      const imageParts = [
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        }
      ];

      try {
        const result = await this.visionModel.generateContent(imageParts);
        const response = await result.response;
        const text = response.text();

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
      } catch (generateError) {
        throw new HttpException(
          'Failed to generate content',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      throw new HttpException(
        'Failed to analyze image',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

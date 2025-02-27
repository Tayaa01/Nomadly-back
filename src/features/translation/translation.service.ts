
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class TranslationService {
  constructor(private readonly geminiService: GeminiService) {}

  async translateText(text: string, targetLanguage: string, sourceLanguage?: string) {
    try {
      const prompt = sourceLanguage
        ? `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n"${text}"\nProvide ONLY the translation, without quotes or additional context.`
        : `Translate this text to ${targetLanguage}:\n"${text}"\nProvide ONLY the translation, without quotes or additional context.`;

      const translation = await this.geminiService.generateResponse(prompt);
      
      return {
        originalText: text,
        translatedText: translation.trim(),
        sourceLanguage: sourceLanguage || 'auto-detected',
        targetLanguage,
      };
    } catch (error) {
      throw new HttpException(
        'Translation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
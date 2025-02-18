import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TranslationService } from './translation.service';
import { TranslateDto } from './dto/translate.dto';

@ApiTags('Translation')
@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('translate')
  @ApiOperation({ summary: 'Translate text to target language' })
  @ApiResponse({ 
    status: 200, 
    description: 'Text translated successfully',
    schema: {
      properties: {
        originalText: { type: 'string', example: 'Hello, how are you?' },
        translatedText: { type: 'string', example: 'Bonjour, comment allez-vous?' },
        sourceLanguage: { type: 'string', example: 'English' },
        targetLanguage: { type: 'string', example: 'French' }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Translation failed' })
  async translateText(@Body() translateDto: TranslateDto) {
    return this.translationService.translateText(
      translateDto.text,
      translateDto.targetLanguage,
      translateDto.sourceLanguage
    );
  }
}
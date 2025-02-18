import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import * as Joi from 'joi';

@ApiTags('image-currency')
@Controller('image-currency')
export class ImageCurrencyController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly currencyConverterService: CurrencyConverterService,
  ) {}

  @Post('analyze-and-convert')
  @ApiOperation({ summary: 'Analyze image and convert currency' })
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        sourceCurrency: {
          type: 'string',
          description: 'Source currency code (if not detected in image)',
          required: ['false'],
        },
        targetCurrency: {
          type: 'string',
          description: 'Target currency code',
        },
      },
    },
  })
  async analyzeAndConvert(
    @UploadedFile() file: Express.Multer.File,
    @Body('sourceCurrency') sourceCurrency?: string,
    @Body('targetCurrency') targetCurrency?: string,
  ) {
    try {
      const analysis = await this.geminiService.analyzeImage(file.buffer);
      const sourceAmount = analysis.amount;
      const detectedCurrency = analysis.currency;
      const finalSourceCurrency = detectedCurrency || sourceCurrency;

      if (!finalSourceCurrency) {
        return {
          analysis,
          message: 'No currency detected. Please provide source currency.',
        };
      }

      if (!targetCurrency) {
        return {
          analysis,
          message: 'Please provide target currency.',
        };
      }

      const conversion = await this.currencyConverterService.convertCurrency(
        finalSourceCurrency,
        targetCurrency,
        sourceAmount,
      );

      return {
        analysis,
        conversion,
      };
    } catch (error) {
      throw error;
    }
  }
}

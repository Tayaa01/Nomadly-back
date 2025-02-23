import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import { TaxRefundService } from '../tax-refund/tax-refund.service';
import * as Joi from 'joi';

@ApiTags('Bill Analysis')
@Controller('image-currency')
export class ImageCurrencyController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxRefundService: TaxRefundService,
  ) {}

  @Post('analyze-and-convert')
  @ApiOperation({ 
    summary: 'Basic bill analysis',
    description: 'Analyze image and convert currency without tax refund information'
  })
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

  @Post('analyze-with-tax')
  @ApiOperation({ 
    summary: 'Advanced bill analysis',
    description: 'Analyze bill for amount, currency conversion and tourist tax refund eligibility'
  })
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image', 'country'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Receipt or bill image (JPEG, PNG)',
        },
        targetCurrency: {
          type: 'string',
          example: 'USD',
          description: 'Target currency for conversion',
        },
        country: {
          type: 'string',
          example: 'FR',
          description: 'Country code where purchase was made (FR, IT, ES, DE)',
          enum: ['FR', 'IT', 'ES', 'DE']
        }
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis successful',
    schema: {
      type: 'object',
      properties: {
        analysis: {
          type: 'object',
          properties: {
            amount: { type: 'number', example: 150.00 },
            currency: { type: 'string', example: 'EUR' }
          }
        },
        conversion: {
          type: 'object',
          properties: {
            amount: { type: 'number', example: 162.45 },
            currency: { type: 'string', example: 'USD' }
          }
        },
        taxRefund: {
          type: 'object',
          properties: {
            eligible: { type: 'boolean', example: true },
            country: { type: 'string', example: 'FR' },
            vatRate: { type: 'number', example: 20 },
            potentialRefund: { type: 'number', example: 18.00 },
            process: { type: 'string' },
            locations: { type: 'array', items: { type: 'string' } },
            requirements: { type: 'array', items: { type: 'string' } },
            tips: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or image format'
  })
  async analyzeWithTaxRefund(
    @UploadedFile() file: Express.Multer.File,
    @Body('targetCurrency') targetCurrency: string,
    @Body('country') country: string,
  ) {
    // First get currency analysis
    const analysis = await this.geminiService.analyzeImage(file.buffer);

    // Get currency conversion if needed
    let conversion = null;
    if (targetCurrency && analysis.currency !== targetCurrency) {
      conversion = await this.currencyConverterService.convertCurrency(
        analysis.currency,
        targetCurrency,
        analysis.amount
      );
    }

    // Get tax refund analysis
    const taxRefund = await this.taxRefundService.analyzeTaxRefund(
      analysis.amount,
      country
    );

    return {
      analysis,
      conversion,
      taxRefund
    };
  }
}

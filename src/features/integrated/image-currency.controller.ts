import { Controller, Post, UploadedFile, UseInterceptors, Body, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import { TaxRefundService } from '../tax-refund/tax-refund.service';
import { TransactionsService } from '../transactions/transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as Joi from 'joi';

@ApiTags('Bill Analysis')
@Controller('image-currency')
export class ImageCurrencyController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxRefundService: TaxRefundService,
    private readonly transactionsService: TransactionsService,
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Advanced bill analysis with transaction tracking',
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
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('country') country: string,
    @Body('targetCurrency') targetCurrency?: string,  // Move optional parameter to the end
  ) {
    // First get currency analysis
    const analysis = await this.geminiService.analyzeImageWithDescription(file.buffer);

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

    // Save transaction
    await this.transactionsService.create({
      userId: req.user.id,
      originalAmount: analysis.amount,
      originalCurrency: analysis.currency,
      convertedAmount: conversion ? conversion.amount : analysis.amount,
      convertedCurrency: conversion ? targetCurrency : analysis.currency,
      description: analysis.description,
      taxRefundAmount: taxRefund.eligible ? taxRefund.potentialRefund : 0,
      taxRefundDescription: taxRefund.eligible ? `Tax refund from ${country}` : null,
      country,
      hasTaxRefund: taxRefund.eligible,
      scanDate: new Date()
    });

    return {
      analysis,
      conversion,
      taxRefund
    };
  }
}

import { Controller, Post, UploadedFile, UseInterceptors, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
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
  ) { }

  @Post('analyze-and-convert')
  @ApiOperation({
    summary: 'Basic bill analysis',
    description: 'Analyze image for amount, use provided source currency if available (otherwise detect), and convert to target currency.'
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
          description: 'Image file of the bill/receipt.',
        },
        sourceCurrency: {
          type: 'string',
          description: 'Optional: Source currency code (e.g., USD). If provided, this will be used. Otherwise, detection from image is attempted.',
        },
        targetCurrency: {
          type: 'string',
          description: 'Target currency code (e.g., EUR). Required for conversion.',
        },
      },
      required: ['image', 'targetCurrency'] // Explicitly state image and targetCurrency are top-level requirements
    },
  })
  @ApiResponse({ status: 200, description: 'Analysis and conversion successful.' })
  @ApiResponse({ status: 400, description: 'Invalid input, missing currency information, or image processing error.' })
  async analyzeAndConvert(
    @UploadedFile() file: Express.Multer.File,
    @Body('sourceCurrency') inputSourceCurrency?: string,
    @Body('targetCurrency') targetCurrency?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    try {
      // 1. Analyze image to get amount and potentially detected currency
      const imageScanResult = await this.geminiService.analyzeImage(file.buffer);
      const detectedAmount = imageScanResult.amount;
      const detectedCurrencyFromImage = imageScanResult.currency; // Store the originally detected currency

      // 2. Determine the source currency to be used for conversion
      let finalSourceCurrencyUsed: string | null | undefined;

      if (inputSourceCurrency && inputSourceCurrency.trim() !== '') {
        finalSourceCurrencyUsed = inputSourceCurrency.trim().toUpperCase();
      } else {
        finalSourceCurrencyUsed = detectedCurrencyFromImage ? detectedCurrencyFromImage.toUpperCase() : null;
      }

      // 3. Validate that a source currency is available
      if (!finalSourceCurrencyUsed) {
        return {
          imageAnalysis: {
            detectedAmount,
            detectedCurrency: detectedCurrencyFromImage,
          },
          conversionInput: {
            sourceCurrencyUsed: null,
            targetCurrency: targetCurrency?.trim().toUpperCase(),
          },
          conversionResult: null,
          message: 'Source currency not detected from image and no valid source currency provided in input. Cannot perform conversion.',
        };
      }

      // 4. Validate that a target currency is provided
      const finalTargetCurrency = targetCurrency?.trim().toUpperCase();
      if (!finalTargetCurrency) {
        return {
          imageAnalysis: {
            detectedAmount,
            detectedCurrency: detectedCurrencyFromImage,
          },
          conversionInput: {
            sourceCurrencyUsed: finalSourceCurrencyUsed,
            targetCurrency: null,
          },
          conversionResult: null,
          message: 'Target currency not provided. Please specify a target currency for conversion.',
        };
      }

      // 5. Perform currency conversion
      const conversionResult = await this.currencyConverterService.convertCurrency(
        finalSourceCurrencyUsed,
        finalTargetCurrency,
        detectedAmount,
      );

      // 6. Return the structured result
      const debugOutput = {
        imageAnalysis: {
          detectedAmount,
          detectedCurrency: detectedCurrencyFromImage,
        },
        conversionInput: {
          sourceCurrencyUsed: finalSourceCurrencyUsed,
          targetCurrency: finalTargetCurrency,
        },
        conversionResult,
      };
      console.log('analyze-and-convert debug:', JSON.stringify(debugOutput, null, 2));
      return debugOutput;
    } catch (error) {
      console.error('Error during analyzeAndConvert:', error.message, error.stack);
      // Consider rethrowing as HttpException for better error handling by NestJS
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Processing error: ${error.message}`);
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

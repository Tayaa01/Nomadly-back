import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import { TaxRefundService } from './tax-refund.service';
import { TaxRefundAnalysis } from './types';
import { getCountryData } from './country-data';

@ApiTags('Tax Free Shopping')
@Controller('tax-free')
export class TaxRefundController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxRefundService: TaxRefundService,
  ) {}

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze receipt for tax-free shopping',
    description: 'Get tax refund eligibility, process details and converted amounts'
  })
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['receipt', 'country'],
      properties: {
        receipt: {
          type: 'string',
          format: 'binary',
          description: 'Receipt/bill image',
        },
        country: {
          type: 'string',
          description: 'Country code where purchase was made (e.g., FR, US)',
          example: 'FR'
        },
        targetCountry: {
          type: 'string',
          description: 'Your current location country code for currency conversion',
          example: 'US'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis successful',
    schema: {
      type: 'object',
      properties: {
        receipt: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            currency: {
              type: 'object',
              properties: {
                detected: { type: 'string' },
                used: { type: 'string' },
                converted: { type: 'string', nullable: true }
              }
            }
          }
        },
        taxRefund: {
          type: 'object',
          properties: {
            available: { type: 'boolean' },
            message: { type: 'string' },
            details: {
              type: 'object',
              description: 'Present only for supported countries',
              nullable: true
            }
          }
        }
      }
    }
  })
  async analyzeTaxFree(
    @UploadedFile() file: Express.Multer.File,
    @Body('country') country: string,
    @Body('targetCountry') targetCountry?: string,
  ) {
    const analysis = await this.geminiService.analyzeImage(file.buffer);
    const sourceCountryData = getCountryData(country);
    const targetCountryData = targetCountry ? getCountryData(targetCountry) : null;

    if (!sourceCountryData) {
      return {
        error: `Country code '${country}' not recognized`
      };
    }

    const response: any = {
      bill: {
        amount: {
          value: analysis.amount,
          currency: sourceCountryData.currency
        },
        country: sourceCountryData.name
      }
    };

    // Handle currency conversion if target country is provided
    if (targetCountryData && sourceCountryData.currency !== targetCountryData.currency) {
      try {
        const convertedAmount = await this.currencyConverterService.convertCurrency(
          sourceCountryData.currency,
          targetCountryData.currency,
          analysis.amount
        );
        
        response.bill.convertedAmount = {
          value: Math.round(convertedAmount.result * 100) / 100,
          currency: targetCountryData.currency,
          country: targetCountryData.name
        };
      } catch (error) {
        console.error('Currency conversion error:', error);
        response.bill.conversionError = 'Currency conversion failed';
      }
    }

    // Special handling for US tax-free shopping
    if (country.toUpperCase() === 'US') {
      response.taxRefund = {
        available: false,
        message: 'The United States does not have a VAT refund system.'
      };
      return response;
    }

    // Handle tax refund analysis
    const taxInfo = await this.taxRefundService.analyzeTaxRefund(analysis.amount, country);
    
    if (!taxInfo.eligible) {
      response.taxRefund = {
        available: false,
        message: `To be eligible for tax refund in ${country}, purchases must be above ${taxInfo.minPurchaseAmount} ${sourceCountryData.currency}. Your purchase amount is ${analysis.amount} ${sourceCountryData.currency}`
      };

      // Add converted minimum amount if target country is different
      if (response.bill.convertedAmount) {
        const convertedMin = await this.currencyConverterService.convertCurrency(
          sourceCountryData.currency,
          targetCountryData.currency,
          taxInfo.minPurchaseAmount
        );
        response.taxRefund.convertedMinAmount = {
          value: Math.round(convertedMin.result * 100) / 100,
          currency: targetCountryData.currency
        };
      }
    } else {
      response.taxRefund = {
        available: true,
        amount: {
          value: Math.round(taxInfo.potentialRefund * 100) / 100,
          currency: sourceCountryData.currency
        },
        instructions: `Get your tax refund at ${taxInfo.locations.join(' or ')} before leaving ${country}. Bring your passport, original receipt, and ${taxInfo.documentation?.[0] || 'required forms'}. Must be done within ${taxInfo.timeLimit} of purchase.`,
        requirements: [
          `Minimum purchase: ${taxInfo.minPurchaseAmount} ${sourceCountryData.currency}`,
          'Must be non-EU resident',
          'Items must be unused and in original packaging'
        ]
      };
    }

    return response;
  }
}

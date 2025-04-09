import { Controller, Post, UploadedFile, UseInterceptors, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import { TaxRefundService } from './tax-refund.service';
import { TaxRefundAnalysis } from './types';
import { getCountryData } from './country-data';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from '../transactions/transactions.service';
import { Express } from 'express';
import { SavingsService } from '../savings/savings.service';
import { Types } from 'mongoose'; // Import Types from mongoose

@ApiTags('Tax Free Shopping')
@Controller('tax-free')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')  // Make sure this matches the name in main.ts
export class TaxRefundController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxRefundService: TaxRefundService,
    private readonly transactionsService: TransactionsService,
    private readonly savingsService: SavingsService
  ) {}

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze receipt for tax-free shopping',
    description: 'Get tax refund eligibility, process details and converted amounts'
  })
  @UseInterceptors(
    FileInterceptor('receipt', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
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
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('country') country: string
  ) {
    console.log('Request headers:', req.headers);
    console.log('Authenticated user:', req.user);

    if (!file) {
      throw new BadRequestException('Receipt file is required');
    }

    // Get user country code from authenticated user data
    const userCountryCode = req.user.countryCode;
    if (!userCountryCode) {
      throw new BadRequestException('User country code not available');
    }

    // Use enhanced image analysis that extracts more details
    const analysis = await this.geminiService.analyzeImageWithDescription(file.buffer);
    const sourceCountryData = getCountryData(country);
    const targetCountryData = getCountryData(userCountryCode);

    if (!sourceCountryData) {
      return {
        error: `Country code '${country}' not recognized. Please use a valid country code (e.g., FR for France).`
      };
    }

    // Store items for later use in descriptions but don't add to response
    const itemsForDescription = analysis.items || [];

    const response: any = {
      bill: {
        amount: {
          value: analysis.amount,
          currency: sourceCountryData.currency
        },
        country: sourceCountryData.name,
        category: analysis.category || undefined
      }
    };

    // Generate descriptions using the category and items (for internal use only)
    const purchaseContext = `Purchase of ${analysis.amount} ${sourceCountryData.currency} in ${country}`;
    const descriptions = await this.geminiService.generateDescriptions(purchaseContext, {
      category: analysis.category,
      items: itemsForDescription
    });

    // Handle currency conversion if target country is different from source country
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
          country: targetCountryData.name,
          description: descriptions.purchaseDescription || 'International Purchase'
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
        message: taxInfo.message || `To be eligible for tax refund in ${sourceCountryData.name}, purchases must be above ${taxInfo.minPurchaseAmount} ${sourceCountryData.currency}. Your purchase amount is ${analysis.amount} ${sourceCountryData.currency}`
      };

      // Add converted minimum amount if target country is different
      if (response.bill.convertedAmount && taxInfo.minPurchaseAmount) {
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
      const refundAmount = Math.round(taxInfo.potentialRefund * 100) / 100;
      
      response.taxRefund = {
        available: true,
        amount: {
          value: refundAmount,
          currency: sourceCountryData.currency,
          description: descriptions.refundDescription || `Tax refund from ${sourceCountryData.name}`
        },
        instructions: `Get your tax refund at ${taxInfo.locations.join(' or ')} before leaving ${sourceCountryData.name}. Bring your passport, original receipt, and ${taxInfo.documentation?.[0] || 'required forms'}. Must be done within ${taxInfo.timeLimit} of purchase.`,
        requirements: [
          `Minimum purchase: ${taxInfo.minPurchaseAmount} ${sourceCountryData.currency}`,
          'Must be non-EU resident',
          'Items must be unused and in original packaging'
        ]
      };
      
      // Track this potential refund in user's savings
      const updatedSavings = await this.savingsService.addPotentialRefund(
        req.user.id, 
        refundAmount, 
        sourceCountryData.currency, 
        country,
        analysis.category
      );
      
      // Add savings info to the response
      response.savings = {
        potentialRefunds: updatedSavings.potentialRefunds,
        potentialRefundCount: updatedSavings.potentialRefundCount,
        refundAdded: refundAmount
      };
    }

    // Save transaction
    if (taxInfo.eligible) {
      const transactionData = {
        userId: new Types.ObjectId(req.user.id), // Convert userId to ObjectId
        originalAmount: analysis.amount,
        originalCurrency: sourceCountryData.currency,
        convertedAmount: response.bill.convertedAmount?.value || analysis.amount,
        convertedCurrency: targetCountryData?.currency || sourceCountryData.currency,
        description: descriptions.purchaseDescription || 'Shopping in ' + country,
        taxRefundAmount: taxInfo.potentialRefund,
        taxRefundDescription: descriptions.refundDescription || `Tax refund from ${country}`,
        country: country,
        hasTaxRefund: true,
        scanDate: new Date()
      };

      console.log('Saving transaction:', transactionData);

      try {
        await this.transactionsService.create(transactionData); // Do not include createdAt
        console.log('Transaction saved successfully.');
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }

    // Add descriptive details to the response
    response.bill.description = analysis.description || descriptions.purchaseDescription;

    // Add this to the response so client knows which country code was used
    response.user = {
      countryCode: userCountryCode
    };

    // Make sure items array is not in the response
    if (response.bill.items) {
      delete response.bill.items;
    }

    return response;
  }
}

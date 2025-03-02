import { Controller, Get, Query, ParseFloatPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CurrencyConverterService } from './currency-converter.service';

@ApiTags('Currency')
@Controller('currency')
export class CurrencyConverterController {
  constructor(private readonly currencyConverterService: CurrencyConverterService) {}

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount from one currency to another' })
  @ApiQuery({ name: 'from', description: 'Source currency code', example: 'EUR' })
  @ApiQuery({ name: 'to', description: 'Target currency code', example: 'USD' })
  @ApiQuery({ name: 'amount', description: 'Amount to convert', example: 100 })
  @ApiResponse({
    status: 200,
    description: 'Currency conversion successful',
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: 'EUR' },
        to: { type: 'string', example: 'USD' },
        amount: { type: 'number', example: 100 },
        rate: { type: 'number', example: 1.09 },
        result: { type: 'number', example: 109 }
      }
    }
  })
  async convert(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('amount', ParseFloatPipe) amount: number
  ) {
    return this.currencyConverterService.convertCurrency(from, to, amount);
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get list of available currencies' })
  @ApiResponse({
    status: 200,
    description: 'List of supported currencies',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'USD' },
          name: { type: 'string', example: 'US Dollar' }
        }
      }
    }
  })
  async getSupportedCurrencies() {
    return this.currencyConverterService.getSupportedCurrencies();
  }
}

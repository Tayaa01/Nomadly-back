import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrencyConverterService } from './currency-converter.service';

@ApiTags('currency-converter')
@Controller('currency-converter')
export class CurrencyConverterController {
  constructor(private readonly currencyConverterService: CurrencyConverterService) {}

  @Get('convert')
  @ApiOperation({ summary: 'Convert currency' })
  @ApiQuery({ name: 'from', description: 'Source currency code (e.g., USD)' })
  @ApiQuery({ name: 'to', description: 'Target currency code (e.g., EUR)' })
  @ApiQuery({ name: 'amount', description: 'Amount to convert', type: Number })
  async convertCurrency(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('amount') amount: number,
  ) {
    return this.currencyConverterService.convertCurrency(from, to, amount);
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get available currencies' })
  async getAvailableCurrencies() {
    return this.currencyConverterService.getAvailableCurrencies();
  }
}

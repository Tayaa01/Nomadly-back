import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionNoConvertedCurrencyDto } from './dto/create-transaction-no-converted-currency.dto';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token') // Use the same security name as defined in main.ts
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transactions with details' })
  @ApiResponse({
    status: 200,
    description: 'Returns user transactions with details, including converted amount and currency',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          originalCurrency: { type: 'string' },
          originalAmount: { type: 'number' },
          convertedAmount: { type: 'number' },
          convertedCurrency: { type: 'string' },
        },
      },
    },
  })
  async getUserTransactions(@Request() req) {
    return this.transactionsService.getUserTransactionsWithDetails(req.user.id);
  }

  @Get('totals')
  @ApiOperation({ summary: 'Get user transaction totals' })
  @ApiResponse({ status: 200, description: 'Returns user transaction totals' })
  async getUserTotals(@Request() req) {
    return this.transactionsService.getUserTotals(req.user.id);
  }

  @Get('by-day')
  @ApiOperation({ summary: 'Get transactions grouped by day' })
  @ApiResponse({ status: 200, description: 'Returns daily transaction totals for charting' })
  async getTransactionsByDay(@Request() req) {
    return this.transactionsService.getTransactionsByDay(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a manual transaction' })
  @ApiBody({ type: CreateTransactionNoConvertedCurrencyDto }) // Use the new DTO class
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  async createManualTransaction(
    @Request() req,
    @Body() body: CreateTransactionNoConvertedCurrencyDto // Use the new DTO class
  ) {
    // Use the user's currency from the JWT
    const userCurrency = req.user.currency;

    // Pass the user's currency to the service
    return this.transactionsService.createManualTransaction(req.user.id, {
      ...body,
      convertedCurrency: userCurrency, // Always use the user's currency
    });
  }
}

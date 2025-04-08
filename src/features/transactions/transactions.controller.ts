import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token') // Use the same security name as defined in main.ts
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transactions with details' })
  @ApiResponse({ status: 200, description: 'Returns user transactions with details' })
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
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  async createManualTransaction(
    @Request() req,
    @Body() body: CreateTransactionDto
  ) {
    return this.transactionsService.createManualTransaction(req.user.id, body);
  }
}

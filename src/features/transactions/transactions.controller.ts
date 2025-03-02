import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transactions' })
  @ApiResponse({ status: 200, description: 'Returns user transactions history' })
  async getUserTransactions(@Request() req) {
    return this.transactionsService.getUserTransactions(req.user.id);
  }

  @Get('totals')
  @ApiOperation({ summary: 'Get user transaction totals' })
  @ApiResponse({ status: 200, description: 'Returns user transaction totals' })
  async getUserTotals(@Request() req) {
    return this.transactionsService.getUserTotals(req.user.id);
  }
}

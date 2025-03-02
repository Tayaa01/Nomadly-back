import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavingsService } from './savings.service';
import { SavingsSummaryDto } from './dto/savings-summary.dto';

@ApiTags('Savings')
@Controller('savings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get savings summary for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the user\'s savings summary',
    type: SavingsSummaryDto
  })
  async getSavingsSummary(@Request() req): Promise<SavingsSummaryDto> {
    return this.savingsService.getSavingsSummary(req.user.id);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset savings for current user' })
  @ApiResponse({ status: 200, description: 'Savings have been reset' })
  async resetSavings(@Request() req): Promise<{ message: string }> {
    await this.savingsService.resetSavings(req.user.id);
    return { message: 'Savings have been reset successfully' };
  }

  @Get('by-day')
  @ApiOperation({ summary: 'Get savings grouped by day' })
  @ApiResponse({ status: 200, description: 'Returns daily savings totals for charting' })
  async getSavingsByDay(@Request() req) {
    return this.savingsService.getSavingsByDay(req.user.id);
  }
}

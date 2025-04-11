import { IsNotEmpty, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TravelRequestDto {
  @ApiProperty({ description: 'Country to visit', example: 'France' })
  @IsNotEmpty({ message: 'Country is required' })
  country: string;

  @ApiProperty({ description: 'Budget in USD', example: 1500 })
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(1, { message: 'Budget must be greater than 0' })
  budget: number;

  @ApiProperty({ description: 'Number of days', example: 5 })
  @IsNumber({}, { message: 'Days must be a number' })
  @Min(1, { message: 'Minimum stay is 1 day' })
  @Max(14, { message: 'Maximum stay is 14 days' })
  days: number;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2025-06-15' })
  @IsDateString({}, { message: 'Start Date must be a valid date string' })
  startDate: string;
}

export class BudgetOptimizedTravelRequestDto {
  @ApiProperty({ description: 'Country to visit', example: 'Thailand' })
  @IsNotEmpty({ message: 'Country is required' })
  country: string;

  @ApiProperty({ description: 'Number of days', example: 7 })
  @IsNumber({}, { message: 'Days must be a number' })
  @Min(1, { message: 'Minimum stay is 1 day' })
  @Max(14, { message: 'Maximum stay is 14 days' })
  days: number;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2025-05-15' })
  @IsDateString({}, { message: 'Start Date must be a valid date string' })
  startDate: string;
}

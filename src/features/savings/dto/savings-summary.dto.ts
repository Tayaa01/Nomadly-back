import { ApiProperty } from '@nestjs/swagger';

export class SavingsSummaryDto {
  @ApiProperty({ example: 250.75 })
  totalSavings: number;

  @ApiProperty({ example: 'EUR' })
  currency: string;

  @ApiProperty({ example: 150.50 })
  potentialRefunds: number;

  @ApiProperty({ example: 3 })
  potentialRefundCount: number;

  @ApiProperty({ 
    example: { 
      FR: 100.50, 
      IT: 50.00 
    } 
  })
  savingsByCountry: Record<string, number>;

  @ApiProperty({ 
    example: { 
      clothing: 75.25, 
      electronics: 75.25 
    } 
  })
  savingsByCategory: Record<string, number>;

  @ApiProperty()
  lastUpdated: Date;
}

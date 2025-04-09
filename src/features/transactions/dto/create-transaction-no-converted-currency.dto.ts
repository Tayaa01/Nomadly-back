import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsDateString } from 'class-validator';

export class CreateTransactionNoConvertedCurrencyDto {
  @ApiProperty({ example: 100, description: 'The amount of the transaction' })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'USD', description: 'The currency of the transaction' })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ example: '2023-01-01', description: 'The date of the transaction in YYYY-MM-DD format' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Purchase at store', description: 'The description of the transaction' })
  @IsNotEmpty()
  @IsString()
  description: string;
}

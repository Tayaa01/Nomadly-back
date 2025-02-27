import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class DealSearchDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  specific?: string;
}
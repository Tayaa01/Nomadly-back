import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, IsUppercase } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User\'s first name',
    example: 'Tayaa',
    required: false
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'User\'s last name',
    example: 'Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'User\'s email address',
    example: 'tayaa@gmail.com',
    required: false
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User\'s country code',
    example: 'TN',
    required: false
  })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  countryCode?: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'User\'s preferred currency code (ISO 4217)'
  })
  @IsOptional()
  @IsString()
  @IsUppercase()
  @Length(3, 3, { message: 'Currency code must be 3 uppercase letters (ISO 4217)' })
  currency?: string;
}

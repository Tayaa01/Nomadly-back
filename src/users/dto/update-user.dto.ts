import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, IsIn } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: 'User\'s first name', example: 'Tayaa' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'User\'s last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'User\'s email address', example: 'tayaa@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'User\'s password (optional)' })
  @IsOptional()
  @IsString()
  @Length(6, 30)
  password?: string;

  @ApiProperty({ description: 'User\'s role', example: 'user', enum: ['user', 'admin'] })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: string;

  @ApiProperty({ description: 'User\'s country code', example: 'TN' })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  countryCode?: string;
}

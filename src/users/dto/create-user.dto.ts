import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsUppercase,
  IsOptional,
  IsBoolean
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  @Matches(/^[a-zA-Z\s]*$/, { message: 'First name can only contain letters and spaces' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  @Matches(/^[a-zA-Z\s]*$/, { message: 'Last name can only contain letters and spaces' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Password required for local registration. Not needed for Google OAuth.',
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>+\-_])[A-Za-z\d!@#$%^&*(),.?":{}|<>+\-_]{8,}$/,
    {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }
  )
  password?: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @MinLength(2)
  @MaxLength(3)
  @Matches(/^[A-Z]{2,3}$/, {
    message: 'Country code must be 2 or 3 uppercase letters (ISO 3166-1)',
  })
  countryCode: string;

  @ApiProperty({ example: 'USD', description: 'Currency of the user (automatically set based on country code)' })
  @IsString()
  currency?: string; // Make this optional since it will be set automatically

  @ApiProperty({ description: 'Indicates if the user\'s email has been verified', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;
}

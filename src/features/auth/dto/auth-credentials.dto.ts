import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AuthCredentialsDto {
  @ApiProperty({ 
    example: 'tayaa@gmail.com',
    description: 'User email address'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ 
    example: 'Tayaa1999+',
    description: 'User password (min 8 characters with uppercase, lowercase, number, special char)'
  })
  @IsString()
  @MinLength(8)
  password: string;
}

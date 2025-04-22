import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Request, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginResponse } from './interfaces/login-response.interface';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyJwtDto } from './dto/verify-jwt.dto';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email to send reset code to' })
  @IsEmail()
  email: string;
}

export class ResetPasswordConfirmDto {
  @ApiProperty({ example: 'user@example.com', description: 'User\'s email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit reset code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: 'NewSecurePassword123!', description: 'New password' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    description: 'User credentials',
    type: AuthCredentialsDto,
    examples: {
      example1: {
        summary: 'Standard login',
        value: {
          email: 'tayaa@gmail.com',
          password: 'Tayaa1999+'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User logged in successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '67c42ba15ee096beea501d7c' },
            email: { type: 'string', example: 'tayaa@gmail.com' },
            firstName: { type: 'string', example: 'Tayaa' },
            lastName: { type: 'string', example: 'Doe' },
            countryCode: { type: 'string', example: 'TN' },
            role: { type: 'string', example: 'user' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  async login(@Body() authCredentialsDto: AuthCredentialsDto): Promise<LoginResponse> {
    try {
      console.log('Login attempt:', authCredentialsDto.email);

      // Manually validate user
      const user = await this.authService.validateUser(
        authCredentialsDto.email,
        authCredentialsDto.password
      );

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Generate token and return response
      return this.authService.login(user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User registered successfully' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already exists' })
  async register(@Body() createUserDto: CreateUserDto): Promise<LoginResponse> {
    return this.authService.register(createUserDto);
  }

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request password reset (send 6-digit code to email)' })
  @ApiResponse({ status: 201, description: 'Reset code sent if email exists' })
  @ApiBody({
    type: ResetPasswordRequestDto,
    examples: {
      example1: {
        summary: 'Request password reset',
        value: { email: 'user@example.com' }
      }
    }
  })
  async requestPasswordReset(@Body() body: ResetPasswordRequestDto) {
    await this.authService.sendPasswordResetCode(body.email);
    return { message: 'If this email exists, a reset code has been sent.' };
  }

  @Patch('reset-password')
  @ApiOperation({ summary: 'Reset password using 6-digit code and email' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiBody({
    type: ResetPasswordConfirmDto,
    examples: {
      example1: {
        summary: 'Reset password',
        value: {
          email: 'user@example.com',
          code: '123456',
          newPassword: 'YourNewPassword123!'
        }
      }
    }
  })
  async resetPassword(
    @Body() body: ResetPasswordConfirmDto
  ) {
    await this.authService.resetPasswordWithCode(body.email, body.code, body.newPassword);
    return { message: 'Password reset successful.' };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password for logged-in user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Request() req,
    @Body() body: ChangePasswordDto
  ) {
    await this.authService.changePassword(req.user.email, body.oldPassword, body.newPassword);
    return { message: 'Password changed successfully.' };
  }

  @Post('verify-jwt')
  @ApiOperation({ summary: 'Check if a JWT is valid and not expired' })
  @ApiResponse({ status: 200, description: 'JWT is valid or expired' })
  async verifyJwt(@Body() body: VerifyJwtDto) {
    try {
      const decoded = this.authService.verifyJwt(body.jwt);
      return { valid: true, payload: decoded };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}

import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginResponse } from './interfaces/login-response.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { LoginResponse } from './interfaces/login-response.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Explicitly select the fields we need
      const userObject = user.toObject();
      console.log('User object:', userObject); // Debug log

      return {
        _id: userObject._id,
        email: userObject.email,
        firstName: userObject.firstName,
        lastName: userObject.lastName,
        countryCode: userObject.countryCode,
        role: userObject.role
      };
    } catch (error) {
      console.error('Validate user error:', error);
      return null;
    }
  }

  async login(user: any): Promise<LoginResponse> {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user data');
    }

    const payload = {
      email: user.email,
      sub: user._id.toString(),
      role: user.role || 'user',
      countryCode: user.countryCode // Add country code to JWT payload
    };

    console.log('Login payload:', payload); // Debug log

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        role: user.role || 'user'
      }
    };
  }

  async register(createUserDto: CreateUserDto): Promise<LoginResponse> {
    const user = await this.usersService.create(createUserDto);
    return this.login(user);
  }
}

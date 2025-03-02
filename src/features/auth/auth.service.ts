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
      if (user && (await bcrypt.compare(password, user.password))) {
        const { password, ...result } = user.toObject();
        return result;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async login(user: any): Promise<LoginResponse> {
    const payload = { 
      email: user.email, 
      sub: user._id,
      role: user.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        role: user.role
      }
    };
  }

  async register(createUserDto: CreateUserDto): Promise<LoginResponse> {
    const user = await this.usersService.create(createUserDto);
    return this.login(user);
  }
}

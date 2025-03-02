import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
    console.log('LocalStrategy initialized');
  }

  async validate(email: string, password: string): Promise<any> {
    console.log('LocalStrategy validating:', email);
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      console.error('Invalid credentials for user:', email);
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}

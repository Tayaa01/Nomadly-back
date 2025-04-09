import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService // Inject UsersService to fetch user details
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    console.log('Initializing JWT Strategy');
    console.log('Secret available:', !!secret);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('JWT Strategy - Validating token payload:', payload);
    try {
      if (!payload || !payload.sub) {
        console.error('Invalid JWT payload structure:', payload);
        throw new UnauthorizedException('Invalid token payload');
      }

      // Fetch user currency from the database
      const userCurrency = await this.usersService.getUserCurrency(payload.sub);

      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        countryCode: payload.countryCode || 'US', // Default to 'US' if not provided
        currency: userCurrency.currency, // Add the user's currency
      };
      console.log('JWT Strategy - Validated user:', user);
      return user;
    } catch (error) {
      console.error('JWT validation error:', error);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}

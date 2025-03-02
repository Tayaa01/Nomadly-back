import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is missing');
    }

    console.log('JWT Guard - Full auth header:', authHeader);
    console.log('JWT Guard - Token:', authHeader.split(' ')[1]);

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (info instanceof Error) {
      console.error('JWT validation error:', info.message);
      throw new UnauthorizedException(info.message);
    }

    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}

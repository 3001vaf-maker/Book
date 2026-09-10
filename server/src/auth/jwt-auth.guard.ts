import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { auth?: { userId: string; tenantId: string; role: string } }>();
    const authorization = String(request.headers.authorization || '');
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; tenantId: string; role: string }>(token);
      if (!payload.sub || !payload.tenantId) throw new UnauthorizedException();
      request.auth = { userId: payload.sub, tenantId: payload.tenantId, role: payload.role || '' };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

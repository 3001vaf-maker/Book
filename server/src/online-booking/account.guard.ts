import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

type AccountToken = {
  sub?: string;
  kind?: string;
};

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { accountAuth?: { accountId: string; tenantId: string } }>();
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Требуется вход в аккаунт');

    try {
      const payload = await this.jwt.verifyAsync<AccountToken>(token);
      if (payload.kind !== 'account' || !payload.sub) throw new Error('invalid account token');
      const tenantId = String(request.params?.tenantId || '').trim();
      if (!tenantId) throw new Error('missing tenant context');
      request.accountAuth = { accountId: payload.sub, tenantId };
      return true;
    } catch {
      throw new UnauthorizedException('Войдите в аккаунт заново');
    }
  }
}

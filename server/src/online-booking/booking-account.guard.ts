import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { PrismaService } from '../prisma.service';

type BookingAccountToken = {
  sub?: string;
  tenantId?: string;
  kind?: string;
};

@Injectable()
export class BookingAccountGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly legal: LegalRuntimeService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { bookingAccountAuth?: { accountId: string; tenantId: string } }>();
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Требуется вход в аккаунт');

    let payload: BookingAccountToken;
    try {
      payload = await this.jwt.verifyAsync<BookingAccountToken>(token);
    } catch {
      throw new UnauthorizedException('Войдите в аккаунт заново');
    }
    if (payload.kind !== 'booking-account' || !payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Войдите в аккаунт заново');
    }

    const routeTenantId = String(request.params?.tenantId || '').trim();
    if (routeTenantId && routeTenantId !== payload.tenantId) throw new UnauthorizedException('Аккаунт относится к другому Book');

    await this.legal.assertPublicBooking(payload.tenantId);
    const account = await this.prisma.bookingAccount.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
      select: { id: true },
    });
    if (!account) throw new UnauthorizedException('Аккаунт клиента больше недоступен');

    request.bookingAccountAuth = { accountId: payload.sub, tenantId: payload.tenantId };
    return true;
  }
}

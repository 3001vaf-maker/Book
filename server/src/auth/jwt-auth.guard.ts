import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { auth?: { userId: string; tenantId: string; role: string } }>();
    const authorization = String(request.headers.authorization || '');
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: { sub: string; tenantId: string; role?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; tenantId: string; role?: string }>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub || !payload.tenantId) throw new UnauthorizedException();

    const [user, membership, access] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } }),
      this.prisma.membership.findFirst({
        where: { userId: payload.sub, tenantId: payload.tenantId },
        select: { role: true },
      }),
      this.prisma.tenantAccess.findUnique({
        where: { tenantId: payload.tenantId },
        select: { status: true },
      }),
    ]);

    if (!user || !membership) throw new UnauthorizedException('Доступ пользователя к Tenant прекращён');
    if (!access || String(access.status) !== 'ACTIVE') throw new ForbiddenException('Tenant недоступен');

    request.auth = {
      userId: user.id,
      tenantId: payload.tenantId,
      role: String(membership.role),
    };
    return true;
  }
}

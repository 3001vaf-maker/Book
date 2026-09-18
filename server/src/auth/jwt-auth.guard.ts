import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { MembershipRole, TenantAccessStatus } from '@prisma/client';
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

    if (!user || !membership) throw new UnauthorizedException('Доступ пользователя к рабочему пространству прекращён');

    let effectiveAccess = access;
    if (membership.role === MembershipRole.OWNER) {
      const platformOwner = await this.prisma.platformAdmin.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (platformOwner) {
        effectiveAccess = await this.prisma.tenantAccess.upsert({
          where: { tenantId: payload.tenantId },
          create: {
            tenantId: payload.tenantId,
            status: TenantAccessStatus.ACTIVE,
            isOwnerBook: true,
          },
          update: {
            status: TenantAccessStatus.ACTIVE,
            isOwnerBook: true,
            planId: null,
          },
          select: { status: true },
        });
      }
    }

    if (!effectiveAccess || effectiveAccess.status !== TenantAccessStatus.ACTIVE) {
      throw new ForbiddenException('Рабочее пространство недоступно');
    }

    request.auth = {
      userId: user.id,
      tenantId: payload.tenantId,
      role: String(membership.role),
    };
    return true;
  }
}

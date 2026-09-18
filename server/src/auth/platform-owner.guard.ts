import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & {
      auth?: { userId: string; tenantId: string; role: string };
    }>();
    const auth = request.auth;
    if (!auth?.userId || !auth?.tenantId || auth.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Доступ владельца платформы не подтверждён');
    }

    const owner = await this.prisma.platformAdmin.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    if (!owner) throw new ForbiddenException('Доступ владельца платформы не подтверждён');
    return true;
  }
}

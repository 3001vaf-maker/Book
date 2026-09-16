import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';

type AdminRequest = Request & {
  auth?: { userId: string; tenantId: string; role: string };
  platformAdminId?: string;
};

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const userId = request.auth?.userId;
    if (!userId) throw new ForbiddenException('Нет доступа к панели управления');

    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Нет доступа к панели управления');

    request.platformAdminId = admin.id;
    return true;
  }
}

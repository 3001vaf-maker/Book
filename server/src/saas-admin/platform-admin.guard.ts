import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { MembershipRole } from '@prisma/client';
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
    const tenantId = request.auth?.tenantId;
    if (!userId || !tenantId) throw new ForbiddenException('Нет доступа к панели управления');

    const existing = await this.prisma.platformAdmin.findUnique({ where: { userId } });
    if (existing) {
      request.platformAdminId = existing.id;
      return true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const configuredEmail = String(process.env.PLATFORM_ADMIN_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    if (configuredEmail && user?.email.toLowerCase() === configuredEmail) {
      const admin = await this.prisma.platformAdmin.create({ data: { userId } });
      await this.prisma.tenantAccess.upsert({
        where: { tenantId },
        create: { tenantId, isPlatformOwnerWorkspace: true },
        update: { isPlatformOwnerWorkspace: true },
      });
      request.platformAdminId = admin.id;
      return true;
    }

    const adminCount = await this.prisma.platformAdmin.count();
    if (adminCount === 0) {
      const firstTenant = await this.prisma.tenant.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      const membership = firstTenant
        ? await this.prisma.membership.findUnique({
            where: { tenantId_userId: { tenantId: firstTenant.id, userId } },
          })
        : null;
      if (firstTenant?.id === tenantId && membership?.role === MembershipRole.OWNER) {
        const admin = await this.prisma.platformAdmin.create({ data: { userId } });
        await this.prisma.tenantAccess.upsert({
          where: { tenantId },
          create: { tenantId, isPlatformOwnerWorkspace: true },
          update: { isPlatformOwnerWorkspace: true },
        });
        request.platformAdminId = admin.id;
        return true;
      }
    }

    throw new ForbiddenException('Нет доступа к панели управления');
  }
}

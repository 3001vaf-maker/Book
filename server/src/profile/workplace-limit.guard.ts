import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';

type WorkplaceRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
  params: { key?: string };
};

@Injectable()
export class WorkplaceLimitGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WorkplaceRequest>();
    const tenantId = request.auth?.tenantId;
    const key = String(request.params?.key || '').trim();
    if (!tenantId || !key) return true;

    const existing = await this.prisma.workplace.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { id: true },
    });
    if (existing) return true;

    const capability = await this.access.resolveCapability(tenantId, 'workplaces.max');
    if (capability.limit === null) return true;

    const currentCount = await this.prisma.workplace.count({ where: { tenantId } });
    if (currentCount >= capability.limit) {
      throw new ForbiddenException({
        code: 'WORKPLACE_LIMIT',
        message: `Доступно рабочих пространств: ${capability.limit}`,
        limit: capability.limit,
      });
    }
    return true;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, platformAccountId: string) {
    return this.prisma.workspaceState.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      select: { data: true, revision: true, updatedAt: true },
    });
  }

  async save(tenantId: string, platformAccountId: string, data: Prisma.InputJsonValue) {
    return this.prisma.workspaceState.upsert({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      create: { tenantId, platformAccountId, data, revision: 1 },
      update: { data, revision: { increment: 1 } },
      select: { data: true, revision: true, updatedAt: true },
    });
  }
}

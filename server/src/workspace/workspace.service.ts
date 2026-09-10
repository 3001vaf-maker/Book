import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, userId: string) {
    return this.prisma.workspaceState.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { data: true, revision: true, updatedAt: true },
    });
  }

  async save(tenantId: string, userId: string, data: Prisma.InputJsonValue) {
    return this.prisma.workspaceState.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, data, revision: 1 },
      update: { data, revision: { increment: 1 } },
      select: { data: true, revision: true, updatedAt: true },
    });
  }
}

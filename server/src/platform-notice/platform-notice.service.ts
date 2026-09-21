import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

@Injectable()
export class PlatformNoticeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, platformAccountId: string) {
    const rows = await this.prisma.platformNotice.findMany({
      where: { tenantId, platformAccountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata,
      readAt: row.readAt?.toISOString() || '',
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markRead(tenantId: string, platformAccountId: string, noticeId: string) {
    const row = await this.prisma.platformNotice.findUnique({ where: { id: noticeId } });
    if (!row || row.tenantId !== tenantId || row.platformAccountId !== platformAccountId) {
      throw new NotFoundException('Уведомление не найдено');
    }
    const updated = await this.prisma.platformNotice.update({
      where: { id: noticeId },
      data: { readAt: row.readAt || new Date() },
    });
    return {
      id: updated.id,
      readAt: updated.readAt?.toISOString() || '',
    };
  }

  async createForTenantOwner(
    tenantId: string,
    input: { type: string; title: string; body?: string; metadata?: unknown },
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { platformAccountId: true },
    });
    if (!membership) return null;
    return this.prisma.platformNotice.create({
      data: {
        tenantId,
        platformAccountId: membership.platformAccountId,
        type: input.type,
        title: input.title,
        body: input.body || '',
        metadata: json(input.metadata),
      },
    });
  }
}

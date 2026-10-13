import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type UnreadRow = {
  tenantId: string;
  unreadCount: number | bigint | string;
};

@Injectable()
export class AccountUnreadService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(accountId: string) {
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage" m
      SET "status" = 'delivered',
          "deliveredAt" = COALESCE(m."deliveredAt", CURRENT_TIMESTAMP)
      FROM "AccountTenantLink" l, "AccountContact" c
      WHERE l."accountId" = ${accountId}
        AND c."accountId" = ${accountId}
        AND c."type" = 'PHONE'
        AND l."tenantId" = m."tenantId"
        AND c."value" = m."personPhone"
        AND m."direction" = 'outbound'
        AND m."purpose" = 'DIRECT'
        AND m."readAt" IS NULL
        AND m."failedAt" IS NULL
        AND m."status" <> 'failed'
        AND m."deliveredAt" IS NULL
    `;

    const rows = await this.prisma.$queryRaw<UnreadRow[]>`
      SELECT m."tenantId", COUNT(*)::int AS "unreadCount"
      FROM "CommunicationMessage" m
      INNER JOIN "AccountTenantLink" l
        ON l."accountId" = ${accountId}
       AND l."tenantId" = m."tenantId"
      INNER JOIN "AccountContact" c
        ON c."accountId" = ${accountId}
       AND c."type" = 'PHONE'
       AND c."value" = m."personPhone"
      WHERE m."direction" = 'outbound'
        AND m."purpose" = 'DIRECT'
        AND m."readAt" IS NULL
        AND m."failedAt" IS NULL
        AND m."status" <> 'failed'
      GROUP BY m."tenantId"
      ORDER BY m."tenantId" ASC
    `;

    const byTenant = rows.map((row) => ({
      tenantId: String(row.tenantId || ''),
      unreadCount: Math.max(0, Number(row.unreadCount || 0)),
    })).filter((row) => row.tenantId && Number.isFinite(row.unreadCount));

    return {
      total: byTenant.reduce((sum, row) => sum + row.unreadCount, 0),
      byTenant,
    };
  }
}

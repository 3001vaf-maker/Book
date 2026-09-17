import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';

@Controller('platform/legal/acceptances')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformLegalAcceptanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.$queryRaw<Array<{
      id: string;
      tenantId: string | null;
      userId: string;
      action: string;
      source: string;
      occurredAt: Date;
      email: string;
      tenantName: string | null;
      documentKey: string;
      documentTitle: string;
      documentVersion: number;
      contentHash: string;
    }>>`
      SELECT e."id", e."tenantId", e."userId", e."action", e."source", e."occurredAt",
             u."email", t."name" AS "tenantName",
             d."key" AS "documentKey", d."title" AS "documentTitle",
             v."version" AS "documentVersion", v."contentHash"
      FROM "LegalAcceptanceEvent" e
      JOIN "User" u ON u."id" = e."userId"
      JOIN "LegalDocumentVersion" v ON v."id" = e."documentVersionId"
      JOIN "LegalDocument" d ON d."id" = v."documentId"
      LEFT JOIN "Tenant" t ON t."id" = e."tenantId"
      ORDER BY e."occurredAt" DESC
      LIMIT 500
    `;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DocumentRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  history() {
    return this.prisma.$queryRaw<Array<{
      id: string;
      tenantId: string | null;
      tenantName: string | null;
      userId: string;
      userEmail: string;
      documentKey: string;
      documentTitle: string;
      documentVersion: number;
      documentContent: string;
      action: string;
      source: string;
      technicalEvidence: unknown;
      occurredAt: Date;
    }>>`
      SELECT
        e."id",
        e."tenantId",
        t."name" AS "tenantName",
        e."userId",
        u."email" AS "userEmail",
        d."key" AS "documentKey",
        d."title" AS "documentTitle",
        v."version" AS "documentVersion",
        v."contentSnapshot" AS "documentContent",
        e."action",
        e."source",
        e."technicalEvidence",
        e."occurredAt"
      FROM "PlatformConsentEvent" e
      JOIN "PlatformDocumentVersion" v ON v."id" = e."documentVersionId"
      JOIN "PlatformDocument" d ON d."id" = v."documentId"
      JOIN "User" u ON u."id" = e."userId"
      LEFT JOIN "Tenant" t ON t."id" = e."tenantId"
      ORDER BY e."occurredAt" DESC, e."id" DESC
    `;
  }
}

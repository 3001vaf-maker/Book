import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DocumentRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  history() {
    return this.prisma.$queryRaw<Array<{
      id: string;
      subjectType: string;
      subjectId: string;
      tenantId: string | null;
      tenantName: string | null;
      platformAccountId: string;
      accountId: string;
      accountEmail: string;
      documentKey: string;
      documentTitle: string;
      documentVersion: number;
      documentContent: string;
      action: string;
      source: string;
      technicalEvidence: unknown;
      occurredAt: Date;
    }>>`
      SELECT *
      FROM (
        SELECT
          e."id",
          'PLATFORM_ACCOUNT'::text AS "subjectType",
          e."platformAccountId" AS "subjectId",
          e."tenantId",
          t."name" AS "tenantName",
          e."platformAccountId",
          ''::text AS "accountId",
          a."email" AS "accountEmail",
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
        JOIN "PlatformAccount" a ON a."id" = e."platformAccountId"
        LEFT JOIN "Tenant" t ON t."id" = e."tenantId"

        UNION ALL

        SELECT
          e."id",
          'ACCOUNT'::text AS "subjectType",
          e."accountId" AS "subjectId",
          NULL::text AS "tenantId",
          NULL::text AS "tenantName",
          ''::text AS "platformAccountId",
          e."accountId",
          a."email" AS "accountEmail",
          d."key" AS "documentKey",
          d."title" AS "documentTitle",
          v."version" AS "documentVersion",
          v."contentSnapshot" AS "documentContent",
          e."action",
          e."source",
          e."technicalEvidence",
          e."occurredAt"
        FROM "AccountDocumentEvent" e
        JOIN "PlatformDocumentVersion" v ON v."id" = e."documentVersionId"
        JOIN "PlatformDocument" d ON d."id" = v."documentId"
        JOIN "Account" a ON a."id" = e."accountId"
      ) history
      ORDER BY history."occurredAt" DESC, history."id" DESC
    `;
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  PLATFORM_DOCUMENT_CATALOG,
  TENANT_DOCUMENT_TEMPLATE_MAP,
  USER_DOCUMENT_BASE_KEYS,
} from './platform-document-catalog';

type DocumentRow = {
  id: string;
  key: string;
  type: string;
  title: string;
  requiredForRegistration: boolean;
  isActive: boolean;
};

type VersionRow = {
  id: string;
  documentId: string;
  version: number;
  contentSnapshot: string;
  contentHash: string;
  publishedAt: Date;
  supersededAt: Date | null;
};

function hashContent(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

@Injectable()
export class PlatformDocumentsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureCatalog();
  }

  async ensureCatalog() {
    for (const item of PLATFORM_DOCUMENT_CATALOG) {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<DocumentRow[]>`
          SELECT "id", "key", "type", "title", "requiredForRegistration", "isActive"
          FROM "LegalDocument"
          WHERE "scope" = 'PLATFORM' AND "tenantId" IS NULL AND "key" = ${item.key}
          LIMIT 1
        `;
        let document = rows[0] || null;
        if (!document) {
          const id = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "LegalDocument" (
              "id", "scope", "tenantId", "key", "type", "title",
              "requiredForRegistration", "requiredForLive", "requiredForPublicBooking",
              "isActive", "createdAt", "updatedAt"
            ) VALUES (
              ${id}, 'PLATFORM', NULL, ${item.key}, ${item.type}, ${item.title},
              ${item.requiredForRegistration}, false, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `;
          document = {
            id,
            key: item.key,
            type: item.type,
            title: item.title,
            requiredForRegistration: item.requiredForRegistration,
            isActive: true,
          };
        } else {
          await tx.$executeRaw`
            UPDATE "LegalDocument"
            SET "type" = ${item.type},
                "title" = ${item.title},
                "requiredForRegistration" = ${item.requiredForRegistration},
                "isActive" = true,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${document.id}
          `;
        }

        const currentRows = await tx.$queryRaw<VersionRow[]>`
          SELECT "id", "documentId", "version", "contentSnapshot", "contentHash", "publishedAt", "supersededAt"
          FROM "LegalDocumentVersion"
          WHERE "documentId" = ${document.id} AND "supersededAt" IS NULL
          ORDER BY "version" DESC
          LIMIT 1
        `;
        const current = currentRows[0] || null;
        const nextHash = hashContent(item.content);
        if (current?.contentHash === nextHash) return;

        const maxRows = await tx.$queryRaw<Array<{ version: number }>>`
          SELECT COALESCE(MAX("version"), 0)::int AS "version"
          FROM "LegalDocumentVersion"
          WHERE "documentId" = ${document.id}
        `;
        const nextVersion = Math.max(1, Number(maxRows[0]?.version || 0) + 1);

        if (current) {
          await tx.$executeRaw`
            UPDATE "LegalDocumentVersion"
            SET "supersededAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${current.id} AND "supersededAt" IS NULL
          `;
        }

        await tx.$executeRaw`
          INSERT INTO "LegalDocumentVersion" (
            "id", "documentId", "version", "contentSnapshot", "contentHash",
            "operatorIdentitySnapshot", "publishedAt", "supersededAt"
          ) VALUES (
            ${randomUUID()}, ${document.id}, ${nextVersion}, ${item.content}, ${nextHash},
            '{}'::jsonb, CURRENT_TIMESTAMP, NULL
          )
        `;
      });
    }
  }

  async documents() {
    await this.ensureCatalog();
    return this.prisma.$queryRaw<Array<{
      key: string;
      type: string;
      title: string;
      requiredForRegistration: boolean;
      version: number;
      content: string;
      publishedAt: Date;
    }>>`
      SELECT d."key", d."type", d."title", d."requiredForRegistration",
             v."version", v."contentSnapshot" AS "content", v."publishedAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v
        ON v."documentId" = d."id" AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM' AND d."tenantId" IS NULL AND d."isActive" = true
      ORDER BY d."createdAt" ASC, d."key" ASC
    `;
  }

  async userDocumentBases() {
    await this.ensureCatalog();
    const rows = await this.prisma.$queryRaw<Array<{
      key: string;
      title: string;
      version: number;
      content: string;
      publishedAt: Date;
    }>>`
      SELECT d."key", d."title", v."version", v."contentSnapshot" AS "content", v."publishedAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v
        ON v."documentId" = d."id" AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM'
        AND d."tenantId" IS NULL
        AND d."key" IN (
          'user-document-pdn-policy',
          'user-document-pdn-consent',
          'user-document-messages-consent'
        )
        AND d."isActive" = true
    `;
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return TENANT_DOCUMENT_TEMPLATE_MAP
      .map((mapping) => {
        const row = byKey.get(mapping.key);
        if (!row) return null;
        return {
          templateKey: mapping.key,
          documentId: mapping.documentId,
          kind: mapping.kind,
          clientConsent: mapping.clientConsent,
          required: mapping.required,
          title: row.title,
          templateVersion: Number(row.version || 1),
          templatePublishedAt: row.publishedAt,
          text: row.content,
        };
      })
      .filter(Boolean);
  }

  async acceptanceHistory() {
    return this.prisma.$queryRaw<Array<{
      id: string;
      tenantId: string | null;
      tenantName: string | null;
      userId: string;
      userEmail: string;
      documentKey: string;
      documentTitle: string;
      documentVersion: number;
      action: string;
      source: string;
      occurredAt: Date;
    }>>`
      SELECT e."id",
             e."tenantId",
             t."name" AS "tenantName",
             e."userId",
             u."email" AS "userEmail",
             d."key" AS "documentKey",
             d."title" AS "documentTitle",
             v."version" AS "documentVersion",
             e."action",
             e."source",
             e."occurredAt"
      FROM "LegalAcceptanceEvent" e
      JOIN "LegalDocumentVersion" v ON v."id" = e."documentVersionId"
      JOIN "LegalDocument" d ON d."id" = v."documentId"
      JOIN "User" u ON u."id" = e."userId"
      LEFT JOIN "Tenant" t ON t."id" = e."tenantId"
      WHERE d."scope" = 'PLATFORM'
      ORDER BY e."occurredAt" DESC, e."id" DESC
    `;
  }

  templateKeys() {
    return [...USER_DOCUMENT_BASE_KEYS];
  }
}

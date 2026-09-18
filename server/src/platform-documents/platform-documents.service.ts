import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type DocumentRow = {
  id: string;
  scope: string;
  tenantId: string | null;
  key: string;
  type: string;
  title: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DocumentVersionRow = {
  id: string;
  documentId: string;
  version: number;
  contentSnapshot: string;
  contentHash: string;
  operatorIdentitySnapshot: unknown;
  publishedAt: Date;
  supersededAt: Date | null;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function contentHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class PlatformDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const documents = await this.prisma.$queryRaw<DocumentRow[]>`
      SELECT "id", "scope", "tenantId", "key", "type", "title",
             "isActive", "createdAt", "updatedAt"
      FROM "LegalDocument"
      WHERE "scope" = 'PLATFORM'
        AND "tenantId" IS NULL
        AND "isActive" = true
      ORDER BY "createdAt" ASC, "key" ASC
    `;
    return Promise.all(documents.map(async (document) => ({
      ...document,
      currentVersion: await this.currentVersion(document.id),
    })));
  }

  async history() {
    return this.prisma.$queryRaw<any[]>`
      SELECT
        d."id" AS "documentId",
        d."key",
        d."type",
        d."title",
        v."id" AS "versionId",
        v."version",
        v."contentHash",
        v."publishedAt",
        v."supersededAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v ON v."documentId" = d."id"
      WHERE d."scope" = 'PLATFORM'
        AND d."tenantId" IS NULL
      ORDER BY v."publishedAt" DESC, d."title" ASC, v."version" DESC
    `;
  }

  async publish(input: Record<string, unknown>) {
    const key = text(input?.key).toLowerCase();
    const type = text(input?.type).toUpperCase();
    const title = text(input?.title);
    const content = String(input?.content ?? '').trim();
    const operatorIdentity = objectValue(input?.operatorIdentity);
    if (!key || !type || !title || !content) {
      throw new BadRequestException('Заполните key, type, title и content документа');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw<DocumentRow[]>`
        SELECT "id", "scope", "tenantId", "key", "type", "title",
               "isActive", "createdAt", "updatedAt"
        FROM "LegalDocument"
        WHERE "scope" = 'PLATFORM' AND "tenantId" IS NULL AND "key" = ${key}
        LIMIT 1 FOR UPDATE
      `;

      let document = existingRows[0];
      if (!document) {
        const documentId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "LegalDocument" (
            "id", "scope", "tenantId", "key", "type", "title",
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            ${documentId}, 'PLATFORM', NULL, ${key}, ${type}, ${title},
            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        document = {
          id: documentId,
          scope: 'PLATFORM',
          tenantId: null,
          key,
          type,
          title,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        await tx.$executeRaw`
          UPDATE "LegalDocument"
          SET "type" = ${type},
              "title" = ${title},
              "isActive" = true,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${document.id}
        `;
      }

      const versions = await tx.$queryRaw<Array<{ version: number }>>`
        SELECT "version"
        FROM "LegalDocumentVersion"
        WHERE "documentId" = ${document.id}
        ORDER BY "version" DESC
        LIMIT 1
      `;
      const version = Number(versions[0]?.version || 0) + 1;
      const versionId = randomUUID();

      await tx.$executeRaw`
        UPDATE "LegalDocumentVersion"
        SET "supersededAt" = CURRENT_TIMESTAMP
        WHERE "documentId" = ${document.id}
          AND "supersededAt" IS NULL
      `;

      await tx.$executeRaw`
        INSERT INTO "LegalDocumentVersion" (
          "id", "documentId", "version", "contentSnapshot", "contentHash",
          "operatorIdentitySnapshot", "publishedAt", "supersededAt"
        ) VALUES (
          ${versionId}, ${document.id}, ${version}, ${content}, ${contentHash(content)},
          ${json(operatorIdentity)}::jsonb, CURRENT_TIMESTAMP, NULL
        )
      `;

      return { documentId: document.id, versionId, version };
    });

    return {
      ...result,
      documents: await this.list(),
    };
  }

  private async currentVersion(documentId: string) {
    const rows = await this.prisma.$queryRaw<DocumentVersionRow[]>`
      SELECT "id", "documentId", "version", "contentSnapshot", "contentHash",
             "operatorIdentitySnapshot", "publishedAt", "supersededAt"
      FROM "LegalDocumentVersion"
      WHERE "documentId" = ${documentId}
        AND "supersededAt" IS NULL
      ORDER BY "version" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }
}

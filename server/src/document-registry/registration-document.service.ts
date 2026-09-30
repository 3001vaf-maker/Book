import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function arrayValue(value: unknown): any[] { return Array.isArray(value) ? value : []; }
function text(value: unknown) { return String(value ?? '').trim(); }

@Injectable()
export class RegistrationDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async documents() {
    const rows = await this.prisma.$queryRaw<Array<{
      documentId: string;
      documentVersionId: string;
      key: string;
      type: string;
      title: string;
      requiredForRegistration: boolean;
      version: number;
      contentSnapshot: string;
      publishedAt: Date;
    }>>`
      SELECT
        d."id" AS "documentId",
        v."id" AS "documentVersionId",
        d."key",
        d."type",
        d."title",
        d."requiredForRegistration",
        v."version",
        v."contentSnapshot",
        v."publishedAt"
      FROM "PlatformDocument" d
      JOIN LATERAL (
        SELECT *
        FROM "PlatformDocumentVersion"
        WHERE "documentId" = d."id"
        ORDER BY "version" DESC, "publishedAt" DESC
        LIMIT 1
      ) v ON true
      WHERE d."isActive" = true
        AND (d."requiredForRegistration" = true OR d."key" = 'marketing-consent')
      ORDER BY d."requiredForRegistration" DESC, d."createdAt" ASC, d."key" ASC
    `;

    if (!rows.some((row) => row.requiredForRegistration)) {
      throw new ConflictException('Обязательные регистрационные документы Реестра не подготовлены');
    }

    return rows.map((row) => ({
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      key: row.key,
      type: row.type,
      title: row.title,
      required: Boolean(row.requiredForRegistration),
      optionalMarketing: row.key === 'marketing-consent',
      version: row.version,
      content: row.contentSnapshot,
      publishedAt: row.publishedAt.toISOString(),
    }));
  }

  async validate(factsValue: unknown) {
    const documents = await this.documents();
    const facts = arrayValue(factsValue).map((value) => objectValue(value));
    const byKey = new Map(facts.map((fact) => [text(fact.key), fact]));

    for (const document of documents.filter((item) => item.required)) {
      const fact = byKey.get(document.key);
      if (!fact || fact.accepted !== true || Number(fact.version || 0) !== document.version) {
        throw new BadRequestException(`Необходимо подтвердить документ «${document.title}» актуальной версии`);
      }
    }

    return documents.map((document) => {
      const fact = byKey.get(document.key);
      const accepted = fact?.accepted === true && Number(fact?.version || 0) === document.version;
      return {
        ...document,
        accepted,
        action: document.optionalMarketing
          ? (accepted ? 'CONSENTED' : 'DECLINED')
          : document.type.includes('CONSENT')
            ? 'CONSENTED'
            : document.type.includes('POLICY')
              ? 'ACKNOWLEDGED'
              : 'ACCEPTED',
      };
    });
  }
}

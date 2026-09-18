import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type ConsentEventRow = {
  id: string;
  subjectType: string;
  subjectKey: string;
  contactType: string;
  contactValue: string;
  documentId: string;
  documentVersion: number;
  status: string;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  source: string;
  occurredAt: Date;
  migratedFromEventId: string;
  createdAt: Date;
};

const MUTABLE_DATASETS = new Set(['documents', 'history']);

const USER_DOCUMENT_BASE_KEYS = [
  { key: 'user-document-pdn-policy', documentId: 'pdn-agreement' },
  { key: 'user-document-pdn-consent', documentId: 'pdn-consent' },
  { key: 'user-document-messages-consent', documentId: 'messages-consent' },
] as const;


function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value: unknown) {
  const source = objectValue(value);
  return {
    documents: Array.isArray(source.documents) ? clone(source.documents) : [],
    consents: Array.isArray(source.consents) ? clone(source.consents) : [],
    history: Array.isArray(source.history) ? clone(source.history) : [],
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: unknown) {
  return JSON.stringify(stable(normalize(value)));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function publicConsentEvent(row: ConsentEventRow) {
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectKey: row.subjectKey,
    contactType: row.contactType,
    contactValue: row.contactValue,
    documentId: row.documentId,
    documentVersion: row.documentVersion,
    status: row.status,
    acceptedAt: row.acceptedAt?.toISOString() || '',
    revokedAt: row.revokedAt?.toISOString() || '',
    source: row.source,
    eventAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    migratedFromEventId: row.migratedFromEventId,
  };
}

@Injectable()
export class DocumentStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async canonicalConsentEvents(tenantId: string) {
    const rows = await this.prisma.$queryRaw<ConsentEventRow[]>`
      SELECT "id", "subjectType", "subjectKey", "contactType", "contactValue", "documentId",
             "documentVersion", "status", "acceptedAt", "revokedAt", "source", "occurredAt",
             "migratedFromEventId", "createdAt"
      FROM "ConsentEvent"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "occurredAt" ASC, "createdAt" ASC, "id" ASC
    `;
    return rows.map(publicConsentEvent);
  }

  private async snapshot(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    const data = normalize(state?.data || {});
    if (state?.migrationVerifiedAt) data.consents = await this.canonicalConsentEvents(tenantId);
    else data.consents = [];
    return {
      migrated: Boolean(state),
      verified: Boolean(state?.migrationVerifiedAt),
      migrationVerifiedAt: state?.migrationVerifiedAt || null,
      data,
    };
  }

  get(tenantId: string) {
    return this.snapshot(tenantId);
  }

  async userDocumentBases() {
    const rows = await this.prisma.$queryRaw<Array<{
      key: string;
      title: string;
      version: number;
      contentSnapshot: string;
      publishedAt: Date;
    }>>`
      SELECT d."key", d."title", v."version", v."contentSnapshot", v."publishedAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v
        ON v."documentId" = d."id"
       AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM'
        AND d."tenantId" IS NULL
        AND d."key" IN (
          'user-document-pdn-policy',
          'user-document-pdn-consent',
          'user-document-messages-consent'
        )
        AND d."isActive" = true
      ORDER BY d."key" ASC
    `;
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return USER_DOCUMENT_BASE_KEYS
      .map((item) => {
        const row = byKey.get(item.key);
        if (!row) return null;
        return {
          key: item.key,
          documentId: item.documentId,
          title: row.title,
          version: Number(row.version || 1),
          text: String(row.contentSnapshot || ''),
          publishedAt: row.publishedAt,
        };
      })
      .filter(Boolean);
  }


  async migrate(tenantId: string, body: unknown) {
    const existing = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessDocumentState.create({ data: { tenantId, data: json(normalize(body)) } });
    }
    return this.snapshot(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const current = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!current) throw new ConflictException('Документы ещё не перенесены');
    if (canonical(current.data) !== canonical(body)) throw new ConflictException('Проверка переноса документов не пройдена');
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.snapshot(tenantId);
  }

  async bootstrap(tenantId: string, body: unknown) {
    const existing = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessDocumentState.create({
        data: { tenantId, data: json(normalize(body)), migrationVerifiedAt: new Date() },
      });
    } else if (!existing.migrationVerifiedAt) {
      await this.prisma.businessDocumentState.update({
        where: { tenantId },
        data: { migrationVerifiedAt: new Date() },
      });
    }
    return this.snapshot(tenantId);
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    if (dataset === 'consents') {
      throw new BadRequestException('Согласия являются append-only событиями Documents и не заменяются набором');
    }
    if (!MUTABLE_DATASETS.has(dataset)) throw new BadRequestException('Неизвестный раздел документов');
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Перенос документов ещё не подтверждён');
    const current = normalize(state.data);
    const source = objectValue(body);
    const value = source.value;
    current[dataset as 'documents' | 'history'] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return { dataset, value: current[dataset as 'documents' | 'history'] };
  }

  async publicDocuments(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    return normalize(state.data).documents;
  }
}

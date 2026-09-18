import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PlatformDocumentsService } from '../platform-documents/platform-documents.service';

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
  subjectLabel: string;
};

const MUTABLE_DATASETS = new Set(['documents', 'history']);




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
    subjectLabel: row.subjectLabel,
  };
}

@Injectable()
export class DocumentStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformDocuments: PlatformDocumentsService,
  ) {}

  private async canonicalConsentEvents(tenantId: string) {
    const rows = await this.prisma.$queryRaw<ConsentEventRow[]>`
      SELECT e."id", e."subjectType", e."subjectKey", e."contactType", e."contactValue", e."documentId",
             e."documentVersion", e."status", e."acceptedAt", e."revokedAt", e."source", e."occurredAt",
             e."migratedFromEventId", e."createdAt",
             CASE
               WHEN e."subjectType" = 'BOOKING_ACCOUNT' THEN COALESCE(
                 NULLIF(TRIM(CONCAT(COALESCE(a."name", ''), ' ', COALESCE(a."surname", ''))), ''),
                 NULLIF(a."email", ''),
                 NULLIF(a."phone", ''),
                 e."subjectKey"
               )
               WHEN e."contactValue" <> '' THEN e."contactValue"
               ELSE e."subjectKey"
             END AS "subjectLabel"
      FROM "ConsentEvent" e
      LEFT JOIN "BookingAccount" a
        ON e."subjectType" = 'BOOKING_ACCOUNT'
       AND a."tenantId" = e."tenantId"
       AND a."id" = e."subjectKey"
      WHERE e."tenantId" = ${tenantId}
      ORDER BY e."occurredAt" ASC, e."createdAt" ASC, e."id" ASC
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

  userDocumentBases() {
    return this.platformDocuments.userDocumentBases();
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

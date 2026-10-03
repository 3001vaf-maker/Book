import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type TenantConsentEventRow = {
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
  createdAt: Date;
};

const MUTABLE_DATASETS = new Set(['documents', 'history']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function isCanonicalRknGuide(item: any, templateKey = '') {
  const attachment = objectValue(item?.attachment);
  return (
    attachment.type === 'RKN_GUIDE_PDF'
    && Boolean(text(attachment.templateKey))
    && Number(attachment.templateVersion || 0) > 0
    && Boolean(text(attachment.sourceHash))
    && Boolean(text(attachment.pdfBase64))
    && (!templateKey || text(attachment.templateKey) === templateKey)
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value: unknown) {
  const source = objectValue(value);
  return {
    documents: Array.isArray(source.documents) ? clone(source.documents) : [],
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

function publicConsentEvent(row: TenantConsentEventRow) {
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
  };
}

@Injectable()
export class TenantDocumentArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  private async canonicalConsentEvents(tenantId: string) {
    const rows = await this.prisma.$queryRaw<TenantConsentEventRow[]>`
      SELECT "id", "subjectType", "subjectKey", "contactType", "contactValue", "documentId",
             "documentVersion", "status", "acceptedAt", "revokedAt", "source", "occurredAt",
             "createdAt"
      FROM "TenantConsentEvent"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "occurredAt" ASC, "createdAt" ASC, "id" ASC
    `;
    return rows.map(publicConsentEvent);
  }

  private async snapshot(tenantId: string) {
    const state = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    const stored = normalize(state?.data || {});
    const consents = state?.migrationVerifiedAt ? await this.canonicalConsentEvents(tenantId) : [];

    return {
      migrated: Boolean(state),
      verified: Boolean(state?.migrationVerifiedAt),
      migrationVerifiedAt: state?.migrationVerifiedAt || null,
      data: { ...stored, consents },
    };
  }

  get(tenantId: string) {
    return this.snapshot(tenantId);
  }

  async migrate(tenantId: string, body: unknown) {
    const existing = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.tenantDocumentArchive.create({ data: { tenantId, data: json(normalize(body)) } });
    }
    return this.snapshot(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const current = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!current) throw new ConflictException('Документы ещё не перенесены');
    if (canonical(current.data) !== canonical(body)) throw new ConflictException('Проверка переноса документов не пройдена');
    await this.prisma.tenantDocumentArchive.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.snapshot(tenantId);
  }

  async bootstrap(tenantId: string, body: unknown) {
    const existing = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.tenantDocumentArchive.create({
        data: { tenantId, data: json(normalize(body)), migrationVerifiedAt: new Date() },
      });
    }
    return this.snapshot(tenantId);
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    if (!MUTABLE_DATASETS.has(dataset)) throw new BadRequestException('Неизвестный раздел Архива документов');
    const state = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Перенос документов ещё не подтверждён');
    const current = normalize(state.data);
    const source = objectValue(body);
    const value = source.value;
    current[dataset as keyof typeof current] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.tenantDocumentArchive.update({ where: { tenantId }, data: { data: json(current) } });
    return { dataset, value: current[dataset as keyof typeof current] };
  }

  async saveRknGuide(tenantId: string, inputValue: unknown) {
    const state = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Архив документов ещё не готов');

    const current = normalize(state.data);

    let legacyChanged = false;
    current.documents = current.documents.map((item: any) => {
      const attachment = objectValue(item?.attachment);
      if (
        attachment.type === 'RKN_GUIDE_PDF'
        && !isCanonicalRknGuide(item)
        && !attachment.legacyFormat
      ) {
        legacyChanged = true;
        return {
          ...item,
          title: item?.title || 'Старая инструкция РКН',
          documentClass: 'FILE',
          signable: false,
          attachment: {
            ...attachment,
            legacyFormat: 'PRE_REGISTRY_TEMPLATE',
          },
        };
      }
      return item;
    });

    const input = objectValue(inputValue);
    const snapshot = objectValue(input.snapshot);
    const templateKey = String(input.templateKey || '').trim();
    const templateVersion = Number(input.templateVersion || 0);
    const templateContent = String(input.templateContent || '');
    const personalizedContent = String(input.personalizedContent || '');
    const pdfBase64 = String(input.pdfBase64 || '');
    const guideMode = String(input.guideMode || '').toUpperCase() === 'UPDATE' ? 'UPDATE' : 'INITIAL';
    if (!templateKey || !templateVersion || !templateContent || !personalizedContent || !pdfBase64) {
      throw new BadRequestException('Персональная инструкция РКН сформирована не полностью');
    }

    const source = { templateKey, templateVersion, templateContent, snapshot, guideMode };
    const sourceHash = createHash('sha256').update(JSON.stringify(stable(source)), 'utf8').digest('hex');
    const existing = current.documents.find((item: any) => (
      isCanonicalRknGuide(item, templateKey)
      && item?.attachment?.sourceHash === sourceHash
    ));
    if (existing) {
      if (legacyChanged) {
        await this.prisma.tenantDocumentArchive.update({
          where: { tenantId },
          data: { data: json(current) },
        });
      }
      return clone(existing);
    }

    const generatedAt = new Date().toISOString();
    const title = guideMode === 'INITIAL'
      ? 'Инструкция по уведомлению Роскомнадзора'
      : 'Инструкция по изменению сведений Роскомнадзора';
    const document = {
      id: `rkn-guide-${randomUUID()}`,
      system: true,
      kind: 'instruction',
      documentClass: 'FILE',
      signable: false,
      title,
      personConsent: false,
      required: false,
      version: 1,
      text: personalizedContent,
      sourceMode: 'BOOK',
      baseKey: templateKey,
      baseVersion: templateVersion,
      attachment: {
        type: 'RKN_GUIDE_PDF',
        guideMode,
        fileName: guideMode === 'INITIAL'
          ? 'rkn-guide-initial.pdf'
          : `rkn-guide-update-${generatedAt.slice(0, 10)}.pdf`,
        mimeType: 'application/pdf',
        generatedAt,
        templateKey,
        templateVersion,
        sourceHash,
        snapshot: clone(snapshot),
        pdfBase64,
      },
    };
    current.documents.push(document);

    await this.prisma.tenantDocumentArchive.update({
      where: { tenantId },
      data: { data: json(current) },
    });
    return clone(document);
  }

  async rknGuideDocument(tenantId: string, documentId: string) {
    const state = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Архив документов ещё не готов');
    const document = normalize(state.data).documents.find((item: any) => (
      String(item?.id || '') === documentId
      && item?.attachment?.type === 'RKN_GUIDE_PDF'
    ));
    if (!document) throw new NotFoundException('Инструкция РКН не найдена');
    const attachment = objectValue(document?.attachment);
    if (
      attachment.legacyFormat === 'PRE_REGISTRY_TEMPLATE'
      || !isCanonicalRknGuide(document)
    ) {
      throw new ConflictException('Это старый тестовый PDF-помощник РКН. Он не относится к текущему формату файлов.');
    }
    return clone(document);
  }

  async publicDocuments(tenantId: string) {
    const state = await this.prisma.tenantDocumentArchive.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    return normalize(state.data).documents;
  }

}

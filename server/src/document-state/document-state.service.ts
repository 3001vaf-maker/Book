import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
const DATASETS = new Set(['documents', 'consents', 'history']);

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

@Injectable()
export class DocumentStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async snapshot(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    return {
      migrated: Boolean(state),
      verified: Boolean(state?.migrationVerifiedAt),
      migrationVerifiedAt: state?.migrationVerifiedAt || null,
      data: normalize(state?.data || {}),
    };
  }

  get(tenantId: string) {
    return this.snapshot(tenantId);
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
    }
    return this.snapshot(tenantId);
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    if (!DATASETS.has(dataset)) throw new BadRequestException('Неизвестный раздел документов');
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Перенос документов ещё не подтверждён');
    const current = normalize(state.data);
    const source = objectValue(body);
    const value = source.value;
    current[dataset as keyof typeof current] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return { dataset, value: current[dataset as keyof typeof current] };
  }

  async publicDocuments(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    return normalize(state.data).documents;
  }

  async recordAcceptedConsents(tenantId: string, clientId: string, facts: unknown) {
    const id = String(clientId || '').trim();
    if (!id) return [];
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    const current = normalize(state.data);
    const accepted = (Array.isArray(facts) ? facts : []).filter((item: any) => Boolean(item?.accepted) && String(item?.documentId || '').trim());
    if (!accepted.length) return current.consents;
    const next = [...current.consents];
    for (const fact of accepted as any[]) {
      const documentId = String(fact.documentId || '').trim();
      const documentVersion = Math.max(1, Number(fact.documentVersion || 1));
      const exists = next.some((item: any) => String(item?.clientId || '') === id
        && String(item?.documentId || '') === documentId
        && Number(item?.documentVersion || 1) === documentVersion
        && String(item?.status || 'accepted') === 'accepted');
      if (exists) continue;
      const now = new Date().toISOString();
      next.push({
        id: randomUUID(),
        clientId: id,
        documentId,
        documentVersion,
        status: 'accepted',
        acceptedAt: String(fact.acceptedAt || now),
        revokedAt: '',
        source: 'online-booking-account',
        createdAt: now,
      });
    }
    current.consents = next;
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return next;
  }

}

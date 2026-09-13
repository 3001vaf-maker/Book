import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
const DATASETS = new Set(['documents', 'consents', 'history']);
const CONSENT_STATUSES = new Set(['accepted', 'revoked', 'declined']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
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

function eventStatus(value: unknown) {
  const status = text(value).toLowerCase();
  return CONSENT_STATUSES.has(status) ? status : 'accepted';
}

function eventMoment(event: any) {
  return text(event?.revokedAt || event?.acceptedAt || event?.createdAt);
}

function eventTime(event: any) {
  const parsed = Date.parse(eventMoment(event));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortEventsNewest(events: any[]) {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => eventTime(b.event) - eventTime(a.event) || b.index - a.index)
    .map(({ event }) => event);
}

function latestEvent(events: any[], clientId: string, documentId: string) {
  return sortEventsNewest(events.filter((event) => text(event?.clientId) === clientId && text(event?.documentId) === documentId))[0] || null;
}

function normalizeEvent(event: any) {
  const status = eventStatus(event?.status);
  const now = new Date().toISOString();
  const acceptedAt = status === 'accepted' ? text(event?.acceptedAt || event?.createdAt || now) : text(event?.acceptedAt);
  const revokedAt = status === 'revoked' ? text(event?.revokedAt || event?.createdAt || now) : text(event?.revokedAt);
  return {
    id: text(event?.id) || randomUUID(),
    clientId: text(event?.clientId),
    documentId: text(event?.documentId),
    documentVersion: Math.max(1, Number(event?.documentVersion || 1)),
    status,
    acceptedAt,
    revokedAt,
    source: text(event?.source) || 'manual',
    createdAt: text(event?.createdAt) || eventMoment({ acceptedAt, revokedAt }) || now,
  };
}

@Injectable()
export class DocumentStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifiedState(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы ещё не готовы');
    return { state, data: normalize(state.data) };
  }

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
    const { data: current } = await this.verifiedState(tenantId);
    const source = objectValue(body);
    const value = Array.isArray(source.value) ? clone(source.value) : [];

    if (dataset === 'consents') {
      const existing = current.consents.map(normalizeEvent).filter((event) => event.clientId && event.documentId);
      const ids = new Set(existing.map((event) => event.id));
      for (const raw of value) {
        const event = normalizeEvent(raw);
        if (!event.clientId || !event.documentId || ids.has(event.id)) continue;
        ids.add(event.id);
        existing.push(event);
      }
      current.consents = existing;
    } else {
      current[dataset as keyof typeof current] = value;
    }

    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return { dataset, value: current[dataset as keyof typeof current] };
  }

  async publicDocuments(tenantId: string) {
    const { data } = await this.verifiedState(tenantId);
    return data.documents;
  }

  async recordConsentEvents(tenantId: string, clientId: string, facts: unknown, source = 'online-booking') {
    const id = text(clientId);
    if (!id) return [];
    const { data: current } = await this.verifiedState(tenantId);
    const events = current.consents.map(normalizeEvent).filter((event) => event.clientId && event.documentId);
    let changed = false;

    for (const raw of Array.isArray(facts) ? facts : []) {
      const fact = objectValue(raw);
      const documentId = text(fact.documentId);
      if (!documentId) continue;
      const explicitStatus = text(fact.status || fact.action).toLowerCase();
      const status = CONSENT_STATUSES.has(explicitStatus)
        ? explicitStatus
        : fact.accepted === true ? 'accepted' : '';
      if (!status) continue;

      const documentVersion = Math.max(1, Number(fact.documentVersion || 1));
      const now = new Date().toISOString();
      const acceptedAt = status === 'accepted' ? text(fact.acceptedAt) || now : text(fact.acceptedAt);
      const revokedAt = status === 'revoked' ? text(fact.revokedAt) || now : text(fact.revokedAt);
      const incomingMoment = Date.parse(revokedAt || acceptedAt || now);
      const latest = latestEvent(events, id, documentId);

      if (latest && latest.status === status && Number(latest.documentVersion || 1) === documentVersion) continue;
      if (status === 'accepted' && latest?.status === 'revoked' && Number.isFinite(incomingMoment) && incomingMoment <= eventTime(latest)) continue;

      const event = normalizeEvent({
        id: randomUUID(),
        clientId: id,
        documentId,
        documentVersion,
        status,
        acceptedAt,
        revokedAt,
        source: text(fact.source) || source,
        createdAt: now,
      });
      events.push(event);
      changed = true;
    }

    if (changed) {
      current.consents = events;
      await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    }
    return events;
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

  async revokeConsent(tenantId: string, clientId: string, documentId: string, source = 'manual') {
    const documents = await this.publicDocuments(tenantId);
    const document = documents.find((item: any) => text(item?.id) === text(documentId));
    if (!document) throw new BadRequestException('Документ не найден');
    return this.recordConsentEvents(tenantId, clientId, [{
      documentId: text(document.id),
      documentVersion: Math.max(1, Number(document.version || 1)),
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      source,
    }], source);
  }

  async clientConsentProjection(tenantId: string, clientId: string) {
    const id = text(clientId);
    const { data } = await this.verifiedState(tenantId);
    const events = data.consents.map(normalizeEvent).filter((event) => event.clientId && event.documentId);
    return data.documents
      .filter((document: any) => Boolean(document?.clientConsent))
      .map((document: any) => {
        const documentId = text(document.id);
        const documentVersion = Math.max(1, Number(document.version || 1));
        const latest = latestEvent(events, id, documentId);
        const accepted = Boolean(latest && latest.status === 'accepted' && Number(latest.documentVersion || 1) === documentVersion);
        return {
          documentId,
          documentVersion,
          title: text(document.title) || 'Документ',
          required: Boolean(document.required),
          status: latest?.status || 'missing',
          accepted,
          eventAt: latest ? eventMoment(latest) : '',
          source: latest?.source || '',
          eventId: latest?.id || '',
        };
      });
  }

  async requiredConsentState(tenantId: string, clientId: string) {
    const consents = await this.clientConsentProjection(tenantId, clientId);
    const required = consents.filter((item) => item.required);
    const missing = required.filter((item) => !item.accepted);
    return { allowed: missing.length === 0, required, missing, consents };
  }

  async canSendMessages(tenantId: string, clientId: string) {
    const consents = await this.clientConsentProjection(tenantId, clientId);
    return Boolean(consents.find((item) => item.documentId === 'messages-consent')?.accepted);
  }

  async consentReport(tenantId: string) {
    const { data } = await this.verifiedState(tenantId);
    const titles = new Map(data.documents.map((document: any) => [text(document?.id), text(document?.title) || 'Документ']));
    const events = data.consents.map(normalizeEvent).filter((event) => event.clientId && event.documentId);
    const latestIds = new Map<string, string>();
    for (const event of sortEventsNewest(events)) {
      const key = `${event.clientId}:${event.documentId}`;
      if (!latestIds.has(key)) latestIds.set(key, event.id);
    }
    return sortEventsNewest(events).map((event) => ({
      ...event,
      documentTitle: titles.get(event.documentId) || event.documentId,
      eventAt: eventMoment(event),
      current: latestIds.get(`${event.clientId}:${event.documentId}`) === event.id,
    }));
  }
}

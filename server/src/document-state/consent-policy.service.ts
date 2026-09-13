import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DocumentStateService } from './document-state.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function contactType(value: unknown) {
  const type = text(value).toUpperCase();
  return ['PHONE', 'EMAIL', 'TELEGRAM', 'SMS', 'WHATSAPP'].includes(type) ? type : '';
}

function contactValue(typeValue: unknown, value: unknown) {
  const type = contactType(typeValue);
  if (type === 'PHONE' || type === 'SMS' || type === 'WHATSAPP') return canonicalPhone(value);
  if (type === 'EMAIL') return text(value).toLowerCase();
  return text(value);
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
    .sort((left, right) => eventTime(right.event) - eventTime(left.event) || right.index - left.index)
    .map(({ event }) => event);
}

function latestLegacyEvent(events: any[], clientId: string, documentId: string) {
  return sortEventsNewest(events.filter((event) => text(event?.clientId) === clientId && text(event?.documentId) === documentId))[0] || null;
}

function latestContactEvent(events: any[], typeValue: unknown, value: unknown, documentId: string) {
  const type = contactType(typeValue);
  const normalizedValue = contactValue(type, value);
  if (!type || !normalizedValue) return null;
  return sortEventsNewest(events.filter((event) => contactType(event?.contactType) === type
    && contactValue(type, event?.contactValue) === normalizedValue
    && text(event?.documentId) === documentId))[0] || null;
}

@Injectable()
export class ConsentPolicyService {
  constructor(private readonly documents: DocumentStateService) {}

  private async state(tenantId: string) {
    const snapshot = await this.documents.get(tenantId);
    if (!snapshot?.verified) throw new ConflictException('Документы ещё не готовы');
    const data = snapshot.data || {};
    return {
      documents: Array.isArray(data.documents) ? data.documents : [],
      consents: Array.isArray(data.consents) ? data.consents : [],
    };
  }

  async acceptConsents(tenantId: string, clientId: string, facts: unknown) {
    return this.documents.recordAcceptedConsents(tenantId, clientId, facts);
  }

  async acceptContactPointConsent(
    tenantId: string,
    clientId: string,
    typeValue: unknown,
    value: unknown,
    documentId = 'messages-consent',
    source = 'manual',
  ) {
    const type = contactType(typeValue);
    const normalizedValue = contactValue(type, value);
    const id = text(clientId);
    const targetDocumentId = text(documentId);
    if (!type || !normalizedValue || !targetDocumentId) throw new BadRequestException('Не указан Contact Point или документ');

    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === targetDocumentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const documentVersion = Math.max(1, Number(document.version || 1));
    const latest = latestContactEvent(current.consents, type, normalizedValue, targetDocumentId);
    if (latest && text(latest?.status) === 'accepted' && Number(latest?.documentVersion || 1) === documentVersion) return latest;

    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      clientId: id,
      contactType: type,
      contactValue: normalizedValue,
      documentId: targetDocumentId,
      documentVersion,
      status: 'accepted',
      acceptedAt: now,
      revokedAt: '',
      source: text(source) || 'manual',
      createdAt: now,
    };
    await this.documents.updateDataset(tenantId, 'consents', { value: [...clone(current.consents), event] });
    return event;
  }

  async revokeContactPointConsent(
    tenantId: string,
    clientId: string,
    typeValue: unknown,
    value: unknown,
    documentId = 'messages-consent',
    source = 'manual',
  ) {
    const type = contactType(typeValue);
    const normalizedValue = contactValue(type, value);
    const targetDocumentId = text(documentId);
    if (!type || !normalizedValue || !targetDocumentId) throw new BadRequestException('Не указан Contact Point или документ');

    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === targetDocumentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      clientId: text(clientId),
      contactType: type,
      contactValue: normalizedValue,
      documentId: targetDocumentId,
      documentVersion: Math.max(1, Number(document.version || 1)),
      status: 'revoked',
      acceptedAt: '',
      revokedAt: now,
      source: text(source) || 'manual',
      createdAt: now,
    };
    await this.documents.updateDataset(tenantId, 'consents', { value: [...clone(current.consents), event] });
    return event;
  }

  async contactPointConsentState(tenantId: string, typeValue: unknown, value: unknown, documentId = 'messages-consent') {
    const type = contactType(typeValue);
    const normalizedValue = contactValue(type, value);
    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === text(documentId));
    if (!type || !normalizedValue || !document) return { allowed: false, contactType: type, contactValue: normalizedValue, event: null };
    const latest = latestContactEvent(current.consents, type, normalizedValue, text(documentId));
    const allowed = Boolean(latest
      && text(latest?.status) === 'accepted'
      && Number(latest?.documentVersion || 1) === Math.max(1, Number(document.version || 1)));
    return { allowed, contactType: type, contactValue: normalizedValue, event: latest };
  }

  async revokeConsent(tenantId: string, clientId: string, documentId: string, source = 'manual') {
    const id = text(clientId);
    const targetDocumentId = text(documentId);
    if (!id || !targetDocumentId) throw new BadRequestException('Не указан клиент или документ');

    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === targetDocumentId);
    if (!document) throw new BadRequestException('Документ не найден');

    const now = new Date().toISOString();
    const next = [
      ...clone(current.consents),
      {
        id: randomUUID(),
        clientId: id,
        documentId: targetDocumentId,
        documentVersion: Math.max(1, Number(document.version || 1)),
        status: 'revoked',
        acceptedAt: '',
        revokedAt: now,
        source: text(source) || 'manual',
        createdAt: now,
      },
    ];
    await this.documents.updateDataset(tenantId, 'consents', { value: next });
    return next;
  }

  async clientConsentProjection(tenantId: string, clientId: string) {
    const id = text(clientId);
    const current = await this.state(tenantId);
    return current.documents
      .filter((document: any) => Boolean(document?.clientConsent))
      .map((document: any) => {
        const documentId = text(document?.id);
        const documentVersion = Math.max(1, Number(document?.version || 1));
        const latest = latestLegacyEvent(current.consents, id, documentId);
        const status = text(latest?.status) || 'missing';
        const accepted = Boolean(latest && status === 'accepted' && Number(latest?.documentVersion || 1) === documentVersion);
        return {
          documentId,
          documentVersion,
          title: text(document?.title) || 'Документ',
          required: Boolean(document?.required),
          status,
          accepted,
          eventAt: latest ? eventMoment(latest) : '',
          source: text(latest?.source),
          eventId: text(latest?.id),
        };
      });
  }

  async requiredConsentState(tenantId: string, clientId: string) {
    const consents = await this.clientConsentProjection(tenantId, clientId);
    const required = consents.filter((item) => item.required);
    const missing = required.filter((item) => !item.accepted);
    return { allowed: missing.length === 0, required, missing, consents };
  }

  async canSendMessages(tenantId: string, typeValue: unknown, value: unknown) {
    return (await this.contactPointConsentState(tenantId, typeValue, value, 'messages-consent')).allowed;
  }

  async consentReport(tenantId: string) {
    const current = await this.state(tenantId);
    const titles = new Map(current.documents.map((document: any) => [text(document?.id), text(document?.title) || 'Документ']));
    const latestIds = new Map<string, string>();
    for (const event of sortEventsNewest(current.consents)) {
      const clientId = text(event?.clientId);
      const documentId = text(event?.documentId);
      const type = contactType(event?.contactType);
      const value = contactValue(type, event?.contactValue);
      if (!documentId) continue;
      const subject = type && value ? `contact:${type}:${value}` : `client:${clientId}`;
      if (!subject || subject === 'client:') continue;
      const key = `${subject}:${documentId}`;
      if (!latestIds.has(key)) latestIds.set(key, text(event?.id));
    }
    return sortEventsNewest(current.consents).map((event) => {
      const type = contactType(event?.contactType);
      const value = contactValue(type, event?.contactValue);
      const subject = type && value ? `contact:${type}:${value}` : `client:${text(event?.clientId)}`;
      return {
        ...event,
        documentTitle: titles.get(text(event?.documentId)) || text(event?.documentId),
        eventAt: eventMoment(event),
        current: latestIds.get(`${subject}:${text(event?.documentId)}`) === text(event?.id),
      };
    });
  }
}

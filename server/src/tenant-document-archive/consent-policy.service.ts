import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { BusinessStateService } from '../business-state/business-state.service';
import { TenantDocumentArchiveService } from './tenant-document-archive.service';

type ConsentSubjectType = 'ACCOUNT' | 'CONTACT_POINT';
type ConsentStatus = 'accepted' | 'revoked' | 'declined';
const PDN_CONSENT_DOCUMENT_ID = 'pdn-consent';
const MARKETING_CONSENT_DOCUMENT_ID = 'messages-consent';
type TenantConsentEventRow = {
  id: string;
  tenantId: string;
  subjectType: ConsentSubjectType;
  subjectKey: string;
  contactType: string;
  contactValue: string;
  documentId: string;
  documentVersion: number;
  status: ConsentStatus;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  source: string;
  occurredAt: Date;
  createdAt: Date;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function canonicalEmail(value: unknown) {
  return text(value).toLowerCase();
}

function contactPointType(value: unknown) {
  const type = text(value).toUpperCase();
  if (type === 'SMS' || type === 'WHATSAPP') return 'PHONE';
  return ['PHONE', 'EMAIL', 'TELEGRAM'].includes(type) ? type : '';
}

function contactPointValue(typeValue: unknown, value: unknown) {
  const type = contactPointType(typeValue);
  if (type === 'PHONE') return canonicalPhone(value);
  if (type === 'EMAIL') return canonicalEmail(value);
  if (type === 'TELEGRAM') return text(value);
  return '';
}

function contactSubjectKey(typeValue: unknown, value: unknown) {
  const type = contactPointType(typeValue);
  const normalized = contactPointValue(type, value);
  return type && normalized ? `${type}:${normalized}` : '';
}

function asDate(value: unknown, fallback: Date) {
  const parsed = new Date(text(value));
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function publicEvent(row: TenantConsentEventRow) {
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
export class ConsentPolicyService {
  constructor(
    private readonly documents: TenantDocumentArchiveService,
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
  ) {}

  private async consentRows(tenantId: string) {
    return this.prisma.$queryRaw<TenantConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "createdAt"
      FROM "TenantConsentEvent"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "occurredAt" ASC, "createdAt" ASC, "id" ASC
    `;
  }

  private async latestEvent(
    tenantId: string,
    subjectType: ConsentSubjectType,
    subjectKey: string,
    documentId: string,
  ) {
    const rows = await this.prisma.$queryRaw<TenantConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "createdAt"
      FROM "TenantConsentEvent"
      WHERE "tenantId" = ${tenantId}
        AND "subjectType" = ${subjectType}
        AND "subjectKey" = ${subjectKey}
        AND "documentId" = ${documentId}
      ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  private async insertEvent(input: {
    tenantId: string;
    subjectType: ConsentSubjectType;
    subjectKey: string;
    contactType?: string;
    contactValue?: string;
    documentId: string;
    documentVersion: number;
    status: ConsentStatus;
    acceptedAt?: Date | null;
    revokedAt?: Date | null;
    source?: string;
    occurredAt: Date;
    id?: string;
  }) {
    const id = input.id || randomUUID();
    const contactType = contactPointType(input.contactType);
    const contactValue = contactPointValue(contactType, input.contactValue);
    await this.prisma.$executeRaw`
      INSERT INTO "TenantConsentEvent" (
        "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
        "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
        "occurredAt", "createdAt"
      ) VALUES (
        ${id}, ${input.tenantId}, ${input.subjectType}, ${input.subjectKey}, ${contactType}, ${contactValue},
        ${input.documentId}, ${input.documentVersion}, ${input.status}, ${input.acceptedAt || null},
        ${input.revokedAt || null}, ${text(input.source)}, ${input.occurredAt}, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("id") DO NOTHING
    `;
    return this.latestEvent(input.tenantId, input.subjectType, input.subjectKey, input.documentId);
  }

  private async state(tenantId: string) {
    const snapshot = await this.documents.get(tenantId);
    if (!snapshot?.verified) throw new ConflictException('Документы ещё не готовы');
    const data = snapshot.data || {};
    return {
      documents: Array.isArray(data.documents) ? data.documents : [],
    };
  }

  async acceptAccountConsents(tenantId: string, accountIdValue: unknown, facts: unknown, source = 'online-booking-account') {
    const accountId = text(accountIdValue);
    if (!accountId) throw new BadRequestException('Не указан аккаунт клиента');
    const current = await this.state(tenantId);
    const accepted = arrayValue(facts).filter((item) => Boolean(item?.accepted) && text(item?.documentId));
    for (const fact of accepted) {
      const documentId = text(fact?.documentId);
      const document = current.documents.find((item: any) => text(item?.id) === documentId);
      if (!document) continue;
      const documentVersion = Math.max(1, Number(fact?.documentVersion || document?.version || 1));
      const latest = await this.latestEvent(tenantId, 'ACCOUNT', accountId, documentId);
      if (latest?.status === 'accepted' && latest.documentVersion === documentVersion) continue;
      const occurredAt = asDate(fact?.acceptedAt, new Date());
      await this.insertEvent({
        tenantId,
        subjectType: 'ACCOUNT',
        subjectKey: accountId,
        documentId,
        documentVersion,
        status: 'accepted',
        acceptedAt: occurredAt,
        source,
        occurredAt,
      });
    }
    return this.accountConsentProjection(tenantId, accountId);
  }

  async acceptContactPointConsent(
    tenantId: string,
    typeValue: unknown,
    value: unknown,
    documentId: string,
    source = 'manual',
  ) {
    const type = contactPointType(typeValue);
    const normalizedValue = contactPointValue(type, value);
    const subjectKey = contactSubjectKey(type, normalizedValue);
    const targetDocumentId = text(documentId);
    if (!type || !normalizedValue || !subjectKey || !targetDocumentId) throw new BadRequestException('Не указан Contact Point или документ');

    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === targetDocumentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const documentVersion = Math.max(1, Number(document.version || 1));
    const latest = await this.latestEvent(tenantId, 'CONTACT_POINT', subjectKey, targetDocumentId);
    if (latest?.status === 'accepted' && latest.documentVersion === documentVersion) return publicEvent(latest);

    const now = new Date();
    const event = await this.insertEvent({
      tenantId,
      subjectType: 'CONTACT_POINT',
      subjectKey,
      contactType: type,
      contactValue: normalizedValue,
      documentId: targetDocumentId,
      documentVersion,
      status: 'accepted',
      acceptedAt: now,
      source,
      occurredAt: now,
    });
    return event ? publicEvent(event) : null;
  }

  async revokeContactPointConsent(
    tenantId: string,
    typeValue: unknown,
    value: unknown,
    documentId: string,
    source = 'manual',
  ) {
    const type = contactPointType(typeValue);
    const normalizedValue = contactPointValue(type, value);
    const subjectKey = contactSubjectKey(type, normalizedValue);
    const targetDocumentId = text(documentId);
    if (!type || !normalizedValue || !subjectKey || !targetDocumentId) throw new BadRequestException('Не указан Contact Point или документ');

    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === targetDocumentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const latest = await this.latestEvent(tenantId, 'CONTACT_POINT', subjectKey, targetDocumentId);
    if (latest?.status === 'revoked') return publicEvent(latest);
    const now = new Date();
    const event = await this.insertEvent({
      tenantId,
      subjectType: 'CONTACT_POINT',
      subjectKey,
      contactType: type,
      contactValue: normalizedValue,
      documentId: targetDocumentId,
      documentVersion: Math.max(1, Number(document.version || 1)),
      status: 'revoked',
      revokedAt: now,
      source,
      occurredAt: now,
    });
    return event ? publicEvent(event) : null;
  }

  async contactPointConsentState(tenantId: string, typeValue: unknown, value: unknown, documentId: string) {
    const type = contactPointType(typeValue);
    const normalizedValue = contactPointValue(type, value);
    const subjectKey = contactSubjectKey(type, normalizedValue);
    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === text(documentId));
    if (!type || !normalizedValue || !subjectKey || !document) {
      return { allowed: false, contactType: type, contactValue: normalizedValue, event: null };
    }
    const latest = await this.latestEvent(tenantId, 'CONTACT_POINT', subjectKey, text(documentId));
    const allowed = Boolean(latest
      && latest.status === 'accepted'
      && latest.documentVersion === Math.max(1, Number(document.version || 1)));
    return { allowed, contactType: type, contactValue: normalizedValue, event: latest ? publicEvent(latest) : null };
  }

  async revokeAccountConsent(tenantId: string, accountIdValue: unknown, documentIdValue: unknown, source = 'manual') {
    const accountId = text(accountIdValue);
    const documentId = text(documentIdValue);
    if (!accountId || !documentId) throw new BadRequestException('Не указан аккаунт или документ');
    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === documentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const latest = await this.latestEvent(tenantId, 'ACCOUNT', accountId, documentId);
    if (latest?.status === 'revoked') return publicEvent(latest);
    const now = new Date();
    const event = await this.insertEvent({
      tenantId,
      subjectType: 'ACCOUNT',
      subjectKey: accountId,
      documentId,
      documentVersion: Math.max(1, Number(document.version || 1)),
      status: 'revoked',
      revokedAt: now,
      source,
      occurredAt: now,
    });
    return event ? publicEvent(event) : null;
  }

  async accountConsentProjection(tenantId: string, accountIdValue: unknown) {
    const accountId = text(accountIdValue);
    const current = await this.state(tenantId);
    const rows = accountId ? await this.prisma.$queryRaw<TenantConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "createdAt"
      FROM "TenantConsentEvent"
      WHERE "tenantId" = ${tenantId} AND "subjectType" = 'ACCOUNT' AND "subjectKey" = ${accountId}
      ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
    ` : [];
    return current.documents
      .filter((document: any) => Boolean(document?.clientConsent))
      .map((document: any) => {
        const documentId = text(document?.id);
        const documentVersion = Math.max(1, Number(document?.version || 1));
        const latest = rows.find((event) => event.documentId === documentId) || null;
        const status = latest?.status || 'missing';
        const accepted = Boolean(latest && status === 'accepted' && latest.documentVersion === documentVersion);
        return {
          documentId,
          documentVersion,
          title: text(document?.title) || 'Документ',
          required: Boolean(document?.required),
          status,
          accepted,
          eventAt: latest?.occurredAt.toISOString() || '',
          source: text(latest?.source),
          eventId: text(latest?.id),
        };
      });
  }

  async accountConsentState(tenantId: string, accountIdValue: unknown) {
    const accountId = text(accountIdValue);
    const consents = accountId ? await this.accountConsentProjection(tenantId, accountId) : [];
    const pdn = consents.find((item) => item.documentId === PDN_CONSENT_DOCUMENT_ID);
    return { pdnActive: Boolean(pdn?.accepted), consents };
  }

  async hasActivePdnConsent(tenantId: string, accountIdValue: unknown) {
    return (await this.accountConsentState(tenantId, accountIdValue)).pdnActive;
  }

  async hasActivePdnConsentForIdentity(tenantId: string, phoneValue: unknown, ueiValue: unknown) {
    const accountIds = await this.businessState.accountIdsForIdentity(tenantId, phoneValue, ueiValue);
    for (const accountId of accountIds) {
      if (await this.hasActivePdnConsent(tenantId, accountId)) return true;
    }
    return false;
  }

  async hasActivePdnConsentForContact(tenantId: string, typeValue: unknown, value: unknown) {
    const type = contactPointType(typeValue);
    const normalizedValue = contactPointValue(type, value);
    if (!type || !normalizedValue) return false;

    if (type === 'PHONE' || type === 'EMAIL') {
      const accounts = await this.prisma.account.findMany({
        where: { tenantId },
        select: { id: true, phone: true, email: true },
      });
      const candidates = accounts.filter((account) =>
        type === 'PHONE'
          ? canonicalPhone(account.phone) === normalizedValue
          : canonicalEmail(account.email) === normalizedValue
      );
      for (const account of candidates) {
        if (await this.hasActivePdnConsent(tenantId, account.id)) return true;
      }
      return false;
    }

    const identities = await this.prisma.$queryRaw<Array<{ cardPhone: string; uei: string }>>`
      SELECT "cardPhone", "uei"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId}
        AND "channel" = 'TELEGRAM'
        AND "externalUserId" = ${normalizedValue}
      ORDER BY "verifiedAt" DESC NULLS LAST, "updatedAt" DESC
    `;
    const accountIds = new Set<string>();
    for (const identity of identities) {
      for (const accountId of await this.businessState.accountIdsForIdentity(tenantId, identity.cardPhone, identity.uei)) {
        accountIds.add(accountId);
      }
    }
    for (const accountId of accountIds) {
      if (await this.hasActivePdnConsent(tenantId, accountId)) return true;
    }
    return false;
  }

  async canSendMarketing(tenantId: string, typeValue: unknown, value: unknown) {
    return (await this.contactPointConsentState(tenantId, typeValue, value, MARKETING_CONSENT_DOCUMENT_ID)).allowed;
  }

  async consentReport(tenantId: string) {
    const current = await this.state(tenantId);
    const titles = new Map(current.documents.map((document: any) => [text(document?.id), text(document?.title) || 'Документ']));
    const rows = await this.consentRows(tenantId);
    const latestIds = new Map<string, string>();
    for (const event of [...rows].reverse()) {
      const key = `${event.subjectType}:${event.subjectKey}:${event.documentId}`;
      if (!latestIds.has(key)) latestIds.set(key, event.id);
    }
    return [...rows].reverse().map((event) => ({
      ...publicEvent(event),
      documentTitle: titles.get(event.documentId) || event.documentId,
      current: latestIds.get(`${event.subjectType}:${event.subjectKey}:${event.documentId}`) === event.id,
    }));
  }
}

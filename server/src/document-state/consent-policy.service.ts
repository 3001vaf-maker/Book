import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { DocumentStateService } from './document-state.service';

type ConsentSubjectType = 'BOOKING_ACCOUNT' | 'CONTACT_POINT';
type ConsentStatus = 'accepted' | 'revoked' | 'declined';
const MARKETING_CONSENT_DOCUMENT_ID = 'messages-consent';
type ConsentEventRow = {
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
  migratedFromEventId: string;
  createdAt: Date;
};

type LegacyCommunicationIdentity = {
  cardPhone: string;
  uei: string;
  externalUserId: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
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

function validStatus(value: unknown): ConsentStatus {
  const status = text(value).toLowerCase();
  if (status === 'revoked' || status === 'declined') return status;
  return 'accepted';
}

function asDate(value: unknown, fallback: Date) {
  const parsed = new Date(text(value));
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function eventMoment(event: any) {
  return text(event?.revokedAt || event?.acceptedAt || event?.createdAt);
}

function publicEvent(row: ConsentEventRow) {
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
export class ConsentPolicyService {
  constructor(
    private readonly documents: DocumentStateService,
    private readonly prisma: PrismaService,
  ) {}

  private async consentRows(tenantId: string) {
    return this.prisma.$queryRaw<ConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "migratedFromEventId", "createdAt"
      FROM "ConsentEvent"
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
    const rows = await this.prisma.$queryRaw<ConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "migratedFromEventId", "createdAt"
      FROM "ConsentEvent"
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
    migratedFromEventId?: string;
    id?: string;
  }) {
    const id = input.id || randomUUID();
    const contactType = contactPointType(input.contactType);
    const contactValue = contactPointValue(contactType, input.contactValue);
    await this.prisma.$executeRaw`
      INSERT INTO "ConsentEvent" (
        "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
        "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
        "occurredAt", "migratedFromEventId", "createdAt"
      ) VALUES (
        ${id}, ${input.tenantId}, ${input.subjectType}, ${input.subjectKey}, ${contactType}, ${contactValue},
        ${input.documentId}, ${input.documentVersion}, ${input.status}, ${input.acceptedAt || null},
        ${input.revokedAt || null}, ${text(input.source)}, ${input.occurredAt}, ${text(input.migratedFromEventId)}, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("id") DO NOTHING
    `;
    return this.latestEvent(input.tenantId, input.subjectType, input.subjectKey, input.documentId);
  }

  private migratedId(tenantId: string, legacyId: string, subjectType: ConsentSubjectType, subjectKey: string, documentId: string, status: string, moment: string) {
    return `legacy-${createHash('sha256').update([tenantId, legacyId, subjectType, subjectKey, documentId, status, moment].join('|')).digest('hex').slice(0, 40)}`;
  }

  /**
   * One-time conversion of historical JSON consent facts into the canonical append-only ConsentEvent store.
   * Historical clientId is read only here as migration input. It is never a consent subject or permission key.
   */
  async ensureCanonicalConsentEvents(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt || (state as any).consentMigratedAt) return;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ data: any; migrationVerifiedAt: Date | null; consentMigratedAt: Date | null }>>`
        SELECT "data", "migrationVerifiedAt", "consentMigratedAt"
        FROM "BusinessDocumentState"
        WHERE "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row?.migrationVerifiedAt || row.consentMigratedAt) return;

      const legacyEvents = arrayValue(objectValue(row.data).consents);
      const [peopleRows, identityRow, accounts, telegramIdentities] = await Promise.all([
        tx.businessPerson.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
        tx.businessIdentityState.findUnique({ where: { tenantId } }),
        tx.bookingAccount.findMany({ where: { tenantId }, select: { id: true, phone: true, email: true } }),
        tx.$queryRaw<LegacyCommunicationIdentity[]>`
          SELECT "cardPhone", "uei", "externalUserId"
          FROM "CommunicationIdentity"
          WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM' AND "verifiedAt" IS NOT NULL
        `,
      ]);

      const people = peopleRows.map((record) => ({ key: text(record.key), data: objectValue(record.data) }));
      const peopleByKey = new Map(people.map((item) => [item.key, item.data]));
      const identity = objectValue(identityRow?.data);
      const relations = objectValue(identity.relations);
      const entities = objectValue(identity.entities);
      const accountsById = new Map(accounts.map((account) => [account.id, account]));
      const rowsToInsert: Array<{
        id: string; subjectType: ConsentSubjectType; subjectKey: string; contactType: string; contactValue: string;
        documentId: string; documentVersion: number; status: ConsentStatus; acceptedAt: Date | null; revokedAt: Date | null;
        source: string; occurredAt: Date; migratedFromEventId: string;
      }> = [];

      const addTarget = (legacy: any, legacyId: string, subjectType: ConsentSubjectType, subjectKey: string, contactType = '', contactValue = '') => {
        const documentId = text(legacy?.documentId);
        if (!documentId || !subjectKey) return;
        const status = validStatus(legacy?.status);
        const now = new Date();
        const momentText = eventMoment(legacy) || now.toISOString();
        const occurredAt = asDate(momentText, now);
        const acceptedAt = status === 'accepted' ? asDate(legacy?.acceptedAt || momentText, occurredAt) : null;
        const revokedAt = status === 'revoked' ? asDate(legacy?.revokedAt || momentText, occurredAt) : null;
        rowsToInsert.push({
          id: this.migratedId(tenantId, legacyId, subjectType, subjectKey, documentId, status, occurredAt.toISOString()),
          subjectType,
          subjectKey,
          contactType: contactPointType(contactType),
          contactValue: contactPointValue(contactType, contactValue),
          documentId,
          documentVersion: Math.max(1, Number(legacy?.documentVersion || 1)),
          status,
          acceptedAt,
          revokedAt,
          source: text(legacy?.source) || 'legacy-consent-migration',
          occurredAt,
          migratedFromEventId: legacyId,
        });
      };

      for (const [index, legacy] of legacyEvents.entries()) {
        const documentId = text(legacy?.documentId);
        if (!documentId) continue;
        const legacyId = text(legacy?.id) || `legacy-index-${index}`;
        const existingSubjectType = text(legacy?.subjectType).toUpperCase() as ConsentSubjectType;
        const existingSubjectKey = text(legacy?.subjectKey);
        if ((existingSubjectType === 'BOOKING_ACCOUNT' || existingSubjectType === 'CONTACT_POINT') && existingSubjectKey) {
          addTarget(legacy, legacyId, existingSubjectType, existingSubjectKey, legacy?.contactType, legacy?.contactValue);
          continue;
        }

        const directType = contactPointType(legacy?.contactType);
        const directValue = contactPointValue(directType, legacy?.contactValue);
        if (directType && directValue) {
          addTarget(legacy, legacyId, 'CONTACT_POINT', contactSubjectKey(directType, directValue), directType, directValue);
          continue;
        }

        const historicalPersonKey = text(legacy?.clientId);
        if (!historicalPersonKey) continue;
        const uei = text(relations[`person:${historicalPersonKey}`]);
        const entity = objectValue(entities[uei]);
        const memberKeys = uei
          ? uniqueStrings([
              ...arrayValue(entity.members)
                .map((member) => text(member))
                .filter((member) => member.startsWith('person:'))
                .map((member) => member.slice(7)),
              ...Object.entries(relations)
                .filter(([key, value]) => key.startsWith('person:') && text(value) === uei)
                .map(([key]) => key.slice(7)),
              historicalPersonKey,
            ])
          : [historicalPersonKey];
        const memberPeople = memberKeys.map((key) => peopleByKey.get(key)).filter(Boolean) as Record<string, any>[];
        const accountIds = uniqueStrings([
          ...memberPeople.flatMap((person) => arrayValue(person.accounts)),
          historicalPersonKey.startsWith('account-') ? historicalPersonKey.slice(8) : '',
        ]).filter((accountId) => accountsById.has(accountId));

        if (documentId !== 'messages-consent') {
          for (const accountId of accountIds) addTarget(legacy, legacyId, 'BOOKING_ACCOUNT', accountId);
          continue;
        }

        const phones = new Set<string>();
        const emails = new Set<string>();
        for (const person of memberPeople) {
          for (const phone of arrayValue(person.phones)) {
            const normalized = canonicalPhone(phone);
            if (normalized) phones.add(normalized);
          }
          for (const email of arrayValue(person.emails)) {
            const normalized = canonicalEmail(email);
            if (normalized) emails.add(normalized);
          }
        }
        for (const accountId of accountIds) {
          const account = accountsById.get(accountId);
          const phone = canonicalPhone(account?.phone);
          const email = canonicalEmail(account?.email);
          if (phone) phones.add(phone);
          if (email) emails.add(email);
        }
        for (const phone of phones) addTarget(legacy, legacyId, 'CONTACT_POINT', contactSubjectKey('PHONE', phone), 'PHONE', phone);
        for (const email of emails) addTarget(legacy, legacyId, 'CONTACT_POINT', contactSubjectKey('EMAIL', email), 'EMAIL', email);
        for (const telegram of telegramIdentities) {
          const phoneMatches = phones.has(canonicalPhone(telegram.cardPhone));
          const ueiMatches = Boolean(uei && text(telegram.uei) === uei);
          if (!phoneMatches && !ueiMatches) continue;
          const telegramId = text(telegram.externalUserId);
          if (telegramId) addTarget(legacy, legacyId, 'CONTACT_POINT', contactSubjectKey('TELEGRAM', telegramId), 'TELEGRAM', telegramId);
        }
      }

      for (const event of rowsToInsert) {
        await tx.$executeRaw`
          INSERT INTO "ConsentEvent" (
            "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
            "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
            "occurredAt", "migratedFromEventId", "createdAt"
          ) VALUES (
            ${event.id}, ${tenantId}, ${event.subjectType}, ${event.subjectKey}, ${event.contactType}, ${event.contactValue},
            ${event.documentId}, ${event.documentVersion}, ${event.status}, ${event.acceptedAt}, ${event.revokedAt}, ${event.source},
            ${event.occurredAt}, ${event.migratedFromEventId}, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING
        `;
      }

      await tx.$executeRaw`
        UPDATE "BusinessDocumentState" SET "consentMigratedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = ${tenantId}
      `;
    });
  }

  private async state(tenantId: string) {
    await this.ensureCanonicalConsentEvents(tenantId);
    const snapshot = await this.documents.get(tenantId);
    if (!snapshot?.verified) throw new ConflictException('Документы ещё не готовы');
    const data = snapshot.data || {};
    return {
      documents: Array.isArray(data.documents) ? data.documents : [],
    };
  }

  async acceptAccountConsents(tenantId: string, accountIdValue: unknown, facts: unknown, source = 'online-booking-account') {
    await this.ensureCanonicalConsentEvents(tenantId);
    const accountId = text(accountIdValue);
    if (!accountId) throw new BadRequestException('Не указан аккаунт клиента');
    const current = await this.state(tenantId);
    const accepted = arrayValue(facts).filter((item) => Boolean(item?.accepted) && text(item?.documentId));
    for (const fact of accepted) {
      const documentId = text(fact?.documentId);
      const document = current.documents.find((item: any) => text(item?.id) === documentId);
      if (!document) continue;
      const documentVersion = Math.max(1, Number(fact?.documentVersion || document?.version || 1));
      const latest = await this.latestEvent(tenantId, 'BOOKING_ACCOUNT', accountId, documentId);
      if (latest?.status === 'accepted' && latest.documentVersion === documentVersion) continue;
      const occurredAt = asDate(fact?.acceptedAt, new Date());
      await this.insertEvent({
        tenantId,
        subjectType: 'BOOKING_ACCOUNT',
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
    await this.ensureCanonicalConsentEvents(tenantId);
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
    await this.ensureCanonicalConsentEvents(tenantId);
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
    await this.ensureCanonicalConsentEvents(tenantId);
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
    await this.ensureCanonicalConsentEvents(tenantId);
    const accountId = text(accountIdValue);
    const documentId = text(documentIdValue);
    if (!accountId || !documentId) throw new BadRequestException('Не указан аккаунт или документ');
    const current = await this.state(tenantId);
    const document = current.documents.find((item: any) => text(item?.id) === documentId);
    if (!document) throw new BadRequestException('Документ не найден');
    const latest = await this.latestEvent(tenantId, 'BOOKING_ACCOUNT', accountId, documentId);
    if (latest?.status === 'revoked') return publicEvent(latest);
    const now = new Date();
    const event = await this.insertEvent({
      tenantId,
      subjectType: 'BOOKING_ACCOUNT',
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
    await this.ensureCanonicalConsentEvents(tenantId);
    const accountId = text(accountIdValue);
    const current = await this.state(tenantId);
    const rows = accountId ? await this.prisma.$queryRaw<ConsentEventRow[]>`
      SELECT "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
             "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
             "occurredAt", "migratedFromEventId", "createdAt"
      FROM "ConsentEvent"
      WHERE "tenantId" = ${tenantId} AND "subjectType" = 'BOOKING_ACCOUNT' AND "subjectKey" = ${accountId}
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

  async requiredConsentState(tenantId: string, accountId: string) {
    const consents = await this.accountConsentProjection(tenantId, accountId);
    const required = consents.filter((item) => item.required);
    const missing = required.filter((item) => !item.accepted);
    return { allowed: missing.length === 0, required, missing, consents };
  }

  async canSendMarketing(tenantId: string, typeValue: unknown, value: unknown) {
    return (await this.contactPointConsentState(tenantId, typeValue, value, MARKETING_CONSENT_DOCUMENT_ID)).allowed;
  }

  async consentReport(tenantId: string) {
    await this.ensureCanonicalConsentEvents(tenantId);
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

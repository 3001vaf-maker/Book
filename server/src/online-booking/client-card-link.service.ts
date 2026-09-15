import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { BookingRequestStatus } from '@prisma/client';
import { BusinessStateService } from '../business-state/business-state.service';
import { ClientContactRulesService } from '../business-state/client-contact-rules.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function phoneDigits(value: unknown) {
  return text(value).replace(/\D/g, '');
}

function phonesMatch(left: unknown, right: unknown) {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length === 11 && b.length === 11 && a.slice(1) === b.slice(1)
    && ((a.startsWith('7') && b.startsWith('8')) || (a.startsWith('8') && b.startsWith('7')));
}

function personHasPhone(person: Record<string, any>, phone: unknown) {
  return arrayValue(person.phones).some((value) => phonesMatch(value, phone));
}

function accountIds(person: Record<string, any>) {
  return uniqueStrings(arrayValue(person.accounts));
}

function dateValue(value: unknown) {
  const result = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : '';
}

type ClientCardBinding = {
  person: Record<string, any>;
  clientCardExisted: boolean;
};

@Injectable()
export class ClientCardLinkService {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly clientContactRules: ClientContactRulesService,
  ) {}

  async cardState(tenantId: string, phone: unknown) {
    const business = await this.businessState.get(tenantId);
    const people = arrayValue(business.people).map((value) => objectValue(value));
    const members = people
      .map((person, position) => ({ person, position }))
      .filter(({ person }) => personHasPhone(person, phone));
    return { business, people, members, owner: members[0] || null };
  }

  private assertUnambiguousPhone(card: Awaited<ReturnType<ClientCardLinkService['cardState']>>) {
    if (card.members.length <= 1) return;
    throw new ConflictException('Этот телефон уже указан у нескольких клиентов. Мастер должен сначала разобрать старый дубль.');
  }

  async reconcileLegacyAccountDuplicates(tenantId: string) {
    const business = await this.businessState.get(tenantId);
    if (!business.verified) return { repaired: 0, candidates: 0, requiresManualReview: false };

    const people = arrayValue(business.people).map((value) => objectValue(value));
    const identity = objectValue(business.uei);
    const relations = objectValue(identity.relations);
    const candidates = people.filter((person) => {
      const key = text(person.key);
      return key.startsWith('account-')
        && accountIds(person).length > 0
        && !text(relations[`person:${key}`]);
    }).length;

    // A shared phone or matching name is not proof that two Person records are one human.
    // Legacy duplicates are therefore reported for explicit master review and never merged into UEI automatically.
    return { repaired: 0, candidates, requiresManualReview: candidates > 0 };
  }

  async findOrAttachExistingCard(tenantId: string, account: Record<string, any>): Promise<ClientCardBinding | null> {
    const accountId = text(account?.id);
    if (!accountId) throw new BadRequestException('У аккаунта онлайн-записи отсутствует id');

    const existingIdentity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    if (existingIdentity?.person?.key) {
      return { person: objectValue(existingIdentity.person), clientCardExisted: true };
    }

    const card = await this.cardState(tenantId, account.phone);
    if (!card.owner) return null;
    this.assertUnambiguousPhone(card);

    const owner: Record<string, any> = {
      ...objectValue(card.owner.person),
      accounts: uniqueStrings([...accountIds(card.owner.person), accountId]),
      phones: uniqueStrings([...arrayValue(card.owner.person.phones), account.phone]),
      emails: uniqueStrings([...arrayValue(card.owner.person.emails), text(account.email).toLowerCase()]),
      telegrams: uniqueStrings([...arrayValue(card.owner.person.telegrams), text(account.telegramId)]),
    };
    await this.clientContactRules.validatePersonUpsert(tenantId, text(owner.key), { person: owner });
    await this.businessState.upsertPerson(tenantId, text(owner.key), { person: owner, position: card.owner.position });
    return { person: owner, clientCardExisted: true };
  }

  async bindFirstAccess(tenantId: string, account: Record<string, any>): Promise<ClientCardBinding> {
    const existing = await this.findOrAttachExistingCard(tenantId, account);
    if (existing) return existing;
    const accountId = text(account?.id);
    const candidate = {
      key: `account-${accountId}`,
      phones: uniqueStrings([account.phone]),
      emails: uniqueStrings([text(account.email).toLowerCase()]),
      telegrams: uniqueStrings([account.telegramId]),
      contactViaUei: '',
    };
    await this.clientContactRules.validatePersonUpsert(tenantId, candidate.key, { person: candidate });
    const person = objectValue(await this.businessState.upsertBookingPersonFromAccount(tenantId, account));
    return { person, clientCardExisted: false };
  }

  async cardStats(tenantId: string, account: Record<string, any>) {
    const card = await this.cardState(tenantId, account.phone);
    if (!card.members.length) return null;
    this.assertUnambiguousPhone(card);
    const members = card.members.map(({ person }) => person);
    return {
      visits: members.reduce((sum, person) => sum + Math.max(0, Number(person.visits || 0)), 0),
      totalSpent: members.reduce((sum, person) => sum + Math.max(0, Number(person.totalSpent || 0)), 0),
      lastVisit: members.map((person) => text(person.lastVisit)).filter(Boolean).sort().at(-1) || '',
    };
  }

  async manualRecordViews(tenantId: string, account: Record<string, any>, importedRecordIds: Set<string>) {
    const card = await this.cardState(tenantId, account.phone);
    this.assertUnambiguousPhone(card);
    const memberKeys = new Set(card.members.map(({ person }) => text(person.key)).filter(Boolean));
    if (!memberKeys.size) return [];

    const cancelled = new Set(arrayValue(card.business.recordEvents)
      .filter((event) => text(event?.type) === 'cancelled')
      .map((event) => text(event?.recordId))
      .filter(Boolean));

    const records = arrayValue(card.business.records).filter((value) => {
      const record = objectValue(value);
      const recordId = text(record.id);
      if (!recordId || importedRecordIds.has(recordId) || cancelled.has(recordId) || text(record.status) === 'cancelled') return false;
      const client = objectValue(record.client);
      return memberKeys.has(text(client.key)) || phonesMatch(client.phone, account.phone);
    });

    return Promise.all(records.map(async (value) => {
      const record = objectValue(value);
      const recordId = text(record.id);
      return {
        id: `record:${recordId}`,
        tenantId,
        accountId: text(account.id),
        workplaceKey: text(record.workplaceId),
        date: dateValue(record.date),
        from: text(record.from),
        to: text(record.to),
        procedures: arrayValue(record.procedures),
        status: BookingRequestStatus.IMPORTED,
        importedRecordId: recordId,
        recordSnapshot: await this.businessState.bookingRecordSnapshot(tenantId, recordId, null),
        createdAt: text(record.createdAt),
        updatedAt: text(record.updatedAt),
      };
    }));
  }
}

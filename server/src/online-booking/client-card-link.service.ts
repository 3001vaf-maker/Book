import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingRequestStatus } from '@prisma/client';
import { BusinessStateService } from '../business-state/business-state.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
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

function peopleSharePhone(left: Record<string, any>, right: Record<string, any>) {
  return arrayValue(left.phones).some((phone) => personHasPhone(right, phone));
}

function accountIds(person: Record<string, any>) {
  return uniqueStrings(arrayValue(person.accounts));
}

function sameNamedPerson(left: Record<string, any>, right: Record<string, any>) {
  let compared = 0;
  for (const field of ['name', 'surname']) {
    const a = text(left[field]).toLowerCase();
    const b = text(right[field]).toLowerCase();
    if (!a || !b) continue;
    compared += 1;
    if (a !== b) return false;
  }
  return compared > 0;
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
  constructor(private readonly businessState: BusinessStateService) {}

  async cardState(tenantId: string, phone: unknown) {
    const business = await this.businessState.get(tenantId);
    const people = arrayValue(business.people).map((value) => objectValue(value));
    const members = people
      .map((person, position) => ({ person, position }))
      .filter(({ person }) => personHasPhone(person, phone));
    return { business, people, members, owner: members[0] || null };
  }

  async reconcileLegacyAccountDuplicates(tenantId: string) {
    const business = await this.businessState.get(tenantId);
    if (!business.verified) return { repaired: 0 };

    const people = arrayValue(business.people).map((value) => objectValue(value));
    const identity = cloneValue(objectValue(business.uei));
    identity.entities = objectValue(identity.entities);
    identity.relations = objectValue(identity.relations);
    identity.revoked = arrayValue(identity.revoked);

    let repaired = 0;

    for (let position = 0; position < people.length; position += 1) {
      const legacy = objectValue(people[position]);
      const legacyKey = text(legacy.key);
      const legacyAccounts = accountIds(legacy);
      if (!legacyKey.startsWith('account-') || !legacyAccounts.length) continue;
      if (text(identity.relations[`person:${legacyKey}`])) continue;

      const matching = people
        .map((person, candidatePosition) => ({ person: objectValue(person), position: candidatePosition }))
        .filter(({ person }) => text(person.key) !== legacyKey)
        .filter(({ person }) => peopleSharePhone(legacy, person))
        .filter(({ person }) => sameNamedPerson(legacy, person));

      const ueiCandidates = uniqueStrings(matching.map(({ person }) => identity.relations[`person:${text(person.key)}`]));
      if (ueiCandidates.length !== 1) continue;

      const uei = ueiCandidates[0];
      const entity = objectValue(identity.entities[uei]);
      const owner = objectValue(entity.owner);
      const ownerKey = owner.type === 'person' ? text(owner.id) : '';
      const canonicalEntry = matching.find(({ person }) => text(person.key) === ownerKey && text(identity.relations[`person:${text(person.key)}`]) === uei)
        || matching.find(({ person }) => text(identity.relations[`person:${text(person.key)}`]) === uei)
        || null;
      if (!canonicalEntry) continue;

      const canonicalKey = text(canonicalEntry.person.key);
      const canonical: Record<string, any> = {
        ...objectValue(canonicalEntry.person),
        accounts: uniqueStrings([...accountIds(canonicalEntry.person), ...legacyAccounts]),
        phones: uniqueStrings([...arrayValue(canonicalEntry.person.phones), ...arrayValue(legacy.phones)]),
        emails: uniqueStrings([...arrayValue(canonicalEntry.person.emails), ...arrayValue(legacy.emails)]),
        telegrams: uniqueStrings([...arrayValue(canonicalEntry.person.telegrams), ...arrayValue(legacy.telegrams)]),
      };
      await this.businessState.upsertPerson(tenantId, canonicalKey, { person: canonical, position: canonicalEntry.position });
      people[canonicalEntry.position] = canonical;

      const relationKey = `person:${legacyKey}`;
      const nextEntity: Record<string, any> = {
        ...entity,
        members: uniqueStrings([...arrayValue(entity.members), relationKey]),
        history: arrayValue(entity.history).map((value) => cloneValue(value)),
      };
      if (!nextEntity.history.some((item: Record<string, any>) => text(item?.key) === relationKey)) {
        nextEntity.history.push({
          key: relationKey,
          type: 'person',
          id: legacyKey,
          identifiers: uniqueStrings([...arrayValue(legacy.phones), ...arrayValue(legacy.emails)]),
        });
      }
      identity.entities[uei] = nextEntity;
      identity.relations[relationKey] = uei;
      await this.businessState.updateUEI(tenantId, { uei: identity });

      const cleanedLegacy: Record<string, any> = { ...legacy, accounts: [] };
      await this.businessState.upsertPerson(tenantId, legacyKey, { person: cleanedLegacy, position });
      people[position] = cleanedLegacy;
      repaired += 1;
    }

    return { repaired };
  }

  async findOrAttachExistingCard(tenantId: string, account: Record<string, any>): Promise<ClientCardBinding | null> {
    const accountId = text(account?.id);
    if (!accountId) throw new BadRequestException('У аккаунта онлайн-записи отсутствует id');

    await this.reconcileLegacyAccountDuplicates(tenantId);
    const existingIdentity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    if (existingIdentity?.person?.key) {
      return { person: objectValue(existingIdentity.person), clientCardExisted: true };
    }

    const card = await this.cardState(tenantId, account.phone);
    if (!card.owner) return null;

    const owner: Record<string, any> = {
      ...objectValue(card.owner.person),
      accounts: uniqueStrings([...accountIds(card.owner.person), accountId]),
      phones: uniqueStrings([...arrayValue(card.owner.person.phones), account.phone]),
      emails: uniqueStrings([...arrayValue(card.owner.person.emails), text(account.email).toLowerCase()]),
    };
    await this.businessState.upsertPerson(tenantId, text(owner.key), { person: owner, position: card.owner.position });
    return { person: owner, clientCardExisted: true };
  }

  async bindFirstAccess(tenantId: string, account: Record<string, any>): Promise<ClientCardBinding> {
    const existing = await this.findOrAttachExistingCard(tenantId, account);
    if (existing) return existing;
    const person = objectValue(await this.businessState.upsertBookingPersonFromAccount(tenantId, account));
    return { person, clientCardExisted: false };
  }

  async cardStats(tenantId: string, account: Record<string, any>) {
    const card = await this.cardState(tenantId, account.phone);
    if (!card.members.length) return null;
    const members = card.members.map(({ person }) => person);
    return {
      visits: members.reduce((sum, person) => sum + Math.max(0, Number(person.visits || 0)), 0),
      totalSpent: members.reduce((sum, person) => sum + Math.max(0, Number(person.totalSpent || 0)), 0),
      lastVisit: members.map((person) => text(person.lastVisit)).filter(Boolean).sort().at(-1) || '',
    };
  }

  async manualRecordViews(tenantId: string, account: Record<string, any>, importedRecordIds: Set<string>) {
    const card = await this.cardState(tenantId, account.phone);
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

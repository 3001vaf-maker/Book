import { BadRequestException, Injectable } from '@nestjs/common';
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

type PersonBinding = {
  person: Record<string, any>;
  personExisted: boolean;
};

@Injectable()
export class PersonIdentityService {
  constructor(private readonly businessState: BusinessStateService) {}

  async personState(tenantId: string, phone: unknown) {
    const business = await this.businessState.get(tenantId);
    const people = arrayValue(business.people).map((value) => objectValue(value));
    const members = people
      .map((person, position) => ({ person, position }))
      .filter(({ person }) => personHasPhone(person, phone));
    return { business, people, members, owner: members[0] || null };
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
    // Legacy duplicates are therefore reported for explicit review and never merged into UEI automatically.
    return { repaired: 0, candidates, requiresManualReview: candidates > 0 };
  }

  async findOrAttachExistingPerson(tenantId: string, account: Record<string, any>): Promise<PersonBinding | null> {
    const accountId = text(account?.id);
    if (!accountId) throw new BadRequestException('У аккаунта онлайн-записи отсутствует id');

    const existingIdentity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    if (existingIdentity?.person?.key) {
      return { person: objectValue(existingIdentity.person), personExisted: true };
    }

    const personState = await this.personState(tenantId, account.phone);
    if (!personState.owner) return null;

    const owner: Record<string, any> = {
      ...objectValue(personState.owner.person),
      accounts: uniqueStrings([...accountIds(personState.owner.person), accountId]),
      phones: uniqueStrings([...arrayValue(personState.owner.person.phones), account.phone]),
      emails: uniqueStrings([...arrayValue(personState.owner.person.emails), text(account.email).toLowerCase()]),
    };
    await this.businessState.upsertPerson(tenantId, text(owner.key), { person: owner, position: personState.owner.position });
    return { person: owner, personExisted: true };
  }

  async bindFirstAccess(tenantId: string, account: Record<string, any>): Promise<PersonBinding> {
    const existing = await this.findOrAttachExistingPerson(tenantId, account);
    if (existing) return existing;
    const person = objectValue(await this.businessState.upsertPersonFromAccount(tenantId, account));
    return { person, personExisted: false };
  }

  async personStats(tenantId: string, account: Record<string, any>) {
    const personState = await this.personState(tenantId, account.phone);
    if (!personState.members.length) return null;
    const members = personState.members.map(({ person }) => person);
    return {
      visits: members.reduce((sum, person) => sum + Math.max(0, Number(person.visits || 0)), 0),
      totalSpent: members.reduce((sum, person) => sum + Math.max(0, Number(person.totalSpent || 0)), 0),
      lastVisit: members.map((person) => text(person.lastVisit)).filter(Boolean).sort().at(-1) || '',
    };
  }


}

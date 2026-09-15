import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStateService } from '../business-state/business-state.service';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

type ProfileState = {
  people: JsonObject[];
  peopleByKey: Map<string, JsonObject>;
  accountToPersonKey: Map<string, string>;
  relations: JsonObject;
  entities: JsonObject;
};

function text(value: unknown) { return String(value ?? '').trim(); }
function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function accountIds(person: JsonObject) {
  return [...new Set((Array.isArray(person.accounts) ? person.accounts : []).map((value) => text(value)).filter(Boolean))];
}
function personName(person: JsonObject) {
  return [text(person.name), text(person.surname)].filter(Boolean).join(' ').trim();
}
function personHasPhone(person: JsonObject, phone: string) {
  return (Array.isArray(person.phones) ? person.phones : []).some((value) => canonicalPhone(value) === phone);
}

export type ClientProfileThread = {
  profileKey: string;
  profileName: string;
  profileUei: string;
  memberKeys: string[];
  accountIds: string[];
  sourcePersonKey: string;
  sourceName: string;
  sourceUei: string;
};

@Injectable()
export class ClientProfileThreadService {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly prisma: PrismaService,
  ) {}

  private async state(tenantId: string): Promise<ProfileState> {
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const peopleByKey = new Map<string, JsonObject>();
    const accountToPersonKey = new Map<string, string>();
    for (const person of people) {
      const key = text(person.key);
      if (!key) continue;
      peopleByKey.set(key, person);
      for (const accountId of accountIds(person)) if (!accountToPersonKey.has(accountId)) accountToPersonKey.set(accountId, key);
    }
    return {
      people,
      peopleByKey,
      accountToPersonKey,
      relations: objectValue(business.uei?.relations),
      entities: objectValue(business.uei?.entities),
    };
  }

  private build(state: ProfileState, source: JsonObject): ClientProfileThread {
    const sourceKey = text(source.key);
    if (!sourceKey) throw new NotFoundException('Профиль клиента не найден');
    const uei = text(state.relations[`person:${sourceKey}`]);
    const entity = uei ? objectValue(state.entities[uei]) : {};
    const relationMembers = uei
      ? (Array.isArray(entity.members) ? entity.members : [])
          .map((value) => text(value))
          .filter((value) => value.startsWith('person:'))
          .map((value) => value.slice(7))
          .filter((key) => state.peopleByKey.has(key))
      : [];
    const memberKeys = [...new Set([sourceKey, ...relationMembers])];
    const owner = objectValue(entity.owner);
    const ownerKey = owner.type === 'person' ? text(owner.id) : '';
    const profileKey = ownerKey && memberKeys.includes(ownerKey) ? ownerKey : sourceKey;
    const profile = state.peopleByKey.get(profileKey) || source;
    const profileUei = text(state.relations[`person:${profileKey}`]) || uei;
    const allAccountIds = [...new Set(memberKeys.flatMap((key) => accountIds(state.peopleByKey.get(key) || {})))];
    return {
      profileKey,
      profileName: personName(profile),
      profileUei,
      memberKeys,
      accountIds: allAccountIds,
      sourcePersonKey: sourceKey,
      sourceName: personName(source),
      sourceUei: uei,
    };
  }

  async byAccount(tenantId: string, accountIdValue: unknown) {
    const accountId = text(accountIdValue);
    if (!accountId) throw new BadRequestException('Не указан клиентский аккаунт');
    const state = await this.state(tenantId);
    const sourceKey = state.accountToPersonKey.get(accountId) || '';
    const source = sourceKey ? state.peopleByKey.get(sourceKey) : null;
    if (!source) throw new NotFoundException('Профиль клиентского аккаунта не найден');
    const profile = this.build(state, source);
    if (!profile.accountIds.includes(accountId)) profile.accountIds.push(accountId);
    return profile;
  }

  async byProfileKey(tenantId: string, profileKeyValue: unknown) {
    const profileKey = text(profileKeyValue);
    if (!profileKey) throw new BadRequestException('Не указан профиль клиента');
    const state = await this.state(tenantId);
    const source = state.peopleByKey.get(profileKey);
    if (!source) throw new NotFoundException('Профиль клиента не найден');
    return this.build(state, source);
  }

  async byLegacy(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const phone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    const state = await this.state(tenantId);
    let source: JsonObject | null = null;
    if (phone) {
      const matches = state.people.filter((person) => personHasPhone(person, phone));
      if (matches.length) {
        const canonicalKeys = new Set(matches.map((person) => this.build(state, person).profileKey));
        if (canonicalKeys.size > 1) throw new ConflictException('Этот телефон относится к нескольким клиентам. Нужна явная связь мастера.');
        source = matches[0];
      }
    }
    if (!source && uei) {
      const member = Object.entries(state.relations).find(([key, value]) => key.startsWith('person:') && text(value) === uei);
      if (member) source = state.peopleByKey.get(member[0].slice(7)) || null;
    }
    return source ? this.build(state, source) : null;
  }

  async canonicalizeProfileKeys(tenantId: string, storedKeys: unknown[]) {
    const state = await this.state(tenantId);
    const result = new Map<string, ClientProfileThread>();
    for (const rawKey of storedKeys) {
      const key = text(rawKey);
      if (!key || result.has(key)) continue;
      const source = state.peopleByKey.get(key);
      if (source) result.set(key, this.build(state, source));
    }
    return result;
  }

  async accountsForProfile(tenantId: string, profileKeyValue: unknown) {
    const profile = await this.byProfileKey(tenantId, profileKeyValue);
    if (!profile.accountIds.length) return [];
    return this.prisma.bookingAccount.findMany({
      where: { tenantId, id: { in: profile.accountIds } },
      select: { id: true, phone: true, uei: true, email: true },
    });
  }
}

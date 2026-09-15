import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStateService } from '../business-state/business-state.service';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

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

  private async state(tenantId: string) {
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const relations = objectValue(business.uei?.relations);
    const entities = objectValue(business.uei?.entities);
    return { people, relations, entities };
  }

  private build(state: Awaited<ReturnType<ClientProfileThreadService['state']>>, source: JsonObject): ClientProfileThread {
    const sourceKey = text(source.key);
    if (!sourceKey) throw new NotFoundException('Профиль клиента не найден');
    const uei = text(state.relations[`person:${sourceKey}`]);
    const entity = uei ? objectValue(state.entities[uei]) : {};
    const relationMembers = uei
      ? (Array.isArray(entity.members) ? entity.members : [])
          .map((value) => text(value))
          .filter((value) => value.startsWith('person:'))
          .map((value) => value.slice(7))
      : [];
    const memberKeys = [...new Set([sourceKey, ...relationMembers])];
    const members = state.people.filter((person) => memberKeys.includes(text(person.key)));
    const owner = objectValue(entity.owner);
    const ownerKey = owner.type === 'person' ? text(owner.id) : '';
    const profile = members.find((person) => text(person.key) === ownerKey) || source;
    const profileKey = text(profile.key) || sourceKey;
    const profileUei = text(state.relations[`person:${profileKey}`]) || uei;
    const allAccountIds = [...new Set(members.flatMap((person) => accountIds(person)))];
    return {
      profileKey,
      profileName: personName(profile),
      profileUei,
      memberKeys: members.length ? members.map((person) => text(person.key)).filter(Boolean) : [sourceKey],
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
    const source = state.people.find((person) => accountIds(person).includes(accountId));
    if (!source) throw new NotFoundException('Профиль клиентского аккаунта не найден');
    const profile = this.build(state, source);
    if (!profile.accountIds.includes(accountId)) profile.accountIds.push(accountId);
    return profile;
  }

  async byProfileKey(tenantId: string, profileKeyValue: unknown) {
    const profileKey = text(profileKeyValue);
    if (!profileKey) throw new BadRequestException('Не указан профиль клиента');
    const state = await this.state(tenantId);
    const source = state.people.find((person) => text(person.key) === profileKey);
    if (!source) throw new NotFoundException('Профиль клиента не найден');
    return this.build(state, source);
  }

  async byLegacy(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const phone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    const state = await this.state(tenantId);
    let source: JsonObject | null = null;
    if (phone) source = state.people.find((person) => personHasPhone(person, phone)) || null;
    if (!source && uei) {
      const member = Object.entries(state.relations).find(([key, value]) => key.startsWith('person:') && text(value) === uei);
      if (member) source = state.people.find((person) => text(person.key) === member[0].slice(7)) || null;
    }
    return source ? this.build(state, source) : null;
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

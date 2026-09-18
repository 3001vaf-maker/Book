import { Injectable } from '@nestjs/common';
import { BusinessStateService } from '../business-state/business-state.service';
import { PersonProfileThread, PersonProfileThreadService } from './person-profile-thread.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

@Injectable()
export class PersonContactRouteService {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly profiles: PersonProfileThreadService,
  ) {}

  private contactViaForProfile(profile: PersonProfileThread, peopleByKey: Map<string, Record<string, any>>) {
    const orderedKeys = [profile.profileKey, ...profile.memberKeys.filter((key) => key !== profile.profileKey)];
    for (const key of orderedKeys) {
      const value = text(peopleByKey.get(key)?.contactViaUei).toUpperCase();
      if (value) return value;
    }
    return '';
  }

  async resolve(tenantId: string, source: PersonProfileThread) {
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const peopleByKey = new Map<string, Record<string, any>>();
    for (const person of people) {
      const key = text(person.key);
      if (key) peopleByKey.set(key, person);
    }
    const visited = new Set<string>();
    let delivery = source;
    let viaUei = '';

    for (let depth = 0; depth < 20; depth += 1) {
      const nextUei = this.contactViaForProfile(delivery, peopleByKey);
      if (!nextUei) break;
      if (visited.has(nextUei)) break;
      visited.add(nextUei);
      const next = await this.profiles.byLegacy(tenantId, { uei: nextUei }).catch(() => null);
      if (!next) break;
      viaUei = nextUei;
      delivery = next;
    }

    return {
      subject: source,
      delivery,
      via: delivery.profileKey !== source.profileKey,
      viaUei,
    };
  }

  async resolveByProfileKey(tenantId: string, profileKey: unknown) {
    const source = await this.profiles.byProfileKey(tenantId, profileKey);
    return this.resolve(tenantId, source);
  }

  async deliveryAccountsForProfile(tenantId: string, profileKey: unknown) {
    const route = await this.resolveByProfileKey(tenantId, profileKey);
    return this.profiles.accountsForProfile(tenantId, route.delivery.profileKey);
  }

  async accessibleProfilesForAccount(tenantId: string, accountIdValue: unknown) {
    const accountId = text(accountIdValue);
    const own = await this.profiles.byAccount(tenantId, accountId);
    const business = await this.businessState.get(tenantId);
    const keys = (Array.isArray(business.people) ? business.people : [])
      .map((value) => text(objectValue(value).key))
      .filter(Boolean);
    const canonical = await this.profiles.canonicalizeProfileKeys(tenantId, keys);
    const candidates = new Map<string, PersonProfileThread>();
    candidates.set(own.profileKey, own);
    for (const profile of canonical.values()) candidates.set(profile.profileKey, profile);

    const accessible = new Map<string, PersonProfileThread>();
    for (const source of candidates.values()) {
      const route = await this.resolve(tenantId, source);
      if (route.delivery.profileKey === own.profileKey) accessible.set(source.profileKey, source);
    }
    return [...accessible.values()];
  }
}

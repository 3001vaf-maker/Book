import { Injectable } from '@nestjs/common';
import { BusinessStateService } from '../business-state/business-state.service';
import { ClientProfileThread, ClientProfileThreadService } from './client-profile-thread.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

@Injectable()
export class ClientContactRouteService {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly profiles: ClientProfileThreadService,
  ) {}

  private contactViaForProfile(profile: ClientProfileThread, peopleByKey: Map<string, Record<string, any>>) {
    const orderedKeys = [profile.profileKey, ...profile.memberKeys.filter((key) => key !== profile.profileKey)];
    for (const key of orderedKeys) {
      const value = text(peopleByKey.get(key)?.contactViaUei).toUpperCase();
      if (value) return value;
    }
    return '';
  }

  async resolve(tenantId: string, source: ClientProfileThread) {
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const peopleByKey = new Map(people.map((person) => [text(person.key), person]).filter(([key]) => Boolean(key)));
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
}

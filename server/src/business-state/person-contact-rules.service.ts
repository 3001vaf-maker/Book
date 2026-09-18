import { ConflictException, Injectable } from '@nestjs/common';
import { BusinessStateService } from './business-state.service';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
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

function canonicalTelegram(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return `id:${raw}`;
  const username = raw.replace(/^@+/, '').toLowerCase();
  return username ? `username:${username}` : '';
}

function contacts(person: Record<string, any>) {
  const result: Array<{ type: string; key: string }> = [];
  for (const value of Array.isArray(person.phones) ? person.phones : []) {
    const normalized = canonicalPhone(value);
    if (normalized) result.push({ type: 'Телефон', key: `phone:${normalized}` });
  }
  for (const value of Array.isArray(person.emails) ? person.emails : []) {
    const normalized = canonicalEmail(value);
    if (normalized) result.push({ type: 'Email', key: `email:${normalized}` });
  }
  for (const value of Array.isArray(person.telegrams) ? person.telegrams : []) {
    const normalized = canonicalTelegram(value);
    if (normalized) result.push({ type: 'Telegram', key: `telegram:${normalized}` });
  }
  return result;
}

function personMemberKeys(entity: Record<string, any>) {
  return (Array.isArray(entity.members) ? entity.members : [])
    .map((value) => text(value))
    .filter((value) => value.startsWith('person:'))
    .map((value) => value.slice(7));
}

@Injectable()
export class PersonContactRulesService {
  constructor(private readonly businessState: BusinessStateService) {}

  async validatePersonUpsert(tenantId: string, personKeyValue: unknown, body: unknown) {
    const personKey = text(personKeyValue);
    const source = objectValue(body);
    const candidate = objectValue(source.person ?? source);
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const previous = people.find((person) => text(person.key) === personKey) || {};
    const previousContacts = new Set(contacts(previous).map((item) => item.key));
    const relations = objectValue(business.uei?.relations);

    for (const contact of contacts(candidate)) {
      const owner = people.find((person) => text(person.key) !== personKey && contacts(person).some((item) => item.key === contact.key));
      if (!owner || previousContacts.has(contact.key)) continue;
      const ownerKey = text(owner.key);
      const ownerUei = text(relations[`person:${ownerKey}`]);
      const ownerName = [text(owner.name), text(owner.surname)].filter(Boolean).join(' ');
      throw new ConflictException(`${contact.type} уже принадлежит клиенту ${ownerUei || ownerName || 'в базе'}`);
    }

    const contactViaUei = text(candidate.contactViaUei).toUpperCase();
    if (!contactViaUei) return;

    const entities = objectValue(business.uei?.entities);
    const targetMembers = personMemberKeys(objectValue(entities[contactViaUei]));
    if (!targetMembers.length) throw new ConflictException('Клиент для связи не найден');

    const currentUei = text(relations[`person:${personKey}`]);
    if (currentUei && currentUei === contactViaUei) throw new ConflictException('Нельзя указать связь через этого же клиента');

    if (!currentUei) return;
    const visited = new Set<string>();
    let cursor = contactViaUei;
    for (let depth = 0; depth < 20 && cursor; depth += 1) {
      if (cursor === currentUei || visited.has(cursor)) throw new ConflictException('Связь через образует замкнутую цепочку');
      visited.add(cursor);
      const entity = objectValue(entities[cursor]);
      const owner = objectValue(entity.owner);
      const ownerKey = owner.type === 'person' ? text(owner.id) : '';
      const ownerPerson = people.find((person) => text(person.key) === ownerKey) || null;
      cursor = text(ownerPerson?.contactViaUei).toUpperCase();
    }
  }

  async validateUeiUpdate(tenantId: string, body: unknown) {
    const source = objectValue(body);
    const proposed = objectValue(source.uei ?? source);
    const relations = objectValue(proposed.relations);
    const entities = objectValue(proposed.entities);
    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const peopleByKey = new Map<string, Record<string, any>>();
    for (const person of people) {
      const key = text(person.key);
      if (key) peopleByKey.set(key, person);
    }

    for (const person of people) {
      const key = text(person.key);
      const via = text(person.contactViaUei).toUpperCase();
      if (!via) continue;
      const ownUei = text(relations[`person:${key}`]).toUpperCase();
      if (ownUei && ownUei === via) throw new ConflictException('UEI нельзя объединить с клиентом, указанным в «Связь через»');
    }

    const viaForUei = (uei: string) => {
      const entity = objectValue(entities[uei]);
      const owner = objectValue(entity.owner);
      const ownerKey = owner.type === 'person' ? text(owner.id) : '';
      const ordered = [ownerKey, ...personMemberKeys(entity).filter((key) => key !== ownerKey)].filter(Boolean);
      for (const key of ordered) {
        const via = text(peopleByKey.get(key)?.contactViaUei).toUpperCase();
        if (via) return via;
      }
      return '';
    };

    for (const uei of Object.keys(entities)) {
      const start = text(uei).toUpperCase();
      if (!start) continue;
      const visited = new Set<string>();
      let cursor = start;
      for (let depth = 0; depth < 20; depth += 1) {
        const next = viaForUei(cursor);
        if (!next) break;
        if (next === start || visited.has(next)) throw new ConflictException('Связь через образует замкнутую цепочку');
        visited.add(next);
        cursor = next;
      }
    }
  }
}

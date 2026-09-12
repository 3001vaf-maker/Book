from pathlib import Path
import json


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]}')
    write(path, text.replace(old, new, 1))


def replace_method(text, start_marker, end_marker, block):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'Method start not found: {start_marker}')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'Method end not found: {end_marker}')
    return text[:start] + block.rstrip() + '\n\n' + text[end:]


# Profile is the canonical public source for professional/workplace facts.
profile_path = 'server/src/profile/profile.service.ts'
profile = read(profile_path)
insert = r'''

  async publicBookingBundle(tenantId: string) {
    const row = await this.prisma.profile.findFirst({
      where: { tenantId, migrationVerifiedAt: { not: null } },
      include: { workplaces: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) throw new ConflictException('Профиль для онлайн-записи ещё не готов');
    return {
      profile: {
        name: row.name,
        surname: row.surname,
        photo: row.photo,
        profession: row.profession,
        about: row.about,
      },
      workplaces: row.workplaces.map(workplaceDto),
      updatedAt: row.updatedAt,
    };
  }
'''
if 'async publicBookingBundle(' not in profile:
    idx = profile.rfind('\n}')
    if idx < 0:
        raise SystemExit('ProfileService class end not found')
    profile = profile[:idx] + insert + profile[idx:]
    write(profile_path, profile)
replace_once('server/src/profile/profile.module.ts',
             '  providers: [ProfileService, PrismaService],\n})',
             '  providers: [ProfileService, PrismaService],\n  exports: [ProfileService],\n})')


# Documents remain the sole owner of public legal documents and accepted consent facts.
doc_path = 'server/src/document-state/document-state.service.ts'
doc = read(doc_path)
if "from 'node:crypto'" not in doc:
    doc = doc.replace("import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';\n",
                      "import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';\nimport { randomUUID } from 'node:crypto';\n", 1)
doc_insert = r'''

  async publicDocuments(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    return normalize(state.data).documents;
  }

  async recordAcceptedConsents(tenantId: string, clientId: string, facts: unknown) {
    const id = String(clientId || '').trim();
    if (!id) return [];
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы для онлайн-записи ещё не готовы');
    const current = normalize(state.data);
    const accepted = (Array.isArray(facts) ? facts : []).filter((item: any) => Boolean(item?.accepted) && String(item?.documentId || '').trim());
    if (!accepted.length) return current.consents;
    const next = [...current.consents];
    for (const fact of accepted as any[]) {
      const documentId = String(fact.documentId || '').trim();
      const documentVersion = Math.max(1, Number(fact.documentVersion || 1));
      const exists = next.some((item: any) => String(item?.clientId || '') === id
        && String(item?.documentId || '') === documentId
        && Number(item?.documentVersion || 1) === documentVersion
        && String(item?.status || 'accepted') === 'accepted');
      if (exists) continue;
      const now = new Date().toISOString();
      next.push({
        id: randomUUID(),
        clientId: id,
        documentId,
        documentVersion,
        status: 'accepted',
        acceptedAt: String(fact.acceptedAt || now),
        revokedAt: '',
        source: 'online-booking-account',
        createdAt: now,
      });
    }
    current.consents = next;
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return next;
  }
'''
if 'async publicDocuments(' not in doc:
    idx = doc.rfind('\n}')
    if idx < 0:
        raise SystemExit('DocumentStateService class end not found')
    doc = doc[:idx] + doc_insert + doc[idx:]
write(doc_path, doc)


# BusinessState remains the sole owner of Person / UEI / Record business facts.
biz_path = 'server/src/business-state/business-state.service.ts'
biz = read(biz_path)
if "from 'node:crypto'" not in biz:
    biz = biz.replace("import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';\n",
                      "import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';\nimport { randomUUID } from 'node:crypto';\n", 1)
helper_anchor = "function json(value: unknown): Prisma.InputJsonValue {\n  return clone(value) as Prisma.InputJsonValue;\n}\n"
helper_block = r'''
function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function accountIdsFromPerson(person: JsonObject) {
  return uniqueStrings(Array.isArray(person.accounts) ? person.accounts : []);
}

function bookingFinance(procedures: JsonObject[], discountValue: unknown) {
  const discountPercent = Math.max(0, Math.min(100, Number(discountValue || 0) || 0));
  const items = procedures.map((item) => {
    const price = Math.max(0, Number(String(item?.cost ?? item?.price ?? 0).replace(',', '.')) || 0);
    const discountMoney = price * discountPercent / 100;
    return {
      sourceType: 'procedure',
      sourceId: text(item?.id),
      name: text(item?.name),
      price,
      discountMode: discountPercent > 0 ? 'percent' : 'none',
      discountPercent,
      discountMoney,
      planAmount: Math.max(0, price - discountMoney),
    };
  });
  return {
    items,
    serviceTotal: items.reduce((sum, item) => sum + item.price, 0),
    discountPercent,
    discountTotal: items.reduce((sum, item) => sum + item.discountMoney, 0),
    planTotal: items.reduce((sum, item) => sum + item.planAmount, 0),
  };
}

function liveRecordSnapshot(record: JsonObject, fallback: unknown = null) {
  const finance = objectValue(record.finance);
  const procedures = (Array.isArray(record.procedures) ? record.procedures : []).map((item) => ({
    id: text(item?.id),
    name: text(item?.name),
    cost: item?.cost ?? '',
    duration: Math.max(0, Number(item?.duration || 0)),
  }));
  const subtotal = Math.max(0, Number(finance.serviceTotal || 0));
  const discountPercent = Math.max(0, Math.min(100, Number(finance.discountPercent ?? record?.client?.discountPercent ?? 0) || 0));
  const total = Math.max(0, Number(finance.planTotal ?? subtotal * (1 - discountPercent / 100)) || 0);
  const previous = objectValue(objectValue(fallback).payment);
  const paid = Math.max(0, Number(previous.paid || 0));
  const due = Math.max(0, total - paid);
  return {
    recordId: text(record.id),
    procedures,
    pricing: { subtotal, discountPercent, total },
    payment: { state: paid > 0 ? (due <= 0.009 ? 'paid' : 'partial') : 'unpaid', paid, due },
    updatedAt: text(record.updatedAt) || new Date().toISOString(),
  };
}
'''
if 'function liveRecordSnapshot(' not in biz:
    if helper_anchor not in biz:
        raise SystemExit('BusinessState json helper anchor missing')
    biz = biz.replace(helper_anchor, helper_block, 1)
methods = r'''

  async publicOperational(tenantId: string) {
    const row = await this.requireOperationalVerified(tenantId);
    return normalizeOperational(row.data);
  }

  async bookingIdentityForAccount(tenantId: string, accountId: string) {
    await this.requireVerified(tenantId);
    const id = text(accountId);
    const [rows, identityRow] = await Promise.all([
      this.prisma.businessPerson.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessIdentityState.findUnique({ where: { tenantId } }),
    ]);
    const people = rows.map((row) => ({ row, person: objectValue(row.data) }));
    const matched = people.find(({ person }) => accountIdsFromPerson(person).includes(id)) || null;
    if (!matched) return { person: null, matchedPerson: null, uei: '', memberPeople: [], accountIds: id ? [id] : [] };

    const identity = normalizeUEI(identityRow?.data || {});
    const matchedKey = text(matched.person.key || matched.row.key);
    const uei = text(identity.relations[`person:${matchedKey}`]);
    const entity = uei ? objectValue(identity.entities[uei]) : {};
    const memberKeys = uei
      ? uniqueStrings((Array.isArray(entity.members) ? entity.members : [])
          .map((value) => text(value))
          .filter((value) => value.startsWith('person:'))
          .map((value) => value.slice(7)))
      : [matchedKey];
    const memberPeople = people.filter(({ row, person }) => memberKeys.includes(text(person.key || row.key)));
    const ownerKey = objectValue(entity.owner).type === 'person' ? text(objectValue(entity.owner).id) : '';
    const primary = memberPeople.find(({ row, person }) => text(person.key || row.key) === ownerKey) || matched;
    const accountIds = uniqueStrings(memberPeople.flatMap(({ person }) => accountIdsFromPerson(person)));
    return {
      person: primary.person,
      matchedPerson: matched.person,
      uei,
      memberPeople: memberPeople.map(({ person }) => person),
      accountIds: accountIds.length ? accountIds : [id],
    };
  }

  async upsertBookingPersonFromAccount(tenantId: string, account: JsonObject) {
    await this.requireVerified(tenantId);
    const accountId = text(account.id);
    if (!accountId) throw new BadRequestException('У аккаунта онлайн-записи отсутствует id');
    const rows = await this.prisma.businessPerson.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    const found = rows.find((row) => accountIdsFromPerson(objectValue(row.data)).includes(accountId)) || null;
    const previous = objectValue(found?.data || {});
    const profileData = objectValue(account.profileData);
    const now = new Date().toISOString();
    const person = {
      ...clone(previous),
      key: text(previous.key) || `account-${accountId}`,
      id: text(previous.id),
      name: text(account.name) || text(previous.name),
      surname: text(account.surname) || text(previous.surname),
      photo: text(previous.photo),
      gender: text(profileData.gender) || text(previous.gender),
      birthDate: text(profileData.birthDate) || text(previous.birthDate),
      phones: uniqueStrings([...(Array.isArray(previous.phones) ? previous.phones : []), account.phone]),
      telegrams: uniqueStrings([...(Array.isArray(previous.telegrams) ? previous.telegrams : []), account.telegramId]),
      emails: uniqueStrings([...(Array.isArray(previous.emails) ? previous.emails : []), String(account.email || '').toLowerCase()]),
      accounts: uniqueStrings([...(Array.isArray(previous.accounts) ? previous.accounts : []), accountId]),
      links: Array.isArray(previous.links) ? previous.links : [],
      tags: Array.isArray(previous.tags) ? previous.tags : [],
      discountPercent: Math.max(0, Math.min(100, Number(previous.discountPercent || 0) || 0)),
      agreements: objectValue(previous.agreements),
      visits: Math.max(0, Number(previous.visits || 0)),
      totalSpent: Math.max(0, Number(previous.totalSpent || 0)),
      lastVisit: text(previous.lastVisit),
      programs: Array.isArray(previous.programs) ? previous.programs : [],
      createdAt: text(previous.createdAt) || now,
    };
    const position = found ? found.position : rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
    await this.prisma.businessPerson.upsert({
      where: { tenantId_key: { tenantId, key: person.key } },
      create: { tenantId, key: person.key, position, data: json(person) },
      update: { position, data: json(person) },
    });
    return person;
  }

  async publicBookingOccupancy(tenantId: string) {
    await this.requireVerified(tenantId);
    const [records, events] = await Promise.all([
      this.prisma.businessRecord.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessRecordEvent.findMany({ where: { tenantId } }),
    ]);
    const cancelled = new Set(events.filter((row) => text(objectValue(row.data).type) === 'cancelled').map((row) => row.recordId));
    return records.map((row) => objectValue(row.data)).filter((record) => {
      const id = text(record.id);
      return id && text(record.status) !== 'cancelled' && !cancelled.has(id);
    }).map((record) => ({
      id: text(record.id),
      type: 'record',
      workplaceId: text(record.workplaceId),
      date: text(record.date).slice(0, 10),
      from: text(record.from),
      to: text(record.to),
    })).filter((item) => item.workplaceId && item.date && item.from && item.to);
  }

  async createOnlineBookingRecord(tenantId: string, input: JsonObject) {
    await this.requireVerified(tenantId);
    const requestId = text(input.sourceRequestId);
    if (!requestId) throw new BadRequestException('У онлайн-записи отсутствует sourceRequestId');
    const rows = await this.prisma.businessRecord.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    const existing = rows.find((row) => text(objectValue(row.data).sourceRequestId) === requestId);
    if (existing) return objectValue(existing.data);

    const now = new Date().toISOString();
    const procedures = (Array.isArray(input.procedures) ? input.procedures : []).map((item) => clone(objectValue(item)));
    const client = clone(objectValue(input.client));
    const record = {
      id: randomUUID(),
      date: text(input.date).slice(0, 10),
      workplaceId: text(input.workplaceId),
      from: text(input.from),
      to: text(input.to),
      client,
      procedures,
      products: [],
      source: 'online-booking',
      sourceRequestId: requestId,
      finance: bookingFinance(procedures, client.discountPercent),
      createdAt: now,
      updatedAt: now,
    };
    const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
    const event = { id: randomUUID(), recordId: record.id, type: 'created', at: now, payload: {} };
    await this.prisma.$transaction([
      this.prisma.businessRecord.create({ data: { tenantId, recordId: record.id, position, data: json(record) } }),
      this.prisma.businessRecordEvent.create({ data: { tenantId, eventId: event.id, recordId: record.id, position: 0, data: json(event) } }),
    ]);
    return record;
  }

  async bookingRecordSnapshot(tenantId: string, recordId: string, fallback: unknown = null) {
    const id = text(recordId);
    if (!id) return fallback;
    const row = await this.prisma.businessRecord.findUnique({ where: { tenantId_recordId: { tenantId, recordId: id } } });
    if (!row) return fallback;
    return liveRecordSnapshot(objectValue(row.data), fallback);
  }
'''
if 'async publicOperational(tenantId: string)' not in biz:
    idx = biz.rfind('\n}')
    if idx < 0:
        raise SystemExit('BusinessStateService class end not found')
    biz = biz[:idx] + methods + biz[idx:]
write(biz_path, biz)
replace_once('server/src/business-state/business-state.module.ts',
             '  providers: [BusinessStateService, PrismaService],\n})',
             '  providers: [BusinessStateService, PrismaService],\n  exports: [BusinessStateService],\n})')


# OnlineBooking becomes orchestration only: public context and Record creation consume canonical server owners.
online_path = 'server/src/online-booking/online-booking.service.ts'
online = read(online_path)
if "../business-state/business-state.service" not in online:
    online = online.replace("import { PrismaService } from '../prisma.service';\n",
        "import { PrismaService } from '../prisma.service';\nimport { BusinessStateService } from '../business-state/business-state.service';\nimport { DocumentStateService } from '../document-state/document-state.service';\nimport { ProfileService } from '../profile/profile.service';\n", 1)
online = online.replace(
"  constructor(\n    private readonly prisma: PrismaService,\n    private readonly jwt: JwtService,\n  ) {}",
"  constructor(\n    private readonly prisma: PrismaService,\n    private readonly jwt: JwtService,\n    private readonly businessState: BusinessStateService,\n    private readonly documentState: DocumentStateService,\n    private readonly profile: ProfileService,\n  ) {}")
publication_anchor = r'''  private async publication(tenantId: string) {
    const publication = await this.prisma.bookingPublication.findUnique({ where: { tenantId } });
    if (!publication) throw new NotFoundException('Онлайн-запись ещё не опубликована');
    return publication;
  }
'''
source_helpers = publication_anchor + r'''

  private async bookingSource(tenantId: string) {
    const [profile, operational, documents] = await Promise.all([
      this.profile.publicBookingBundle(tenantId),
      this.businessState.publicOperational(tenantId),
      this.documentState.publicDocuments(tenantId),
    ]);
    return { ...profile, ...operational, documents };
  }

  private async accountView(tenantId: string, account: any) {
    const identity = await this.businessState.bookingIdentityForAccount(tenantId, account.id);
    const person = identity?.person || {};
    return publicAccount({
      ...account,
      uei: identity?.uei || account.uei,
      discountPercent: person.discountPercent ?? account.discountPercent,
      visits: person.visits ?? account.visits,
      totalSpent: person.totalSpent ?? account.totalSpent,
      lastVisit: person.lastVisit ?? account.lastVisit,
      programs: Array.isArray(person.programs) ? person.programs : account.programs,
    });
  }
'''
if 'private async bookingSource(' not in online:
    if publication_anchor not in online:
        raise SystemExit('OnlineBooking publication anchor missing')
    online = online.replace(publication_anchor, source_helpers, 1)

online = replace_method(online, '  async getContext(tenantId: string, workplaceKey = \'\') {', '  async prepareAccount(', r'''  async getContext(tenantId: string, workplaceKey = '') {
    const data = await this.bookingSource(tenantId);
    const allWorkplaces = arrayValue(data.workplaces);
    const requestedWorkplace = text(workplaceKey);
    const selected = requestedWorkplace
      ? allWorkplaces.find((item) => text(item?.key) === requestedWorkplace)
      : null;
    if (requestedWorkplace && !selected) throw new NotFoundException('Рабочее пространство не найдено');

    const allowedKeys = new Set((selected ? [selected] : allWorkplaces).map((item) => text(item?.key)).filter(Boolean));
    const workplaces = selected ? [selected] : allWorkplaces;
    const procedures = arrayValue(data.procedures).filter((procedure) => {
      const assignments = arrayValue(procedure?.workplaces);
      return assignments.some((item) => allowedKeys.has(text(item?.workplaceId ?? item?.key ?? item?.id)));
    });
    const days = arrayValue(data.days).filter((day) => allowedKeys.has(text(day?.workplaceId)));
    const [recordOccupancy, pending] = await Promise.all([
      this.businessState.publicBookingOccupancy(tenantId),
      this.prisma.bookingRequest.findMany({
        where: {
          tenantId,
          status: BookingRequestStatus.PENDING,
          ...(selected ? { workplaceKey: requestedWorkplace } : {}),
        },
        select: { id: true, workplaceKey: true, date: true, from: true, to: true },
      }),
    ]);
    const breaks = arrayValue(data.breaks).map((item) => ({
      id: text(item?.id), type: 'break', workplaceId: text(item?.workplaceId), date: dateValue(item?.date), from: text(item?.from), to: text(item?.to),
    }));
    const occupancy = [...recordOccupancy, ...breaks].filter((item) => allowedKeys.has(text(item?.workplaceId)));

    return {
      tenantId,
      revision: 0,
      profile: objectValue(data.profile),
      settings: objectValue(data.bookingSettings),
      workplaces,
      procedures,
      days,
      documents: arrayValue(data.documents).filter((item) => Boolean(item?.clientConsent)),
      occupancy: [
        ...occupancy,
        ...pending.map((item) => ({
          id: `booking-request:${item.id}`,
          type: 'booking-request',
          workplaceId: item.workplaceKey,
          date: item.date,
          from: item.from,
          to: item.to,
        })),
      ],
    };
  }''')

online = replace_method(online, '  async registerAccount(', '  async loginAccount(', r'''  async registerAccount(tenantId: string, body: Record<string, any>) {
    const documents = await this.documentState.publicDocuments(tenantId);
    const email = emailValue(body.email);
    const password = text(body.password);
    const name = text(body.name);
    const phone = text(body.phone);
    const consents = normalizeConsents(body.consents);
    if (!email || !email.includes('@')) throw new BadRequestException('Введите корректный email');
    if (password.length < 6) throw new BadRequestException('Пароль должен содержать не менее 6 символов');
    if (!name) throw new BadRequestException('Введите имя');
    if (!/^\+\d{8,15}$/.test(phone)) throw new BadRequestException('Введите телефон полностью');
    this.ensureRequiredConsents({ documents }, consents);

    const exists = await this.prisma.bookingAccount.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (exists) throw new ConflictException('Аккаунт с этим email уже существует');

    const account = await this.prisma.bookingAccount.create({
      data: {
        tenantId,
        email,
        passwordHash: await hash(password, 12),
        name,
        surname: text(body.surname),
        phone,
        telegramId: text(body.telegramId),
        consents: consents as Prisma.InputJsonValue,
        profileData: normalizeProfileData(body.profileData) as Prisma.InputJsonValue,
      },
    });
    const person = await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any);
    await this.documentState.recordAcceptedConsents(tenantId, text(person.key), consents);
    return { accessToken: await this.issueAccountToken(account), account: await this.accountView(tenantId, account) };
  }''')

online = replace_method(online, '  async loginAccount(', '  async getAccount(', r'''  async loginAccount(tenantId: string, email: unknown, password: unknown) {
    const normalizedEmail = emailValue(email);
    const account = await this.prisma.bookingAccount.findUnique({
      where: { tenantId_email: { tenantId, email: normalizedEmail } },
    });
    if (!account || !(await compare(text(password), account.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const person = await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any);
    await this.documentState.recordAcceptedConsents(tenantId, text(person.key), normalizeConsents(account.consents));
    return { accessToken: await this.issueAccountToken(account), account: await this.accountView(tenantId, account) };
  }''')

online = replace_method(online, '  async getAccount(', '  async updateAccount(', r'''  async getAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    const person = await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any);
    await this.documentState.recordAcceptedConsents(tenantId, text(person.key), normalizeConsents(account.consents));
    return this.accountView(tenantId, account);
  }''')

online = replace_method(online, '  async updateAccount(', '  async createRequest(', r'''  async updateAccount(tenantId: string, accountId: string, body: Record<string, any>) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    const documents = await this.documentState.publicDocuments(tenantId);
    const incomingConsents = normalizeConsents(body.consents);
    const previous = normalizeConsents(account.consents);
    const merged = [...previous];
    for (const consent of incomingConsents) {
      const index = merged.findIndex((item) => item.documentId === consent.documentId && item.documentVersion === consent.documentVersion);
      if (index >= 0) merged[index] = consent;
      else merged.push(consent);
    }
    this.ensureRequiredConsents({ documents }, merged);

    const phone = text(body.phone) || account.phone;
    if (!/^\+\d{8,15}$/.test(phone)) throw new BadRequestException('Введите телефон полностью');
    const profileData = {
      ...normalizeProfileData(account.profileData),
      ...normalizeProfileData(body.profileData),
    };
    const updated = await this.prisma.bookingAccount.update({
      where: { id: account.id },
      data: {
        name: text(body.name) || account.name,
        surname: body.surname == null ? account.surname : text(body.surname),
        phone,
        telegramId: text(body.telegramId) || account.telegramId,
        consents: merged as Prisma.InputJsonValue,
        profileData: profileData as Prisma.InputJsonValue,
      },
    });
    const person = await this.businessState.upsertBookingPersonFromAccount(tenantId, updated as any);
    await this.documentState.recordAcceptedConsents(tenantId, text(person.key), merged);
    return this.accountView(tenantId, updated);
  }''')

online = replace_method(online, '  async createRequest(', '  async getMyRequests(', r'''  async createRequest(tenantId: string, accountId: string, body: Record<string, any>) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    const data = await this.bookingSource(tenantId);
    const accountConsents = normalizeConsents(account.consents);
    this.ensureRequiredConsents({ documents: data.documents }, accountConsents);
    const workplaceKey = text(body.workplaceKey);
    const date = dateValue(body.date);
    const from = text(body.from);
    if (!workplaceKey || !date || timeToMinutes(from) == null) throw new BadRequestException('Не выбраны дата, время или рабочее пространство');

    const workplace = arrayValue(data.workplaces).find((item) => text(item?.key) === workplaceKey);
    if (!workplace) throw new BadRequestException('Рабочее пространство недоступно');

    const requestedIds = [...new Set(arrayValue(body.procedureIds).map((value) => text(value)).filter(Boolean))];
    if (!requestedIds.length) throw new BadRequestException('Выберите хотя бы одну процедуру');
    const catalog = arrayValue(data.procedures);
    const selected = requestedIds.map((id) => catalog.find((procedure) => text(procedure?.id) === id)).filter(Boolean);
    if (selected.length !== requestedIds.length || selected.some((procedure) => !assignmentFor(procedure, workplaceKey))) {
      throw new BadRequestException('Одна из процедур недоступна в этом рабочем пространстве');
    }

    const duration = selected.reduce((sum, procedure) => sum + Math.max(0, Number(procedure?.duration || 0)), 0);
    if (duration <= 0) throw new BadRequestException('Не удалось определить длительность процедур');
    const start = timeToMinutes(from)!;
    const to = minutesToTime(start + duration);
    if (!to) throw new BadRequestException('Выбранное время недоступно');

    const day = arrayValue(data.days).find((item) => text(item?.workplaceId) === workplaceKey && dateValue(item?.date) === date);
    if (!day) throw new ConflictException('Эта дата больше не доступна');
    const planFrom = text(day?.from) || text(workplace?.from);
    const planTo = text(day?.to) || text(workplace?.to);
    if (!containsRange(planFrom, planTo, from, to)) throw new ConflictException('Время находится вне рабочего графика');

    const [recordOccupancy, pending] = await Promise.all([
      this.businessState.publicBookingOccupancy(tenantId),
      this.prisma.bookingRequest.findMany({
        where: { tenantId, workplaceKey, date, status: BookingRequestStatus.PENDING },
        select: { from: true, to: true },
      }),
    ]);
    const breaks = arrayValue(data.breaks).filter((item) => text(item?.workplaceId) === workplaceKey && dateValue(item?.date) === date);
    const occupancy = [...recordOccupancy.filter((item) => text(item?.workplaceId) === workplaceKey && dateValue(item?.date) === date), ...breaks];
    if (occupancy.some((item) => rangesOverlap(from, to, text(item?.from), text(item?.to)))
      || pending.some((item) => rangesOverlap(from, to, item.from, item.to))) {
      throw new ConflictException('Это время уже занято');
    }

    const procedures = selected.map((procedure) => ({
      id: text(procedure?.id),
      name: text(procedure?.name),
      duration: Math.max(0, Number(procedure?.duration || 0)),
      cost: procedureCost(procedure, workplaceKey),
    }));
    const person = await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any);
    await this.documentState.recordAcceptedConsents(tenantId, text(person.key), accountConsents);
    const identity = await this.businessState.bookingIdentityForAccount(tenantId, account.id);
    const pricingPerson = identity?.person || person;
    const client = {
      key: text(person.key),
      id: text(person.id),
      accountId: account.id,
      name: text(account.name),
      surname: text(account.surname),
      phone: text(account.phone),
      email: text(account.email),
      telegramId: text(account.telegramId),
      discountPercent: percent(pricingPerson?.discountPercent),
    };
    const recordSnapshot = initialRequestSnapshot(procedures, { discountPercent: client.discountPercent });
    const request = await this.prisma.bookingRequest.create({
      data: {
        tenantId,
        accountId,
        workplaceKey,
        date,
        from,
        to,
        procedures: procedures as Prisma.InputJsonValue,
        recordSnapshot: recordSnapshot as Prisma.InputJsonValue,
      },
    });

    try {
      const record = await this.businessState.createOnlineBookingRecord(tenantId, {
        date,
        workplaceId: workplaceKey,
        from,
        to,
        client,
        procedures,
        sourceRequestId: request.id,
      });
      const liveSnapshot = await this.businessState.bookingRecordSnapshot(tenantId, text(record.id), recordSnapshot);
      const imported = await this.prisma.bookingRequest.update({
        where: { id: request.id },
        data: {
          status: BookingRequestStatus.IMPORTED,
          importedRecordId: text(record.id),
          recordSnapshot: liveSnapshot as Prisma.InputJsonValue,
        },
      });
      return { ...imported, procedures, recordSnapshot: liveSnapshot };
    } catch (error) {
      await this.prisma.bookingRequest.update({ where: { id: request.id }, data: { status: BookingRequestStatus.REJECTED } }).catch(() => null);
      throw error;
    }
  }''')

online = replace_method(online, '  async getMyRequests(', '  async ownerAccounts(', r'''  async getMyRequests(tenantId: string, accountId: string) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any);
    const identity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    const accountIds = identity?.accountIds?.length ? identity.accountIds : [account.id];
    const requests = await this.prisma.bookingRequest.findMany({
      where: {
        tenantId,
        accountId: { in: accountIds },
        status: { not: BookingRequestStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(requests.map(async (request) => ({
      ...request,
      recordSnapshot: request.importedRecordId
        ? await this.businessState.bookingRecordSnapshot(tenantId, request.importedRecordId, request.recordSnapshot)
        : request.recordSnapshot,
    })));
  }''')
write(online_path, online)

# OnlineBooking consumes canonical owner modules.
module_path = 'server/src/online-booking/online-booking.module.ts'
module = read(module_path)
if "BusinessStateModule" not in module:
    module = module.replace("import { AuthModule } from '../auth/auth.module';\n",
        "import { AuthModule } from '../auth/auth.module';\nimport { BusinessStateModule } from '../business-state/business-state.module';\nimport { DocumentStateModule } from '../document-state/document-state.module';\nimport { ProfileModule } from '../profile/profile.module';\n", 1)
module = module.replace('  imports: [AuthModule],', '  imports: [AuthModule, BusinessStateModule, DocumentStateModule, ProfileModule],')
write(module_path, module)

# Browser side becomes a server mirror only; it no longer publishes or imports booking facts.
write('online-booking/server-sync.js', r'''import { apiRequest } from '../core/auth.js';
import { flushBusinessPersistence } from '../core/business-persistence.js';
import { hydrateRecordStateFromServer } from '../core/record/index.js';
import { hydrateUEIFromServer } from '../core/uei.js';
import { hydrateClientsFromServer } from '../main/clients/data.js';
import { hydrateConsentsFromServer } from '../settings/documents/consents.js';
import { hydrateDocumentsFromServer } from '../settings/documents/data.js';
import { hydrateDocumentHistoryFromServer } from '../settings/documents/history.js';

const POLL_MS = 4000;
let timer = null;
let running = false;
let lastBusiness = '';
let lastDocuments = '';

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

async function pull() {
  if (running) return;
  running = true;
  try {
    await flushBusinessPersistence();
    const [businessResponse, documentResponse] = await Promise.all([
      apiRequest('/business-state'),
      apiRequest('/document-state'),
    ]);
    const business = await responseJson(businessResponse, 'Не удалось обновить рабочие данные');
    const documents = await responseJson(documentResponse, 'Не удалось обновить документы');

    const businessSnapshot = JSON.stringify({
      people: business.people || [],
      uei: business.uei || {},
      records: business.records || [],
      recordEvents: business.recordEvents || [],
    });
    if (business.verified && businessSnapshot !== lastBusiness) {
      lastBusiness = businessSnapshot;
      hydrateClientsFromServer(business.people || []);
      hydrateUEIFromServer(business.uei || {});
      hydrateRecordStateFromServer({ records: business.records || [], recordEvents: business.recordEvents || [] });
      window.dispatchEvent(new CustomEvent('book:records-changed', { detail: { action: 'server-refresh' } }));
      window.dispatchEvent(new CustomEvent('book:time-usage-changed', { detail: { action: 'server-refresh' } }));
      window.dispatchEvent(new CustomEvent('book:clients-changed', { detail: { action: 'server-refresh' } }));
    }

    const documentData = documents?.data || {};
    const documentSnapshot = JSON.stringify(documentData);
    if (documents.verified && documentSnapshot !== lastDocuments) {
      lastDocuments = documentSnapshot;
      hydrateDocumentsFromServer(documentData.documents || []);
      hydrateConsentsFromServer(documentData.consents || []);
      hydrateDocumentHistoryFromServer(documentData.history || []);
      window.dispatchEvent(new CustomEvent('book:documents-changed', { detail: { action: 'server-refresh' } }));
    }
  } catch {
    // Server remains the owner. A temporary network failure must not break the open Book UI.
  } finally {
    running = false;
  }
}

export function startServerBookingSync() {
  if (timer) return () => stopServerBookingSync();
  void pull();
  timer = window.setInterval(() => void pull(), POLL_MS);
  const refresh = () => void pull();
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  return () => stopServerBookingSync();
}

export function stopServerBookingSync() {
  if (timer) window.clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', pull);
  window.removeEventListener('focus', pull);
}
''')

core_path = 'core.js'
core = read(core_path)
core = core.replace("import { startOnlineBookingBridge } from './online-booking/owner-bridge.js';", "import { startServerBookingSync } from './online-booking/server-sync.js';")
core = core.replace('let bookingBridgeStarted = false;', 'let serverBookingSyncStarted = false;')
core = core.replace('function ensureBookingBridge() {\n  if (bookingBridgeStarted) return;\n  bookingBridgeStarted = true;\n  startOnlineBookingBridge();\n}',
                    'function ensureServerBookingSync() {\n  if (serverBookingSyncStarted) return;\n  serverBookingSyncStarted = true;\n  startServerBookingSync();\n}')
core = core.replace('  ensureBookingBridge();', '  ensureServerBookingSync();')
write(core_path, core)
old_bridge = Path('online-booking/owner-bridge.js')
if old_bridge.exists():
    old_bridge.unlink()

# Deployment marker: health only reports autonomy once all required server storage tables are reachable.
health_path = 'server/src/health.controller.ts'
health = read(health_path)
health = health.replace("return { status: 'ok', database: 'ok', profileStorage: 'ok', businessStorage: 'ok', operationalStorage: 'ok', documentStorage: 'ok' };",
                        "return { status: 'ok', database: 'ok', profileStorage: 'ok', businessStorage: 'ok', operationalStorage: 'ok', documentStorage: 'ok', bookingAutonomy: 'server' };")
write(health_path, health)

# Architectural guard: active booking flow must not depend on a browser publication/import bridge.
write('scripts/check-booking-server-autonomy.mjs', r'''import fs from 'node:fs';

function text(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const core = text('core.js');
const service = text('server/src/online-booking/online-booking.service.ts');
const business = text('server/src/business-state/business-state.service.ts');
const sync = text('online-booking/server-sync.js');

assert(!core.includes('owner-bridge'), 'core.js must not start the legacy owner booking bridge');
assert(core.includes('startServerBookingSync'), 'Book must use server-owned live refresh');
const contextBlock = service.slice(service.indexOf('async getContext('), service.indexOf('async prepareAccount('));
assert(!contextBlock.includes('this.publication('), 'public booking context must not depend on BookingPublication');
const requestBlock = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert(requestBlock.includes('createOnlineBookingRecord'), 'online booking must create canonical Record on the server');
assert(requestBlock.includes('BookingRequestStatus.IMPORTED'), 'server-created booking request must be finalized without browser import');
assert(service.includes('recordAcceptedConsents'), 'online consent facts must be written to canonical Documents state');
assert(business.includes('publicBookingOccupancy'), 'availability must consume canonical server Records');
assert(business.includes('upsertBookingPersonFromAccount'), 'online Account must create/update canonical Person on the server');
assert(!sync.includes('/online-booking/owner/publication'), 'browser sync must not publish booking context');
assert(!sync.includes('/online-booking/owner/requests'), 'browser sync must not import booking requests');
console.log('booking server autonomy check: OK');
''')
write('tests/booking-server-autonomy.test.mjs', r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const business = fs.readFileSync('server/src/business-state/business-state.service.ts', 'utf8');
const documentState = fs.readFileSync('server/src/document-state/document-state.service.ts', 'utf8');

const request = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert.match(request, /createOnlineBookingRecord/);
assert.match(request, /status: BookingRequestStatus\.IMPORTED/);
assert.match(request, /publicBookingOccupancy/);
assert.match(business, /source: 'online-booking'/);
assert.match(business, /type: 'created'/);
assert.match(documentState, /source: 'online-booking-account'/);
console.log('booking server autonomy tests passed');
''')

package_path = 'package.json'
pkg = json.loads(read(package_path))
check = pkg['scripts']['check']
if 'check-booking-server-autonomy.mjs' not in check:
    pkg['scripts']['check'] = check + ' && node scripts/check-booking-server-autonomy.mjs'
test = pkg['scripts']['test']
if 'booking-server-autonomy.test.mjs' not in test:
    pkg['scripts']['test'] = test + ' && node tests/booking-server-autonomy.test.mjs'
write(package_path, json.dumps(pkg, ensure_ascii=False, separators=(',', ':')) + '\n')

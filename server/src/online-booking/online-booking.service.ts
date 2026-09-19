import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BookingRequestStatus, Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { BusinessStateService } from '../business-state/business-state.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { DocumentStateService } from '../document-state/document-state.service';
import { ProfileService } from '../profile/profile.service';
import { ClientCardLinkService } from './client-card-link.service';

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function emailValue(value: unknown) {
  return text(value).toLowerCase();
}

function dateValue(value: unknown) {
  const result = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : '';
}

function numeric(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function percent(value: unknown) {
  return Math.max(0, Math.min(100, numeric(value, 0)));
}

function timeToMinutes(value: unknown) {
  const match = text(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 24 * 60) return '';
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function rangesOverlap(leftFrom: string, leftTo: string, rightFrom: string, rightTo: string) {
  const a = timeToMinutes(leftFrom);
  const b = timeToMinutes(leftTo);
  const c = timeToMinutes(rightFrom);
  const d = timeToMinutes(rightTo);
  return a != null && b != null && c != null && d != null && a < d && c < b;
}

function containsRange(planFrom: string, planTo: string, from: string, to: string) {
  const start = timeToMinutes(planFrom);
  const end = timeToMinutes(planTo);
  const candidateStart = timeToMinutes(from);
  const candidateEnd = timeToMinutes(to);
  return start != null && end != null && candidateStart != null && candidateEnd != null
    && candidateEnd > candidateStart && start <= candidateStart && candidateEnd <= end;
}

function assignmentFor(procedure: any, workplaceKey: string) {
  return arrayValue(procedure?.workplaces).find((item) => text(item?.workplaceId ?? item?.key ?? item?.id) === workplaceKey) || null;
}

function procedureCost(procedure: any, workplaceKey: string) {
  const assignment = assignmentFor(procedure, workplaceKey);
  const assigned = assignment?.cost;
  const base = procedure?.cost;
  const hasAssigned = assigned && typeof assigned === 'object' && !assigned.free && (
    assigned.amount !== '' && assigned.amount != null
    || assigned.from !== '' && assigned.from != null
    || assigned.to !== '' && assigned.to != null
  );
  const cost = hasAssigned ? assigned : base;
  if (cost == null || cost?.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

function normalizeConsents(value: unknown) {
  return arrayValue(value).map((item) => ({
    documentId: text(item?.documentId),
    documentVersion: Math.max(1, Number(item?.documentVersion || 1)),
    accepted: Boolean(item?.accepted),
    acceptedAt: text(item?.acceptedAt) || new Date().toISOString(),
  })).filter((item) => item.documentId);
}

function uniqueStrings(value: unknown, normalize: (item: unknown) => string, limit = 5) {
  return [...new Set(arrayValue(value).map(normalize).filter(Boolean))].slice(0, limit);
}

function normalizeProfileData(value: unknown) {
  const source = objectValue(value);
  const gender = text(source.gender);
  const links = arrayValue(source.links).map((item) => ({
    type: text(item?.type).slice(0, 40),
    url: text(item?.url).slice(0, 1000),
  })).filter((item) => item.url).slice(0, 8);
  return {
    gender: ['male', 'female'].includes(gender) ? gender : '',
    birthDate: dateValue(source.birthDate),
    photo: text(source.photo).slice(0, 5_000_000),
    phones: uniqueStrings(source.phones, (item) => {
      const value = text(item);
      return /^\+\d{8,15}$/.test(value) ? value : '';
    }),
    emails: uniqueStrings(source.emails, (item) => {
      const value = emailValue(item);
      return value.includes('@') ? value.slice(0, 254) : '';
    }),
    telegram: text(source.telegram).slice(0, 100),
    links,
  };
}

function publicAccount(account: any) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    surname: account.surname,
    phone: account.phone,
    telegramId: account.telegramId || '',
    profileData: normalizeProfileData(account.profileData),
    uei: text(account.uei),
    discountPercent: percent(account.discountPercent),
    visits: Math.max(0, Math.floor(numeric(account.visits, 0))),
    totalSpent: Math.max(0, numeric(account.totalSpent, 0)),
    lastVisit: text(account.lastVisit),
    programs: arrayValue(account.programs),
    createdAt: account.createdAt,
  };
}

function initialRequestSnapshot(procedures: any[], account: any) {
  const subtotal = procedures.reduce((sum, item) => sum + Math.max(0, numeric(item?.cost, 0)), 0);
  const discountPercent = percent(account?.discountPercent);
  const total = Math.max(0, subtotal * (1 - discountPercent / 100));
  return {
    procedures,
    pricing: { subtotal, discountPercent, total },
    payment: { state: total <= 0.009 ? 'paid' : 'unpaid', paid: 0, due: total },
    updatedAt: new Date().toISOString(),
  };
}

@Injectable()
export class OnlineBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly businessState: BusinessStateService,
    private readonly documentState: DocumentStateService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly profile: ProfileService,
    private readonly clientCards: ClientCardLinkService,
  ) {}

  private async publication(tenantId: string) {
    const publication = await this.prisma.bookingPublication.findUnique({ where: { tenantId } });
    if (!publication) throw new NotFoundException('Онлайн-запись ещё не опубликована');
    return publication;
  }

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
    const cardStats = await this.clientCards.cardStats(tenantId, account);
    return publicAccount({
      ...account,
      uei: identity?.uei || account.uei,
      discountPercent: person.discountPercent ?? account.discountPercent,
      visits: cardStats?.visits ?? person.visits ?? account.visits,
      totalSpent: cardStats?.totalSpent ?? person.totalSpent ?? account.totalSpent,
      lastVisit: cardStats?.lastVisit || person.lastVisit || account.lastVisit,
      programs: Array.isArray(person.programs) ? person.programs : account.programs,
    });
  }

  private async issueAccountToken(account: { id: string; tenantId: string }) {
    return this.jwt.signAsync({
      sub: account.id,
      tenantId: account.tenantId,
      kind: 'booking-account',
    }, { expiresIn: '30d' });
  }

  private ensureRequiredConsents(publicationData: Record<string, any>, consents: any[]) {
    const documents = arrayValue(publicationData.documents);
    const required = documents.filter((item) => Boolean(item?.clientConsent) && Boolean(item?.required));
    for (const document of required) {
      const accepted = consents.some((item) => item.documentId === text(document.id)
        && Number(item.documentVersion) === Math.max(1, Number(document.version || 1))
        && item.accepted);
      if (!accepted) throw new BadRequestException(`Необходимо согласие: ${text(document.title) || 'обязательный документ'}`);
    }
  }

  async publish(tenantId: string, data: unknown) {
    const normalized = objectValue(data);
    return this.prisma.bookingPublication.upsert({
      where: { tenantId },
      create: { tenantId, data: normalized as Prisma.InputJsonValue, revision: 1 },
      update: { data: normalized as Prisma.InputJsonValue, revision: { increment: 1 } },
      select: { revision: true, updatedAt: true },
    });
  }

  async getContext(tenantId: string, workplaceKey = '') {
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
  }

  async prepareAccount(tenantId: string, email: unknown) {
    const normalizedEmail = emailValue(email);
    if (!normalizedEmail) throw new BadRequestException('Введите email');
    const account = await this.prisma.bookingAccount.findUnique({
      where: { tenantId_email: { tenantId, email: normalizedEmail } },
      select: { id: true },
    });
    return { exists: Boolean(account) };
  }

  async registerAccount(tenantId: string, body: Record<string, any>) {
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
        consents: [] as Prisma.InputJsonValue,
        profileData: normalizeProfileData(body.profileData) as Prisma.InputJsonValue,
      },
    });
    const card = await this.clientCards.cardState(tenantId, account.phone);
    const binding = card.owner
      ? await this.clientCards.bindFirstAccess(tenantId, account as any)
      : {
          person: await this.businessState.upsertBookingPersonFromAccount(tenantId, account as any),
          clientCardExisted: false,
        };
    await this.consentPolicy.acceptAccountConsents(tenantId, account.id, consents, 'online-booking-registration');
    if (consents.some((item) => item.documentId === 'messages-consent' && item.accepted)) {
      await this.consentPolicy.acceptContactPointConsent(tenantId, 'PHONE', account.phone, 'messages-consent', 'online-booking-registration');
      await this.consentPolicy.acceptContactPointConsent(tenantId, 'EMAIL', account.email, 'messages-consent', 'online-booking-registration');
    }
    return {
      accessToken: await this.issueAccountToken(account),
      account: await this.accountView(tenantId, account),
      clientCardExisted: binding.clientCardExisted,
    };
  }

  async loginAccount(tenantId: string, email: unknown, password: unknown) {
    const normalizedEmail = emailValue(email);
    const account = await this.prisma.bookingAccount.findUnique({
      where: { tenantId_email: { tenantId, email: normalizedEmail } },
    });
    if (!account || !(await compare(text(password), account.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const binding = await this.clientCards.bindFirstAccess(tenantId, account as any);
    await this.consentPolicy.ensureCanonicalConsentEvents(tenantId);
    return {
      accessToken: await this.issueAccountToken(account),
      account: await this.accountView(tenantId, account),
      clientCardExisted: binding.clientCardExisted,
    };
  }

  async getAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    await this.clientCards.bindFirstAccess(tenantId, account as any);
    await this.consentPolicy.ensureCanonicalConsentEvents(tenantId);
    return this.accountView(tenantId, account);
  }

  async updateAccount(tenantId: string, accountId: string, body: Record<string, any>) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');

    const phone = text(body.phone) || account.phone;
    if (!/^\+\d{8,15}$/.test(phone)) throw new BadRequestException('Введите телефон полностью');
    const profileData = body.profileData == null
      ? normalizeProfileData(account.profileData)
      : normalizeProfileData({ ...objectValue(account.profileData), ...objectValue(body.profileData) });
    const updated = await this.prisma.bookingAccount.update({
      where: { id: account.id },
      data: {
        name: text(body.name) || account.name,
        surname: body.surname == null ? account.surname : text(body.surname),
        phone,
        telegramId: text(body.telegramId) || account.telegramId,
        profileData: profileData as Prisma.InputJsonValue,
      },
    });
    await this.clientCards.bindFirstAccess(tenantId, updated as any);
    return this.accountView(tenantId, updated);
  }

  async changeAccountPassword(tenantId: string, accountId: string, currentPassword: unknown, newPassword: unknown) {
    const current = String(currentPassword ?? '');
    const next = String(newPassword ?? '');
    if (next.length < 8) throw new BadRequestException('Новый пароль должен содержать минимум 8 символов');
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    if (!(await compare(current, account.passwordHash))) throw new BadRequestException('Текущий пароль указан неверно');
    if (await compare(next, account.passwordHash)) throw new BadRequestException('Новый пароль должен отличаться от текущего');
    await this.prisma.bookingAccount.update({
      where: { id: account.id },
      data: { passwordHash: await hash(next, 12) },
    });
    return { changed: true };
  }

  async createRequest(tenantId: string, accountId: string, body: Record<string, any>) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    const data = await this.bookingSource(tenantId);
    if (!(await this.consentPolicy.hasActivePdnConsent(tenantId, accountId))) {
      throw new ConflictException('Необходимо подтвердить согласие на обработку персональных данных');
    }
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
    const binding = await this.clientCards.bindFirstAccess(tenantId, account as any);
    const person = binding.person;
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
  }

  async getMyRequests(tenantId: string, accountId: string) {
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new UnauthorizedException('Аккаунт не найден');
    await this.clientCards.bindFirstAccess(tenantId, account as any);
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
    const requestViews = await Promise.all(requests.map(async (request) => ({
      ...request,
      recordSnapshot: request.importedRecordId
        ? await this.businessState.bookingRecordSnapshot(tenantId, request.importedRecordId, request.recordSnapshot)
        : request.recordSnapshot,
    })));
    const importedRecordIds = new Set(requests.map((request) => text(request.importedRecordId)).filter(Boolean));
    const manualViews = await this.clientCards.manualRecordViews(tenantId, account as any, importedRecordIds);
    return [...requestViews, ...manualViews].sort((left, right) => {
      const a = `${dateValue((left as any).date)}T${text((left as any).from)}`;
      const b = `${dateValue((right as any).date)}T${text((right as any).from)}`;
      return b.localeCompare(a);
    });
  }

  async ownerAccounts(tenantId: string) {
    const accounts = await this.prisma.bookingAccount.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return accounts.map(publicAccount);
  }

  async syncOwnerAccounts(tenantId: string, value: unknown) {
    const items = arrayValue(value);
    let updated = 0;
    for (const item of items) {
      const accountId = text(item?.accountId ?? item?.id);
      if (!accountId) continue;
      const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId } });
      if (!account) continue;
      await this.prisma.bookingAccount.update({
        where: { id: account.id },
        data: {
          uei: text(item?.uei),
          discountPercent: percent(item?.discountPercent),
          visits: Math.max(0, Math.floor(numeric(item?.visits, 0))),
          totalSpent: Math.max(0, numeric(item?.totalSpent, 0)),
          lastVisit: text(item?.lastVisit),
          programs: arrayValue(item?.programs) as Prisma.InputJsonValue,
        },
      });
      updated += 1;
    }
    return { updated };
  }

  async pendingRequests(tenantId: string) {
    return this.prisma.bookingRequest.findMany({
      where: { tenantId, status: BookingRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        account: {
          select: { id: true, email: true, name: true, surname: true, phone: true, telegramId: true, profileData: true },
        },
      },
    });
  }

  async markImported(tenantId: string, requestId: string, recordId: unknown) {
    const request = await this.prisma.bookingRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('Запрос записи не найден');
    return this.prisma.bookingRequest.update({
      where: { id: request.id },
      data: { status: BookingRequestStatus.IMPORTED, importedRecordId: text(recordId) },
    });
  }

  async syncRequestSnapshot(tenantId: string, requestId: string, snapshot: unknown) {
    const request = await this.prisma.bookingRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('Запрос записи не найден');
    const normalized = objectValue(snapshot);
    return this.prisma.bookingRequest.update({
      where: { id: request.id },
      data: { recordSnapshot: normalized as Prisma.InputJsonValue },
      select: { id: true, updatedAt: true },
    });
  }

  async markRejected(tenantId: string, requestId: string) {
    const request = await this.prisma.bookingRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('Запрос записи не найден');
    return this.prisma.bookingRequest.update({
      where: { id: request.id },
      data: { status: BookingRequestStatus.REJECTED },
    });
  }
}

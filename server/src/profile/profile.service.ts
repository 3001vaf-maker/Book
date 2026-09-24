import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, Workplace as WorkplaceRow } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { resolveWorkplaceTimeZone } from '../time/workplace-time-zone';

type ProfileInput = {
  id?: string;
  platformAccountId?: string;
  key: string;
  name: string;
  surname: string;
  phone: string;
  phones: string[];
  telegrams: string[];
  emails: string[];
  about: string;
  photo: string;
  photoCropX: number;
  photoCropY: number;
  profession: string;
  experience: string;
  professionAbout: string;
};

type LinkInput = { type: string; url: string };

type WorkplaceInput = {
  key: string;
  profileId: string;
  photo: string;
  photoCropX: number;
  photoCropY: number;
  name: string;
  color: string;
  city: string;
  address: string;
  phone: string;
  currency: string;
  timeZone: string;
  from: string;
  to: string;
  links: LinkInput[];
  about: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileBundleInput = {
  profile: ProfileInput;
  customProfessions: string[];
  workplaces: WorkplaceInput[];
};

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function stringList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((item) => stringValue(item).trim())
    .filter(Boolean);
}

function cropPosition(value: unknown, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeLinks(value: unknown): LinkInput[] {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({ type: stringValue(item.type), url: stringValue(item.url) }));
}

function normalizeProfile(value: unknown): ProfileInput {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const phones = stringList(source.phones);
  const fallbackPhone = stringValue(source.phone).trim();
  const normalizedPhones = phones.length ? phones : fallbackPhone ? [fallbackPhone] : [];
  return {
    key: stringValue(source.key, 'profile') || 'profile',
    name: stringValue(source.name),
    surname: stringValue(source.surname),
    phone: normalizedPhones[0] || '',
    phones: normalizedPhones,
    telegrams: stringList(source.telegrams),
    emails: stringList(source.emails),
    about: stringValue(source.about),
    photo: stringValue(source.photo),
    photoCropX: cropPosition(source.photoCropX),
    photoCropY: cropPosition(source.photoCropY),
    profession: stringValue(source.profession),
    experience: stringValue(source.experience),
    professionAbout: stringValue(source.professionAbout),
  };
}

function normalizeWorkplace(value: unknown): WorkplaceInput {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    key: stringValue(source.key).trim(),
    profileId: stringValue(source.profileId, 'profile') || 'profile',
    photo: stringValue(source.photo),
    photoCropX: cropPosition(source.photoCropX),
    photoCropY: cropPosition(source.photoCropY),
    name: stringValue(source.name),
    color: stringValue(source.color),
    city: stringValue(source.city),
    address: stringValue(source.address),
    phone: stringValue(source.phone),
    currency: stringValue(source.currency, 'RUB') || 'RUB',
    timeZone: resolveWorkplaceTimeZone(source.city, source.timeZone),
    from: stringValue(source.from, '09:00') || '09:00',
    to: stringValue(source.to, '18:00') || '18:00',
    links: normalizeLinks(source.links),
    about: stringValue(source.about),
    createdAt: stringValue(source.createdAt),
    updatedAt: stringValue(source.updatedAt),
  };
}

function normalizeBundle(value: unknown): ProfileBundleInput {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const workplaces = (Array.isArray(source.workplaces) ? source.workplaces : []).map(normalizeWorkplace);
  const keys = workplaces.map((item) => item.key);
  if (keys.some((key) => !key)) throw new BadRequestException('У рабочего места отсутствует key');
  if (new Set(keys).size !== keys.length) throw new BadRequestException('Дублирующиеся key рабочих мест');
  return {
    profile: normalizeProfile(source.profile),
    customProfessions: stringList(source.customProfessions),
    workplaces,
  };
}

function profileData(profile: ProfileInput, customProfessions: string[]) {
  return {
    key: profile.key,
    name: profile.name,
    surname: profile.surname,
    phone: profile.phone,
    phones: profile.phones as Prisma.InputJsonValue,
    telegrams: profile.telegrams as Prisma.InputJsonValue,
    emails: profile.emails as Prisma.InputJsonValue,
    about: profile.about,
    photo: profile.photo,
    photoCropX: profile.photoCropX,
    photoCropY: profile.photoCropY,
    profession: profile.profession,
    experience: profile.experience,
    professionAbout: profile.professionAbout,
    customProfessions: customProfessions as Prisma.InputJsonValue,
  };
}

function workplaceData(workplace: WorkplaceInput, position: number) {
  return {
    key: workplace.key,
    position,
    photo: workplace.photo,
    photoCropX: workplace.photoCropX,
    photoCropY: workplace.photoCropY,
    name: workplace.name,
    color: workplace.color,
    city: workplace.city,
    address: workplace.address,
    phone: workplace.phone,
    currency: workplace.currency,
    timeZone: workplace.timeZone,
    from: workplace.from,
    to: workplace.to,
    links: workplace.links as Prisma.InputJsonValue,
    about: workplace.about,
    sourceCreatedAt: workplace.createdAt,
    sourceUpdatedAt: workplace.updatedAt,
  };
}

function workplaceDto(workplace: WorkplaceRow): WorkplaceInput {
  return {
    key: workplace.key,
    profileId: 'profile',
    photo: workplace.photo,
    photoCropX: workplace.photoCropX,
    photoCropY: workplace.photoCropY,
    name: workplace.name,
    color: workplace.color,
    city: workplace.city,
    address: workplace.address,
    phone: workplace.phone,
    currency: workplace.currency,
    timeZone: workplace.timeZone,
    from: workplace.from,
    to: workplace.to,
    links: normalizeLinks(workplace.links),
    about: workplace.about,
    createdAt: workplace.sourceCreatedAt,
    updatedAt: workplace.sourceUpdatedAt,
  };
}

function canonical(value: ProfileBundleInput) {
  return JSON.stringify(value);
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async bundle(tenantId: string, platformAccountId: string) {
    const row = await this.prisma.profile.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      include: { workplaces: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!row) {
      return {
        migrated: false,
        verified: false,
        migrationVerifiedAt: null,
        profile: null,
        customProfessions: [],
        workplaces: [],
      };
    }

    const profile: ProfileInput = {
      id: row.id,
      platformAccountId: row.platformAccountId,
      key: row.key,
      name: row.name,
      surname: row.surname,
      phone: row.phone,
      phones: stringList(row.phones),
      telegrams: stringList(row.telegrams),
      emails: stringList(row.emails),
      about: row.about,
      photo: row.photo,
      photoCropX: row.photoCropX,
      photoCropY: row.photoCropY,
      profession: row.profession,
      experience: row.experience,
      professionAbout: row.professionAbout,
    };

    return {
      migrated: true,
      verified: Boolean(row.migrationVerifiedAt),
      migrationVerifiedAt: row.migrationVerifiedAt,
      profile,
      customProfessions: stringList(row.customProfessions),
      workplaces: row.workplaces.map(workplaceDto),
    };
  }

  get(tenantId: string, platformAccountId: string) {
    return this.bundle(tenantId, platformAccountId);
  }

  async migrate(tenantId: string, platformAccountId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const existing = await this.prisma.profile.findUnique({ where: { tenantId_platformAccountId: { tenantId, platformAccountId } } });
    if (existing) return this.bundle(tenantId, platformAccountId);

    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: { tenantId, platformAccountId, ...profileData(expected.profile, expected.customProfessions) },
      });
      if (expected.workplaces.length) {
        await tx.workplace.createMany({
          data: expected.workplaces.map((workplace, position) => ({
            tenantId,
            profileId: profile.id,
            ...workplaceData(workplace, position),
          })),
        });
      }
    });

    return this.bundle(tenantId, platformAccountId);
  }

  async verifyMigration(tenantId: string, platformAccountId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const current = await this.bundle(tenantId, platformAccountId);
    if (!current.migrated || !current.profile) throw new NotFoundException('Профиль ещё не перенесён');

    const actual = normalizeBundle({
      profile: current.profile,
      customProfessions: current.customProfessions,
      workplaces: current.workplaces,
    });
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса Profile + Workplaces не пройдена');
    }

    await this.prisma.profile.update({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      data: { migrationVerifiedAt: new Date() },
    });
    return this.bundle(tenantId, platformAccountId);
  }

  async bootstrap(tenantId: string, platformAccountId: string) {
    const existing = await this.prisma.profile.findUnique({ where: { tenantId_platformAccountId: { tenantId, platformAccountId } } });
    if (!existing) {
      const account = await this.prisma.platformAccount.findUnique({ where: { id: platformAccountId }, select: { email: true } });
      const empty = normalizeProfile({ emails: account?.email ? [account.email] : [] });
      await this.prisma.profile.create({
        data: {
          tenantId,
          platformAccountId,
          ...profileData(empty, []),
          migrationVerifiedAt: new Date(),
        },
      });
    }
    return this.bundle(tenantId, platformAccountId);
  }

  async updateProfile(tenantId: string, platformAccountId: string, body: unknown) {
    const current = await this.prisma.profile.findUnique({ where: { tenantId_platformAccountId: { tenantId, platformAccountId } } });
    if (!current?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');
    const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const profile = normalizeProfile(source.profile ?? source);
    const customProfessions = source.customProfessions === undefined
      ? stringList(current.customProfessions)
      : stringList(source.customProfessions);
    await this.prisma.profile.update({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      data: profileData(profile, customProfessions),
    });
    return this.bundle(tenantId, platformAccountId);
  }

  async reorderWorkplaces(tenantId: string, platformAccountId: string, body: unknown) {
    const profile = await this.prisma.profile.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      include: { workplaces: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, key: true } } },
    });
    if (!profile?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');

    const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const keys = Array.isArray(source.keys) ? source.keys.map((value) => stringValue(value).trim()).filter(Boolean) : [];
    const uniqueKeys = [...new Set(keys)];
    const currentKeys = profile.workplaces.map((item) => item.key);
    if (uniqueKeys.length !== currentKeys.length || uniqueKeys.some((key) => !currentKeys.includes(key))) {
      throw new BadRequestException('Некорректный порядок рабочих пространств');
    }

    const byKey = new Map(profile.workplaces.map((item) => [item.key, item.id]));
    await this.prisma.$transaction(uniqueKeys.map((key, position) => this.prisma.workplace.update({
      where: { id: byKey.get(key)! },
      data: { position },
    })));
    return this.bundle(tenantId, platformAccountId);
  }

  async upsertWorkplace(tenantId: string, platformAccountId: string, key: string, body: unknown) {
    const profile = await this.prisma.profile.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      include: { workplaces: { select: { position: true } } },
    });
    if (!profile?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');

    const workplace = normalizeWorkplace({
      ...(body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}),
      key,
    });
    if (!workplace.key) throw new BadRequestException('У рабочего места отсутствует key');
    const existing = await this.prisma.workplace.findUnique({ where: { tenantId_key: { tenantId, key: workplace.key } } });
    const now = new Date().toISOString();
    const position = existing ? existing.position : (profile.workplaces.reduce((max, item) => Math.max(max, item.position), -1) + 1);
    const normalized = {
      ...workplace,
      createdAt: existing?.sourceCreatedAt || workplace.createdAt || now,
      updatedAt: now,
    };

    await this.prisma.workplace.upsert({
      where: { tenantId_key: { tenantId, key: workplace.key } },
      create: {
        tenantId,
        profileId: profile.id,
        ...workplaceData(normalized, position),
      },
      update: workplaceData(normalized, position),
    });
    return this.bundle(tenantId, platformAccountId);
  }

  async deleteWorkplace(tenantId: string, platformAccountId: string, key: string) {
    const profile = await this.prisma.profile.findUnique({ where: { tenantId_platformAccountId: { tenantId, platformAccountId } } });
    if (!profile?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');
    const existing = await this.prisma.workplace.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (!existing || existing.profileId !== profile.id) throw new NotFoundException('Рабочее место не найдено');
    await this.prisma.workplace.delete({ where: { tenantId_key: { tenantId, key } } });
    return this.bundle(tenantId, platformAccountId);
  }

  async accountControls(tenantId: string, platformAccountId: string) {
    const [documents, preferences] = await Promise.all([
      this.prisma.$queryRaw<Array<{
        documentId: string;
        key: string;
        type: string;
        title: string;
        requiredForRegistration: boolean;
        currentVersion: number;
        latestAction: string | null;
        latestOccurredAt: Date | null;
        latestVersion: number | null;
      }>>`
        SELECT
          d."id" AS "documentId",
          d."key",
          d."type",
          d."title",
          d."requiredForRegistration",
          current_v."version" AS "currentVersion",
          latest_event."action" AS "latestAction",
          latest_event."occurredAt" AS "latestOccurredAt",
          latest_event."documentVersion" AS "latestVersion"
        FROM "PlatformDocument" d
        JOIN LATERAL (
          SELECT "version"
          FROM "PlatformDocumentVersion"
          WHERE "documentId" = d."id"
          ORDER BY "version" DESC
          LIMIT 1
        ) current_v ON true
        LEFT JOIN LATERAL (
          SELECT e."action", e."occurredAt", v."version" AS "documentVersion"
          FROM "PlatformConsentEvent" e
          JOIN "PlatformDocumentVersion" v ON v."id" = e."documentVersionId"
          WHERE e."platformAccountId" = ${platformAccountId}
            AND v."documentId" = d."id"
          ORDER BY e."occurredAt" DESC, e."id" DESC
          LIMIT 1
        ) latest_event ON true
        WHERE d."isActive" = true
          AND d."type" LIKE '%CONSENT%'
        ORDER BY d."requiredForRegistration" DESC, d."createdAt" ASC
      `,
      this.prisma.platformNotificationPreference.findUnique({
        where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      }),
    ]);

    const history = await this.prisma.$queryRaw<Array<{
      id: string;
      key: string;
      title: string;
      version: number;
      action: string;
      occurredAt: Date;
    }>>`
      SELECT
        e."id",
        d."key",
        d."title",
        v."version",
        e."action",
        e."occurredAt"
      FROM "PlatformConsentEvent" e
      JOIN "PlatformDocumentVersion" v ON v."id" = e."documentVersionId"
      JOIN "PlatformDocument" d ON d."id" = v."documentId"
      WHERE e."platformAccountId" = ${platformAccountId}
        AND d."type" LIKE '%CONSENT%'
      ORDER BY e."occurredAt" DESC, e."id" DESC
      LIMIT 200
    `;

    return {
      consents: documents.map((document) => ({
        key: document.key,
        title: document.title,
        requiredForRegistration: document.requiredForRegistration,
        currentVersion: document.currentVersion,
        action: document.latestAction || 'DECLINED',
        eventVersion: document.latestVersion,
        occurredAt: document.latestOccurredAt?.toISOString() || '',
        active: document.latestAction === 'CONSENTED',
      })),
      history: history.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
      })),
      serviceNotifications: {
        email: preferences?.emailEnabled ?? true,
      },
    };
  }

  async setAccountConsent(
    tenantId: string,
    platformAccountId: string,
    documentKeyValue: unknown,
    activeValue: unknown,
  ) {
    const documentKey = stringValue(documentKeyValue).trim();
    const active = Boolean(activeValue);
    const rows = await this.prisma.$queryRaw<Array<{ documentVersionId: string; title: string; type: string; version: number }>>`
      SELECT
        v."id" AS "documentVersionId",
        d."title",
        d."type",
        v."version"
      FROM "PlatformDocument" d
      JOIN LATERAL (
        SELECT *
        FROM "PlatformDocumentVersion"
        WHERE "documentId" = d."id"
        ORDER BY "version" DESC
        LIMIT 1
      ) v ON true
      WHERE d."key" = ${documentKey}
        AND d."isActive" = true
      LIMIT 1
    `;
    const document = rows[0];
    if (!document || !document.type.includes('CONSENT')) {
      throw new BadRequestException('Согласие не найдено');
    }

    const now = new Date();
    const action = active ? 'CONSENTED' : 'REVOKED';
    await this.prisma.$executeRaw`
      INSERT INTO "PlatformConsentEvent" (
        "id","tenantId","platformAccountId","documentVersionId",
        "action","source","technicalEvidence","occurredAt"
      ) VALUES (
        ${randomUUID()},${tenantId},${platformAccountId},${document.documentVersionId},
        ${action},'profile-controls',
        ${JSON.stringify({ documentKey, documentVersion: document.version })}::jsonb,${now}
      )
    `;
    return this.accountControls(tenantId, platformAccountId);
  }

  async setServiceNotifications(
    tenantId: string,
    platformAccountId: string,
    input: unknown,
  ) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {};
    const emailEnabled = source.email === undefined ? true : Boolean(source.email);
    await this.prisma.platformNotificationPreference.upsert({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      create: { tenantId, platformAccountId, emailEnabled },
      update: { emailEnabled },
    });
    return this.accountControls(tenantId, platformAccountId);
  }

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

}

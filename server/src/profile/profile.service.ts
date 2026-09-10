import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Workplace as WorkplaceRow } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type ProfileInput = {
  key: string;
  name: string;
  surname: string;
  phone: string;
  phones: string[];
  telegrams: string[];
  emails: string[];
  about: string;
  photo: string;
  profession: string;
  experience: string;
  professionAbout: string;
};

type LinkInput = { type: string; url: string };

type WorkplaceInput = {
  key: string;
  profileId: string;
  photo: string;
  name: string;
  color: string;
  city: string;
  address: string;
  phone: string;
  currency: string;
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
    name: stringValue(source.name),
    color: stringValue(source.color),
    city: stringValue(source.city),
    address: stringValue(source.address),
    phone: stringValue(source.phone),
    currency: stringValue(source.currency, 'RUB') || 'RUB',
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
    name: workplace.name,
    color: workplace.color,
    city: workplace.city,
    address: workplace.address,
    phone: workplace.phone,
    currency: workplace.currency,
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
    name: workplace.name,
    color: workplace.color,
    city: workplace.city,
    address: workplace.address,
    phone: workplace.phone,
    currency: workplace.currency,
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

  private async bundle(tenantId: string, userId: string) {
    const row = await this.prisma.profile.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
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
      key: row.key,
      name: row.name,
      surname: row.surname,
      phone: row.phone,
      phones: stringList(row.phones),
      telegrams: stringList(row.telegrams),
      emails: stringList(row.emails),
      about: row.about,
      photo: row.photo,
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

  get(tenantId: string, userId: string) {
    return this.bundle(tenantId, userId);
  }

  async migrate(tenantId: string, userId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const existing = await this.prisma.profile.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (existing) return this.bundle(tenantId, userId);

    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: { tenantId, userId, ...profileData(expected.profile, expected.customProfessions) },
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

    return this.bundle(tenantId, userId);
  }

  async verifyMigration(tenantId: string, userId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const current = await this.bundle(tenantId, userId);
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
      where: { tenantId_userId: { tenantId, userId } },
      data: { migrationVerifiedAt: new Date() },
    });
    return this.bundle(tenantId, userId);
  }

  async bootstrap(tenantId: string, userId: string) {
    const existing = await this.prisma.profile.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!existing) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const empty = normalizeProfile({ emails: user?.email ? [user.email] : [] });
      await this.prisma.profile.create({
        data: {
          tenantId,
          userId,
          ...profileData(empty, []),
          migrationVerifiedAt: new Date(),
        },
      });
    }
    return this.bundle(tenantId, userId);
  }

  async updateProfile(tenantId: string, userId: string, body: unknown) {
    const current = await this.prisma.profile.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!current?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');
    const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const profile = normalizeProfile(source.profile ?? source);
    const customProfessions = source.customProfessions === undefined
      ? stringList(current.customProfessions)
      : stringList(source.customProfessions);
    await this.prisma.profile.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: profileData(profile, customProfessions),
    });
    return this.bundle(tenantId, userId);
  }

  async upsertWorkplace(tenantId: string, userId: string, key: string, body: unknown) {
    const profile = await this.prisma.profile.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
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
    return this.bundle(tenantId, userId);
  }

  async deleteWorkplace(tenantId: string, userId: string, key: string) {
    const profile = await this.prisma.profile.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!profile?.migrationVerifiedAt) throw new ConflictException('Перенос Profile + Workplaces ещё не подтверждён');
    const existing = await this.prisma.workplace.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (!existing || existing.profileId !== profile.id) throw new NotFoundException('Рабочее место не найдено');
    await this.prisma.workplace.delete({ where: { tenantId_key: { tenantId, key } } });
    return this.bundle(tenantId, userId);
  }
}

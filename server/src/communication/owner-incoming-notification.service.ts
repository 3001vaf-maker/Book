import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClientProfileThreadService } from './client-profile-thread.service';

type UnreadProfileRow = {
  profileKey: string;
  unreadCount: number;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

@Injectable()
export class OwnerIncomingNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ClientProfileThreadService,
  ) {}

  async summary(tenantId: string) {
    const rows = await this.prisma.$queryRaw<UnreadProfileRow[]>`
      SELECT "profileKey", COUNT(*)::int AS "unreadCount"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId}
        AND "profileKey" <> ''
        AND "direction" IN ('inbound', 'system')
        AND "readAt" IS NULL
        AND "deletedAt" IS NULL
      GROUP BY "profileKey"
    `;

    if (!rows.length) return { unreadCount: 0, profiles: [] };

    const profileMap = await this.profiles.canonicalizeProfileKeys(tenantId, rows.map((row) => row.profileKey));
    const aggregated = new Map<string, { profileKey: string; profileName: string; unreadCount: number }>();

    for (const row of rows) {
      const profile = profileMap.get(row.profileKey);
      const profileKey = text(profile?.profileKey || row.profileKey);
      if (!profileKey) continue;
      const current = aggregated.get(profileKey) || {
        profileKey,
        profileName: text(profile?.profileName),
        unreadCount: 0,
      };
      current.unreadCount += Math.max(0, Number(row.unreadCount || 0));
      if (!current.profileName) current.profileName = text(profile?.profileName);
      aggregated.set(profileKey, current);
    }

    const profiles = [...aggregated.values()].sort((left, right) => right.unreadCount - left.unreadCount || left.profileName.localeCompare(right.profileName, 'ru'));
    return {
      unreadCount: profiles.reduce((sum, item) => sum + item.unreadCount, 0),
      profiles,
    };
  }

  async markThreadRead(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const requestedProfileKey = text(input?.profileKey);
    const profile = requestedProfileKey
      ? await this.profiles.byProfileKey(tenantId, requestedProfileKey)
      : await this.profiles.byLegacy(tenantId, { phone: input?.phone, uei: input?.uei });
    if (!profile) throw new BadRequestException('Не указан профиль клиента');

    const keys = profile.memberKeys.length ? profile.memberKeys : [profile.profileKey];
    const keySql = Prisma.join(keys.map((key) => Prisma.sql`${key}`));
    const updated = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "CommunicationMessage"
      SET "readAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
        AND "profileKey" IN (${keySql})
        AND "direction" IN ('inbound', 'system')
        AND "readAt" IS NULL
        AND "deletedAt" IS NULL
    `);

    return {
      profileKey: profile.profileKey,
      read: true,
      updated: Number(updated || 0),
    };
  }
}

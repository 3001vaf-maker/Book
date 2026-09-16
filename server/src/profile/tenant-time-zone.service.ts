import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type TimeZoneRow = { timeZone: string };

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeTenantTimeZone(value: unknown) {
  const timeZone = text(value);
  if (!timeZone) return '';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return '';
  }
}

function fallbackTimeZone() {
  return normalizeTenantTimeZone(process.env.BOOK_TIME_ZONE) || 'Europe/Moscow';
}

@Injectable()
export class TenantTimeZoneService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const rows = await this.prisma.$queryRaw<TimeZoneRow[]>`
      SELECT "timeZone"
      FROM "TenantTimeZone"
      WHERE "tenantId" = ${tenantId}
      LIMIT 1
    `;
    return normalizeTenantTimeZone(rows[0]?.timeZone) || fallbackTimeZone();
  }

  async captureOnRegistration(tenantId: string, value: unknown) {
    const source = text(value);
    if (!source) return this.get(tenantId);
    const timeZone = normalizeTenantTimeZone(source);
    if (!timeZone) throw new BadRequestException('Некорректный часовой пояс рабочего профиля');

    await this.prisma.$executeRaw`
      INSERT INTO "TenantTimeZone" ("tenantId", "timeZone", "createdAt", "updatedAt")
      VALUES (${tenantId}, ${timeZone}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId") DO NOTHING
    `;
    return this.get(tenantId);
  }
}

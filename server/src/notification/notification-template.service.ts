import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type Audience = 'CLIENT' | 'MASTER';

type TemplateDefinition = {
  key: string;
  audience: Audience;
  name: string;
  title: string;
  body: string;
  variables: string[];
  active: boolean;
};

type TemplateOverrideRow = {
  templateKey: string;
  title: string;
  body: string;
  enabled: boolean;
};

const BOOKING_VARIABLES = ['client', 'date', 'time', 'end_time', 'time_range', 'services'];

const TEMPLATE_CATALOG: TemplateDefinition[] = [
  {
    key: 'booking.created',
    audience: 'CLIENT',
    name: 'Вы записаны',
    title: 'Вы записаны',
    body: '{{date}} в {{time}}\n{{services}}',
    variables: BOOKING_VARIABLES,
    active: true,
  },
  {
    key: 'booking.cancelled',
    audience: 'CLIENT',
    name: 'Отмена записи',
    title: 'Запись отменена',
    body: 'Запись на {{date}} в {{time}} отменена.',
    variables: BOOKING_VARIABLES,
    active: true,
  },
  {
    key: 'booking.rescheduled',
    audience: 'CLIENT',
    name: 'Перенос записи',
    title: 'Запись перенесена',
    body: '{{date}} в {{time}}\n{{services}}',
    variables: BOOKING_VARIABLES,
    active: true,
  },
  {
    key: 'booking.completed',
    audience: 'CLIENT',
    name: 'Завершение записи',
    title: 'Запись завершена',
    body: 'Спасибо за визит, {{client}}.',
    variables: BOOKING_VARIABLES,
    active: true,
  },
  {
    key: 'booking.reminder',
    audience: 'CLIENT',
    name: 'Напоминание о визите',
    title: 'Напоминание о визите',
    body: 'Напоминаем о записи {{date}} в {{time}}\n{{services}}',
    variables: BOOKING_VARIABLES,
    active: true,
  },
  {
    key: 'owner.booking.created',
    audience: 'MASTER',
    name: 'Новая запись',
    title: 'Новая запись',
    body: '{{client}}\n{{date}} в {{time}}\n{{services}}',
    variables: BOOKING_VARIABLES,
    active: true,
  },
];

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function formatNotificationDate(value: unknown) {
  const source = text(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (!match) return source;
  return `${match[3]}.${match[2]}.${match[1].slice(-2)}`;
}

export function formatNotificationTime(value: unknown) {
  const source = text(value);
  const match = /^(\d{1,2})(?::(\d{2}))?/.exec(source);
  if (!match) return source;
  const hour = String(Math.max(0, Math.min(23, Number(match[1])))).padStart(2, '0');
  const minute = String(Math.max(0, Math.min(59, Number(match[2] ?? 0)))).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function bookingTemplateValues(input: {
  client?: unknown;
  date?: unknown;
  from?: unknown;
  to?: unknown;
  services?: unknown;
}) {
  const time = formatNotificationTime(input.from);
  const endTime = formatNotificationTime(input.to);
  return {
    client: text(input.client),
    date: formatNotificationDate(input.date),
    time,
    end_time: endTime,
    time_range: time && endTime ? `${time}-${endTime}` : time || endTime,
    services: text(input.services),
  };
}

function normalizeAudience(value: unknown): Audience | '' {
  const audience = text(value).toUpperCase();
  return audience === 'CLIENT' || audience === 'MASTER' ? audience : '';
}

function definitionFor(keyValue: unknown) {
  const key = text(keyValue);
  const definition = TEMPLATE_CATALOG.find((item) => item.key === key);
  if (!definition) throw new BadRequestException('Неизвестный шаблон уведомления');
  return definition;
}

function replaceVariables(source: string, values: Record<string, unknown>) {
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => text(values[name]));
}

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private project(definition: TemplateDefinition, override: TemplateOverrideRow | null = null) {
    return {
      key: definition.key,
      audience: definition.audience,
      name: definition.name,
      title: override?.title || definition.title,
      body: override?.body || definition.body,
      variables: [...definition.variables],
      active: definition.active,
      enabled: override?.enabled ?? true,
      customized: Boolean(override),
    };
  }

  async list(tenantId: string, audienceValue: unknown = '') {
    const audience = normalizeAudience(audienceValue);
    const definitions = TEMPLATE_CATALOG.filter((item) => !audience || item.audience === audience);
    const rows = await this.prisma.$queryRaw<TemplateOverrideRow[]>`
      SELECT "templateKey", "title", "body", "enabled"
      FROM "NotificationTemplateOverride"
      WHERE "tenantId" = ${tenantId}
    `;
    const overrides = new Map(rows.map((row) => [row.templateKey, row]));
    return definitions.map((definition) => this.project(definition, overrides.get(definition.key) || null));
  }

  async get(tenantId: string, keyValue: unknown) {
    const definition = definitionFor(keyValue);
    const rows = await this.prisma.$queryRaw<TemplateOverrideRow[]>`
      SELECT "templateKey", "title", "body", "enabled"
      FROM "NotificationTemplateOverride"
      WHERE "tenantId" = ${tenantId} AND "templateKey" = ${definition.key}
      LIMIT 1
    `;
    return this.project(definition, rows[0] || null);
  }

  async save(
    tenantId: string,
    keyValue: unknown,
    input: { title?: unknown; body?: unknown; enabled?: unknown },
  ) {
    const definition = definitionFor(keyValue);
    const current = await this.get(tenantId, definition.key);
    const title = text(input?.title).slice(0, 160);
    const body = text(input?.body).slice(0, 2000);
    const enabled = input?.enabled === true || input?.enabled === false ? input.enabled : current.enabled;
    if (!title) throw new BadRequestException('Заголовок уведомления не может быть пустым');
    if (!body) throw new BadRequestException('Текст уведомления не может быть пустым');
    await this.prisma.$executeRaw`
      INSERT INTO "NotificationTemplateOverride" (
        "id", "tenantId", "templateKey", "title", "body", "enabled", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${definition.key}, ${title}, ${body}, ${enabled}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId", "templateKey") DO UPDATE
      SET "title" = EXCLUDED."title",
          "body" = EXCLUDED."body",
          "enabled" = EXCLUDED."enabled",
          "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.get(tenantId, definition.key);
  }

  async render(tenantId: string, keyValue: unknown, values: Record<string, unknown> = {}) {
    const template = await this.get(tenantId, keyValue);
    return {
      ...template,
      title: replaceVariables(template.title, values),
      body: replaceVariables(template.body, values),
    };
  }
}

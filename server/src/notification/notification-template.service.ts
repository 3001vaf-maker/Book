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
};

const TEMPLATE_CATALOG: TemplateDefinition[] = [
  {
    key: 'booking.created',
    audience: 'CLIENT',
    name: 'Вы записаны',
    title: 'Вы записаны',
    body: '{{date}} в {{time}} · {{services}}',
    variables: ['date', 'time', 'services'],
    active: true,
  },
  {
    key: 'booking.cancelled',
    audience: 'CLIENT',
    name: 'Отмена записи',
    title: 'Запись отменена',
    body: 'Запись на {{date}} в {{time}} отменена.',
    variables: ['date', 'time', 'services'],
    active: true,
  },
  {
    key: 'booking.rescheduled',
    audience: 'CLIENT',
    name: 'Перенос записи',
    title: 'Запись перенесена',
    body: 'Новая дата и время: {{date}} в {{time}} · {{services}}',
    variables: ['date', 'time', 'services'],
    active: true,
  },
  {
    key: 'booking.completed',
    audience: 'CLIENT',
    name: 'Завершение записи',
    title: 'Запись завершена',
    body: 'Спасибо за визит.',
    variables: ['date', 'time', 'services'],
    active: false,
  },
  {
    key: 'owner.booking.created',
    audience: 'MASTER',
    name: 'Новая запись',
    title: 'Новая запись',
    body: '{{client}} · {{date}} в {{time}} · {{services}}',
    variables: ['client', 'date', 'time', 'services'],
    active: true,
  },
];

function text(value: unknown) {
  return String(value ?? '').trim();
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
      customized: Boolean(override),
    };
  }

  async list(tenantId: string, audienceValue: unknown = '') {
    const audience = normalizeAudience(audienceValue);
    const definitions = TEMPLATE_CATALOG.filter((item) => !audience || item.audience === audience);
    const rows = await this.prisma.$queryRaw<TemplateOverrideRow[]>`
      SELECT "templateKey", "title", "body"
      FROM "NotificationTemplateOverride"
      WHERE "tenantId" = ${tenantId}
    `;
    const overrides = new Map(rows.map((row) => [row.templateKey, row]));
    return definitions.map((definition) => this.project(definition, overrides.get(definition.key) || null));
  }

  async get(tenantId: string, keyValue: unknown) {
    const definition = definitionFor(keyValue);
    const rows = await this.prisma.$queryRaw<TemplateOverrideRow[]>`
      SELECT "templateKey", "title", "body"
      FROM "NotificationTemplateOverride"
      WHERE "tenantId" = ${tenantId} AND "templateKey" = ${definition.key}
      LIMIT 1
    `;
    return this.project(definition, rows[0] || null);
  }

  async save(tenantId: string, keyValue: unknown, input: { title?: unknown; body?: unknown }) {
    const definition = definitionFor(keyValue);
    const title = text(input?.title).slice(0, 160);
    const body = text(input?.body).slice(0, 2000);
    if (!title) throw new BadRequestException('Заголовок уведомления не может быть пустым');
    if (!body) throw new BadRequestException('Текст уведомления не может быть пустым');
    await this.prisma.$executeRaw`
      INSERT INTO "NotificationTemplateOverride" (
        "id", "tenantId", "templateKey", "title", "body", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${definition.key}, ${title}, ${body}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId", "templateKey") DO UPDATE
      SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP
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

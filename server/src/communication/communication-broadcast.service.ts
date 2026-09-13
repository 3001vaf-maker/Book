import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessStateService } from '../business-state/business-state.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';
import { CommunicationDispatchService } from './communication-dispatch.service';

type TemplateRow = { id: string; tenantId: string; name: string; body: string; createdAt: Date; updatedAt: Date };
function text(value: unknown) { return String(value ?? '').trim(); }
function objectValue(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function canonicalEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

@Injectable()
export class CommunicationBroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
    private readonly documents: ConsentPolicyService,
    private readonly communications: CommunicationService,
    private readonly dispatch: CommunicationDispatchService,
  ) {}

  private normalizeChannel(value: unknown) {
    const channel = text(value).toUpperCase();
    if (!['TELEGRAM', 'EMAIL', 'SMS', 'WHATSAPP'].includes(channel)) throw new BadRequestException('Не выбран канал рассылки');
    return channel;
  }

  private renderTemplate(body: string, person: { name: string; surname: string; phone: string; email: string; code: string }) {
    return body
      .replaceAll('{{client.name}}', person.name)
      .replaceAll('{{client.surname}}', person.surname)
      .replaceAll('{{client.phone}}', person.phone)
      .replaceAll('{{client.email}}', person.email)
      .replaceAll('{{client.code}}', person.code);
  }

  async listTemplates(tenantId: string) {
    return this.prisma.$queryRaw<TemplateRow[]>`
      SELECT "id", "tenantId", "name", "body", "createdAt", "updatedAt"
      FROM "CommunicationTemplate" WHERE "tenantId" = ${tenantId}
      ORDER BY "updatedAt" DESC, "name" ASC
    `;
  }

  async saveTemplate(tenantId: string, input: { id?: unknown; name?: unknown; body?: unknown }) {
    const id = text(input?.id); const name = text(input?.name); const body = text(input?.body);
    if (!name) throw new BadRequestException('Введите название шаблона');
    if (!body) throw new BadRequestException('Введите текст шаблона');
    if (id) {
      const updated = await this.prisma.$executeRaw`
        UPDATE "CommunicationTemplate" SET "name" = ${name}, "body" = ${body}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id} AND "tenantId" = ${tenantId}
      `;
      if (!updated) throw new NotFoundException('Шаблон не найден');
      const rows = await this.prisma.$queryRaw<TemplateRow[]>`
        SELECT "id", "tenantId", "name", "body", "createdAt", "updatedAt"
        FROM "CommunicationTemplate" WHERE "id" = ${id} AND "tenantId" = ${tenantId} LIMIT 1
      `;
      return rows[0];
    }
    const templateId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationTemplate" ("id", "tenantId", "name", "body", "createdAt", "updatedAt")
      VALUES (${templateId}, ${tenantId}, ${name}, ${body}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    const rows = await this.prisma.$queryRaw<TemplateRow[]>`
      SELECT "id", "tenantId", "name", "body", "createdAt", "updatedAt"
      FROM "CommunicationTemplate" WHERE "id" = ${templateId} AND "tenantId" = ${tenantId} LIMIT 1
    `;
    return rows[0];
  }

  async deleteTemplate(tenantId: string, idValue: unknown) {
    const id = text(idValue); if (!id) throw new BadRequestException('Не указан шаблон');
    const deleted = await this.prisma.$executeRaw`DELETE FROM "CommunicationTemplate" WHERE "id" = ${id} AND "tenantId" = ${tenantId}`;
    if (!deleted) throw new NotFoundException('Шаблон не найден');
    return { deleted: true, id };
  }

  private async people(tenantId: string) {
    const business = await this.businessState.get(tenantId);
    const identity = business.uei || { entities: {}, relations: {} };
    return (Array.isArray(business.people) ? business.people : [])
      .map((value) => objectValue(value))
      .map((person) => {
        const personKey = text(person.key);
        const uei = text(identity.relations?.[`person:${personKey}`] || person.uei);
        return {
          personKey,
          uei,
          code: uei,
          name: text(person.name), surname: text(person.surname),
          phone: (Array.isArray(person.phones) ? person.phones : []).map(canonicalPhone).find(Boolean) || '',
          email: (Array.isArray(person.emails) ? person.emails : []).map(canonicalEmail).find(Boolean) || '',
        };
      }).filter((person) => person.personKey && person.phone);
  }

  private requestedPeople(people: Awaited<ReturnType<CommunicationBroadcastService['people']>>, input: { all?: unknown; phones?: unknown }) {
    const all = input?.all === true;
    const phones = [...new Set((Array.isArray(input?.phones) ? input.phones : []).map(canonicalPhone).filter(Boolean))];
    if (!all && !phones.length) throw new BadRequestException('Выберите клиентов или явно укажите «все клиенты»');
    const byCardPhone = new Map<string, (typeof people)[number]>();
    for (const person of people) {
      if (!byCardPhone.has(person.phone)) byCardPhone.set(person.phone, person);
    }
    if (all) return [...byCardPhone.values()];
    return phones.map((phone) => byCardPhone.get(phone)).filter(Boolean) as Array<(typeof people)[number]>;
  }

  private async channelAvailable(tenantId: string, channel: string, person: { phone: string; uei: string; email: string }) {
    if (channel === 'TELEGRAM') return Boolean(await this.communications.telegramIdentity(tenantId, { phone: person.phone, uei: person.uei }));
    return false;
  }

  async preview(tenantId: string, input: { channel?: unknown; all?: unknown; phones?: unknown }) {
    const channel = this.normalizeChannel(input?.channel);
    const allPeople = await this.people(tenantId);
    const requested = this.requestedPeople(allPeople, input || {});
    const audience: Array<(typeof requested)[number]> = [];
    const excluded: Array<{ phone: string; reason: string }> = [];
    for (const person of requested) {
      if (!(await this.documents.canSendMessages(tenantId, person.personKey))) { excluded.push({ phone: person.phone, reason: 'no-consent' }); continue; }
      if (!(await this.channelAvailable(tenantId, channel, person))) { excluded.push({ phone: person.phone, reason: 'no-channel' }); continue; }
      audience.push(person);
    }
    return { channel, requestedCount: requested.length, eligibleCount: audience.length, excludedCount: excluded.length, audience, excluded };
  }

  private async ensureRateLimit(tenantId: string, nextCount: number) {
    const since = new Date(Date.now() - 60_000);
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COALESCE(SUM("sentCount"), 0)::int AS "count" FROM "CommunicationBroadcastRun"
      WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${since}
    `;
    const used = Number(rows[0]?.count || 0);
    const limit = Math.max(1, Number(process.env.BROADCAST_MAX_PER_MINUTE || 100));
    if (used + nextCount > limit) throw new HttpException(`Лимит рассылки: не более ${limit} сообщений в минуту`, HttpStatus.TOO_MANY_REQUESTS);
  }

  async send(tenantId: string, input: { channel?: unknown; all?: unknown; phones?: unknown; name?: unknown; body?: unknown }) {
    const name = text(input?.name); const body = text(input?.body);
    if (!name) throw new BadRequestException('Введите название рассылки');
    if (!body) throw new BadRequestException('Введите текст рассылки');
    const preview = await this.preview(tenantId, input || {});
    if (!preview.eligibleCount) throw new BadRequestException('Нет клиентов, которым можно отправить сообщение');
    if (preview.channel !== 'TELEGRAM') throw new BadRequestException(`Транспорт ${preview.channel} пока не подключён к массовой отправке`);
    await this.ensureRateLimit(tenantId, preview.eligibleCount);
    const runId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationBroadcastRun" ("id", "tenantId", "channel", "name", "body", "requestedCount", "eligibleCount", "sentCount", "failedCount", "status", "createdAt")
      VALUES (${runId}, ${tenantId}, ${preview.channel}, ${name}, ${body}, ${preview.requestedCount}, ${preview.eligibleCount}, 0, 0, 'sending', CURRENT_TIMESTAMP)
    `;
    let sentCount = 0; let failedCount = 0; const failures: Array<{ phone: string; error: string }> = [];
    for (const recipient of preview.audience) {
      try {
        const renderedBody = this.renderTemplate(body, recipient);
        await this.dispatch.send(tenantId, { phone: recipient.phone, uei: recipient.uei, channel: preview.channel, body: renderedBody });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push({ phone: recipient.phone, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const status = failedCount ? (sentCount ? 'partial' : 'failed') : 'sent';
    await this.prisma.$executeRaw`
      UPDATE "CommunicationBroadcastRun" SET "sentCount" = ${sentCount}, "failedCount" = ${failedCount}, "status" = ${status}, "finishedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${runId} AND "tenantId" = ${tenantId}
    `;
    return { runId, name, status, ...preview, sentCount, failedCount, failures };
  }
}

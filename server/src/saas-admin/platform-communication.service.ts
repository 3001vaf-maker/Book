import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

type PlatformCommunicationRow = {
  id: string;
  createdByAdminId: string;
  tenantId: string;
  recipientPlatformAccountId: string;
  channel: string;
  purpose: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: string;
  externalMessageId: string;
  error: string;
  createdAt: Date;
  sentAt: Date | null;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] || char);
}

@Injectable()
export class PlatformCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: TransactionalEmailService,
  ) {}

  async list(adminId: string, limitValue: unknown = 100) {
    const limit = Math.max(1, Math.min(200, Math.floor(Number(limitValue) || 100)));
    return this.prisma.$queryRaw<PlatformCommunicationRow[]>`
      SELECT
        "id", "createdByAdminId", "tenantId", "recipientPlatformAccountId",
        "channel", "purpose", "recipientEmail", "recipientName", "subject", "body",
        "status", "externalMessageId", "error", "createdAt", "sentAt"
      FROM "PlatformCommunication"
      WHERE "createdByAdminId" = ${adminId}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `;
  }

  async sendEmail(adminId: string, input: { tenantId?: unknown; subject?: unknown; body?: unknown }) {
    const tenantId = text(input?.tenantId);
    const subject = text(input?.subject);
    const body = text(input?.body);

    if (!tenantId) throw new BadRequestException('Выберите получателя');
    if (!subject) throw new BadRequestException('Введите тему письма');
    if (!body) throw new BadRequestException('Введите текст письма');
    if (subject.length > 200) throw new BadRequestException('Тема письма слишком длинная');
    if (body.length > 20000) throw new BadRequestException('Текст письма слишком длинный');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        memberships: {
          include: { account: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        profiles: {
          select: { platformAccountId: true, name: true, surname: true },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Профиль не найден');

    const membership = tenant.memberships[0];
    if (!membership) throw new BadRequestException('У профиля ещё нет учётной записи');

    const recipientEmail = text(membership.account.email).toLowerCase();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new BadRequestException('У профиля нет корректного email');
    }

    const profile = tenant.profiles.find((item) => item.platformAccountId === membership.platformAccountId);
    const recipientName = [text(profile?.name), text(profile?.surname)].filter(Boolean).join(' ') || tenant.name;
    const id = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO "PlatformCommunication" (
        "id", "createdByAdminId", "tenantId", "recipientPlatformAccountId",
        "channel", "purpose", "recipientEmail", "recipientName", "subject", "body",
        "status", "externalMessageId", "error", "createdAt"
      ) VALUES (
        ${id}, ${adminId}, ${tenantId}, ${membership.platformAccountId},
        'EMAIL', 'SERVICE', ${recipientEmail}, ${recipientName}, ${subject}, ${body},
        'created', '', '', CURRENT_TIMESTAMP
      )
    `;

    try {
      const sent = await this.email.send({
        to: recipientEmail,
        toName: recipientName,
        subject,
        text: body,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`,
        tag: 'platform-service',
      });
      const now = new Date();
      await this.prisma.$executeRaw`
        UPDATE "PlatformCommunication"
        SET "status" = 'sent',
            "externalMessageId" = ${sent.messageId},
            "error" = '',
            "sentAt" = ${now}
        WHERE "id" = ${id}
      `;
      return { id, status: 'sent', recipientEmail, recipientName, subject, sentAt: now };
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
      await this.prisma.$executeRaw`
        UPDATE "PlatformCommunication"
        SET "status" = 'failed',
            "error" = ${message}
        WHERE "id" = ${id}
      `;
      throw error;
    }
  }
}

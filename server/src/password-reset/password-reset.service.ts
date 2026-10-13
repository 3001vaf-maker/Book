import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

type ResetSubjectType = 'PLATFORM' | 'ACCOUNT';
type ResetTicketRow = {
  id: string;
  subjectType: ResetSubjectType;
  subjectId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC_ACCEPTED = { accepted: true } as const;

function text(value: unknown) { return String(value ?? '').trim(); }
function email(value: unknown) {
  const normalized = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char] || char);
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  private resetUrl(subjectType: ResetSubjectType, token: string, surface = '') {
    const production = process.env.NODE_ENV === 'production';
    if (subjectType === 'ACCOUNT') {
      const base = text(process.env.ACCOUNT_APP_URL)
        || (production ? 'https://user.va-tools.ru' : text(process.env.FRONTEND_ORIGIN) || 'http://localhost:8080');
      const url = new URL('/reset-password.html', base);
      url.searchParams.set('kind', 'account');
      url.searchParams.set('token', token);
      return url.toString();
    }

    const admin = text(surface).toLowerCase() === 'admin';
    const base = production
      ? (admin ? 'https://admin.va-tools.ru' : 'https://app.va-tools.ru')
      : text(process.env.FRONTEND_ORIGIN) || 'http://localhost:8080';
    const path = admin ? '/admin/reset-password.html' : '/reset-password.html';
    const url = new URL(path, base);
    url.searchParams.set('kind', 'platform');
    url.searchParams.set('token', token);
    return url.toString();
  }

  private async issueTicket(subjectType: ResetSubjectType, subjectId: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "PasswordResetTicket"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "subjectType" = ${subjectType}
          AND "subjectId" = ${subjectId}
          AND "usedAt" IS NULL
      `;
      await tx.$executeRaw`
        INSERT INTO "PasswordResetTicket" ("id", "subjectType", "subjectId", "tokenHash", "expiresAt", "createdAt")
        VALUES (${randomUUID()}, ${subjectType}, ${subjectId}, ${tokenHash}, ${expiresAt}, CURRENT_TIMESTAMP)
      `;
      await tx.$executeRaw`
        DELETE FROM "PasswordResetTicket"
        WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '7 days'
      `;
    });

    return { token, expiresAt };
  }

  private async sendResetEmail(to: string, resetUrl: string) {
    const safeUrl = escapeHtml(resetUrl);
    await this.transactionalEmail.send({
      to,
      subject: 'Восстановление пароля VA Tools',
      text: `Для изменения пароля откройте ссылку: ${resetUrl}\n\nСсылка действует 30 минут. Если вы не запрашивали восстановление, ничего делать не нужно.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><p>Для изменения пароля откройте ссылку:</p><p><a href="${safeUrl}">Изменить пароль</a></p><p>Ссылка действует 30 минут.</p><p>Если вы не запрашивали восстановление, ничего делать не нужно.</p></div>`,
      tag: 'password-reset',
    });
  }

  async requestPlatform(rawEmail: unknown, rawSurface: unknown = '') {
    const normalized = email(rawEmail);
    if (!normalized) return GENERIC_ACCEPTED;

    const account = await this.prisma.platformAccount.findUnique({ where: { email: normalized }, select: { id: true, email: true } });
    if (!account) return GENERIC_ACCEPTED;

    try {
      const ticket = await this.issueTicket('PLATFORM', account.id);
      await this.sendResetEmail(account.email, this.resetUrl('PLATFORM', ticket.token, text(rawSurface)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      this.logger.error(`Platform password reset delivery failed: ${message}`);
    }
    return GENERIC_ACCEPTED;
  }

  async requestAccount(rawIdentifier: unknown) {
    const raw = text(rawIdentifier);
    const emailIdentifier = email(raw);
    const phoneIdentifier = canonicalPhone(raw);
    if (!emailIdentifier && !phoneIdentifier) return GENERIC_ACCEPTED;

    const contact = await this.prisma.accountContact.findUnique({
      where: emailIdentifier
        ? { type_value: { type: 'EMAIL', value: emailIdentifier } }
        : { type_value: { type: 'PHONE', value: phoneIdentifier } },
      include: { account: true },
    });
    const account = contact?.account || null;
    const deliveryEmail = email(account?.email);
    if (!account || !deliveryEmail) return GENERIC_ACCEPTED;

    try {
      const ticket = await this.issueTicket('ACCOUNT', account.id);
      await this.sendResetEmail(deliveryEmail, this.resetUrl('ACCOUNT', ticket.token));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      this.logger.error(`Account password reset delivery failed: ${message}`);
    }
    return GENERIC_ACCEPTED;
  }

  private async consumeTicket(subjectType: ResetSubjectType, rawToken: unknown, rawNewPassword: unknown) {
    const token = text(rawToken);
    const next = String(rawNewPassword ?? '');
    if (next.length < 8) throw new BadRequestException('Новый пароль должен содержать минимум 8 символов');
    if (token.length < 32) throw new BadRequestException('Ссылка восстановления недействительна или истекла');
    const tokenHash = sha256(token);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ResetTicketRow[]>`
        SELECT "id", "subjectType", "subjectId", "expiresAt", "usedAt"
        FROM "PasswordResetTicket"
        WHERE "tokenHash" = ${tokenHash}
          AND "subjectType" = ${subjectType}
          AND "usedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
        LIMIT 1
        FOR UPDATE
      `;
      const ticket = rows[0];
      if (!ticket) throw new BadRequestException('Ссылка восстановления недействительна или истекла');

      const passwordHash = await hash(next, 12);
      if (subjectType === 'PLATFORM') {
        const updated = await tx.platformAccount.updateMany({ where: { id: ticket.subjectId }, data: { passwordHash } });
        if (!updated.count) throw new BadRequestException('Ссылка восстановления недействительна или истекла');
      } else {
        const updated = await tx.account.updateMany({ where: { id: ticket.subjectId }, data: { passwordHash } });
        if (!updated.count) throw new BadRequestException('Ссылка восстановления недействительна или истекла');
      }

      await tx.$executeRaw`
        UPDATE "PasswordResetTicket"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${ticket.id} AND "usedAt" IS NULL
      `;
      await tx.$executeRaw`
        UPDATE "PasswordResetTicket"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "subjectType" = ${subjectType}
          AND "subjectId" = ${ticket.subjectId}
          AND "usedAt" IS NULL
      `;
      return { changed: true };
    });
  }

  confirmPlatform(token: unknown, newPassword: unknown) {
    return this.consumeTicket('PLATFORM', token, newPassword);
  }

  confirmAccount(token: unknown, newPassword: unknown) {
    return this.consumeTicket('ACCOUNT', token, newPassword);
  }
}

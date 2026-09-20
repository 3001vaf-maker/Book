import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CapabilityValueType,
  TenantInvitationStatus,
  MembershipRole,
  TenantAccessStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { hash as hashPassword } from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STARTER_PLAN_KEY = 'starter-people';
const REGISTRATION_LINK_EMAIL_PREFIX = 'registration+';
const REGISTRATION_LINK_EMAIL_SUFFIX = '@registration.invalid';

const CAPABILITY_CATALOG: Array<{
  key: string;
  groupKey: string;
  name: string;
  valueType: CapabilityValueType;
  position: number;
  starterEnabled?: boolean;
  starterLimit?: number | null;
}> = [
  { key: 'profile.access', groupKey: 'start', name: 'Профиль', valueType: CapabilityValueType.BOOLEAN, position: 10, starterEnabled: true },
  { key: 'services.access', groupKey: 'start', name: 'Услуги', valueType: CapabilityValueType.BOOLEAN, position: 20, starterEnabled: true },
  { key: 'people.access', groupKey: 'people', name: 'Люди', valueType: CapabilityValueType.BOOLEAN, position: 30, starterEnabled: true },
  { key: 'workplaces.max', groupKey: 'start', name: 'Количество рабочих пространств', valueType: CapabilityValueType.LIMIT, position: 40, starterLimit: 1 },
  { key: 'timetable.access', groupKey: 'work', name: 'График', valueType: CapabilityValueType.BOOLEAN, position: 50, starterEnabled: false },
  { key: 'journal.access', groupKey: 'work', name: 'Журнал', valueType: CapabilityValueType.BOOLEAN, position: 60, starterEnabled: false },
  { key: 'online_booking.access', groupKey: 'sales', name: 'Онлайн-запись', valueType: CapabilityValueType.BOOLEAN, position: 70, starterEnabled: false },
  { key: 'payments.access', groupKey: 'sales', name: 'Оплаты', valueType: CapabilityValueType.BOOLEAN, position: 80, starterEnabled: false },
  { key: 'finance.access', groupKey: 'finance', name: 'Финансы', valueType: CapabilityValueType.BOOLEAN, position: 90, starterEnabled: false },
  { key: 'chat.access', groupKey: 'communication', name: 'Чат', valueType: CapabilityValueType.BOOLEAN, position: 100, starterEnabled: false },
  { key: 'notifications.access', groupKey: 'communication', name: 'Уведомления', valueType: CapabilityValueType.BOOLEAN, position: 110, starterEnabled: false },
  { key: 'integrations.access', groupKey: 'settings', name: 'Интеграции', valueType: CapabilityValueType.BOOLEAN, position: 120, starterEnabled: false },
  { key: 'documents.access', groupKey: 'settings', name: 'Документы', valueType: CapabilityValueType.BOOLEAN, position: 130, starterEnabled: false },
  { key: 'tags.access', groupKey: 'settings', name: 'Ярлыки', valueType: CapabilityValueType.BOOLEAN, position: 140, starterEnabled: false },
];

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value || '').trim();
}

function invitationHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
}

function isRegistrationLinkEmail(email: string) {
  return email.startsWith(REGISTRATION_LINK_EMAIL_PREFIX) && email.endsWith(REGISTRATION_LINK_EMAIL_SUFFIX);
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
export class TenantInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: TransactionalEmailService,
    private readonly jwt: JwtService,
  ) {}

  async ensureStarterPlan() {
    const capabilityIds = new Map<string, string>();

    for (const item of CAPABILITY_CATALOG) {
      const capability = await this.prisma.capability.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          groupKey: item.groupKey,
          name: item.name,
          valueType: item.valueType,
          defaultEnabled: false,
          defaultLimit: item.valueType === CapabilityValueType.LIMIT ? null : undefined,
          position: item.position,
          isActive: true,
        },
        update: {
          groupKey: item.groupKey,
          name: item.name,
          valueType: item.valueType,
          position: item.position,
          isActive: true,
        },
      });
      capabilityIds.set(item.key, capability.id);
    }

    const plan = await this.prisma.plan.upsert({
      where: { key: STARTER_PLAN_KEY },
      create: {
        key: STARTER_PLAN_KEY,
        name: 'Старт',
        description: 'Профиль, услуги, люди и одно рабочее пространство',
        position: 10,
        isActive: true,
      },
      update: {
        name: 'Старт',
        description: 'Профиль, услуги, люди и одно рабочее пространство',
        position: 10,
        isActive: true,
      },
    });

    for (const item of CAPABILITY_CATALOG) {
      const capabilityId = capabilityIds.get(item.key)!;
      await this.prisma.planCapability.upsert({
        where: { planId_capabilityId: { planId: plan.id, capabilityId } },
        create: {
          planId: plan.id,
          capabilityId,
          enabled: item.valueType === CapabilityValueType.BOOLEAN ? Boolean(item.starterEnabled) : null,
          limit: item.valueType === CapabilityValueType.LIMIT ? (item.starterLimit ?? null) : null,
        },
        update: {
          enabled: item.valueType === CapabilityValueType.BOOLEAN ? Boolean(item.starterEnabled) : null,
          limit: item.valueType === CapabilityValueType.LIMIT ? (item.starterLimit ?? null) : null,
        },
      });
    }

    return plan;
  }

  private async createPendingInvitation(adminId: string, input: {
    email: string;
    name: string;
    tenantName: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const plan = await this.ensureStarterPlan();
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: input.tenantName } });
      await tx.tenantAccess.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: TenantAccessStatus.ACTIVE,
          isOwnerBook: false,
        },
      });
      const invitation = await tx.tenantInvitation.create({
        data: {
          tenantId: tenant.id,
          createdByAdminId: adminId,
          email: input.email,
          name: input.name,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      return { tenant, invitation };
    });
  }

  private async acceptPendingInvitation(
    invitation: { id: string; tenantId: string; tenant: { id: string; name: string } },
    email: string,
    password: string,
  ) {
    const passwordHash = await hashPassword(password, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.platformAccount.create({
        data: {
          email,
          passwordHash,
          onboardingStep: 0,
          workspaceUnlocked: false,
        },
      });
      const membership = await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          platformAccountId: account.id,
          role: MembershipRole.OWNER,
        },
      });
      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: {
          email,
          status: TenantInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });
      return { account, membership };
    });

    const accessToken = await this.jwt.signAsync({
      sub: result.account.id,
      tenantId: invitation.tenantId,
      role: result.membership.role,
    });

    return {
      accessToken,
      account: {
        id: result.account.id,
        email: result.account.email,
        onboardingStep: result.account.onboardingStep,
        workspaceUnlocked: result.account.workspaceUnlocked,
      },
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
      role: result.membership.role,
    };
  }

  async createRegistrationLink(adminId: string) {
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const placeholderEmail = `${REGISTRATION_LINK_EMAIL_PREFIX}${tokenHash.slice(0, 24)}${REGISTRATION_LINK_EMAIL_SUFFIX}`;

    const created = await this.createPendingInvitation(adminId, {
      email: placeholderEmail,
      name: '',
      tenantName: 'Новый профиль',
      tokenHash,
      expiresAt,
    });

    const origin = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/+$/, '');
    if (!origin) {
      await this.prisma.tenant.delete({ where: { id: created.tenant.id } }).catch(() => undefined);
      throw new BadRequestException('FRONTEND_ORIGIN не настроен');
    }

    return {
      id: created.invitation.id,
      tenantId: created.tenant.id,
      url: `${origin}/register/?token=${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  async inspectRegistrationLink(tokenValue: unknown) {
    const invitation = await this.findActiveRegistrationLink(String(tokenValue || ''));
    return {
      expiresAt: invitation.expiresAt,
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
    };
  }

  async acceptRegistrationLink(input: { token?: unknown; email?: unknown; password?: unknown }) {
    const token = String(input?.token || '').trim();
    const email = normalizeEmail(input?.email);
    const password = String(input?.password || '');

    if (!email || !email.includes('@')) throw new BadRequestException('Укажите корректный email');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    const invitation = await this.findActiveRegistrationLink(token);
    const existingAccount = await this.prisma.platformAccount.findUnique({ where: { email } });
    if (existingAccount) throw new ConflictException('Учётная запись с таким email уже зарегистрирована');

    const otherPending = await this.prisma.tenantInvitation.findFirst({
      where: {
        email,
        status: TenantInvitationStatus.PENDING,
        id: { not: invitation.id },
      },
      select: { id: true },
    });
    if (otherPending) throw new ConflictException('На этот email уже создано другое активное приглашение');

    return this.acceptPendingInvitation(invitation, email, password);
  }

  async createInvitation(adminId: string, input: { email?: unknown; name?: unknown }) {
    const email = normalizeEmail(input?.email);
    const name = normalizeName(input?.name);
    if (!email || !email.includes('@')) throw new BadRequestException('Укажите корректный email');

    const existingAccount = await this.prisma.platformAccount.findUnique({ where: { email } });
    if (existingAccount) throw new ConflictException('Учётная запись с таким email уже зарегистрирована');

    const existingInvitation = await this.prisma.tenantInvitation.findFirst({
      where: { email, status: TenantInvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (existingInvitation) throw new ConflictException('На этот email уже отправлено активное приглашение');

    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const tenantName = name || email.split('@')[0] || 'Book';

    const created = await this.createPendingInvitation(adminId, {
      email,
      name,
      tenantName,
      tokenHash,
      expiresAt,
    });

    try {
      await this.sendInvitationEmail({ email, name, token });
    } catch (error) {
      await this.prisma.tenant.delete({ where: { id: created.tenant.id } }).catch(() => undefined);
      throw error;
    }

    return this.invitationDto(created.invitation);
  }

  async resendInvitation(adminId: string, invitationId: string) {
    const invitation = await this.prisma.tenantInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.createdByAdminId !== adminId) throw new NotFoundException('Приглашение не найдено');
    if (invitation.status !== TenantInvitationStatus.PENDING) throw new ConflictException('Это приглашение уже не активно');

    const oldTokenHash = invitation.tokenHash;
    const oldExpiresAt = invitation.expiresAt;
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const updated = await this.prisma.tenantInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt },
    });

    try {
      await this.sendInvitationEmail({ email: invitation.email, name: invitation.name, token });
    } catch (error) {
      await this.prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: { tokenHash: oldTokenHash, expiresAt: oldExpiresAt },
      }).catch(() => undefined);
      throw error;
    }

    return this.invitationDto(updated);
  }

  async inspect(tokenValue: unknown) {
    const invitation = await this.findActiveInvitation(String(tokenValue || ''));
    return {
      email: invitation.email,
      name: invitation.name,
      expiresAt: invitation.expiresAt,
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
    };
  }

  async accept(input: { token?: unknown; password?: unknown }) {
    const token = String(input?.token || '').trim();
    const password = String(input?.password || '');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    const invitation = await this.findActiveInvitation(token);
    const existingAccount = await this.prisma.platformAccount.findUnique({ where: { email: invitation.email } });
    if (existingAccount) throw new ConflictException('Учётная запись с таким email уже зарегистрирована');

    return this.acceptPendingInvitation(invitation, invitation.email, password);
  }

  async listInvitations(adminId: string) {
    const rows = await this.prisma.tenantInvitation.findMany({
      where: { createdByAdminId: adminId },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.invitationDto(row),
      tenant: { id: row.tenant.id, name: row.tenant.name },
    }));
  }

  private async findActiveRegistrationLink(token: string) {
    if (!token) throw new BadRequestException('Ссылка регистрации недействительна');
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash: invitationHash(token) },
      include: { tenant: true },
    });
    if (!invitation || !isRegistrationLinkEmail(invitation.email)) {
      throw new NotFoundException('Ссылка регистрации не найдена');
    }
    if (invitation.status !== TenantInvitationStatus.PENDING) {
      throw new ConflictException('Эта ссылка уже использована');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Срок действия ссылки истёк');
    }
    return invitation;
  }

  private async findActiveInvitation(token: string) {
    if (!token) throw new BadRequestException('Приглашение отсутствует');
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash: invitationHash(token) },
      include: { tenant: true },
    });
    if (!invitation) throw new NotFoundException('Приглашение не найдено');
    if (invitation.status !== TenantInvitationStatus.PENDING) throw new ConflictException('Приглашение уже использовано или отозвано');
    if (invitation.expiresAt.getTime() <= Date.now()) throw new ConflictException('Срок действия приглашения истёк');
    return invitation;
  }

  private async sendInvitationEmail(input: { email: string; name: string; token: string }) {
    const origin = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/+$/, '');
    if (!origin) throw new BadRequestException('FRONTEND_ORIGIN не настроен');
    const url = `${origin}/invite/?token=${encodeURIComponent(input.token)}`;
    const safeName = escapeHtml(input.name || '');
    const greeting = safeName ? `Здравствуйте, ${safeName}.` : 'Здравствуйте.';

    return this.email.send({
      to: input.email,
      toName: input.name,
      subject: 'Приглашение в Book',
      tag: 'tenant-invitation',
      text: `${input.name ? `Здравствуйте, ${input.name}.` : 'Здравствуйте.'}\n\nВам открыт персональный Book. Создайте пароль и начните настройку рабочего пространства:\n${url}\n\nСсылка действует 7 дней.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#292522"><h2>Book</h2><p>${greeting}</p><p>Вам открыт персональный Book. Создайте пароль и начните настройку своего рабочего пространства.</p><p style="margin:28px 0"><a href="${url}" style="background:#292522;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;display:inline-block">Создать пароль и войти</a></p><p style="color:#817a74;font-size:14px">Ссылка действует 7 дней.</p></div>`,
    });
  }

  private invitationDto(invitation: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    status: TenantInvitationStatus;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      name: invitation.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }
}

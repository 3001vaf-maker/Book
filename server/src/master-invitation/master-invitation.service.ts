import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CapabilityValueType,
  MasterInvitationStatus,
  MembershipRole,
  TenantAccessStatus,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { hash as hashPassword } from 'bcryptjs';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STARTER_PLAN_KEY = 'starter-clients';

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
  { key: 'clients.access', groupKey: 'clients', name: 'Клиенты', valueType: CapabilityValueType.BOOLEAN, position: 30, starterEnabled: true },
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] || char);
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

type RegistrationInput = {
  token?: unknown;
  password?: unknown;
  saasAgreementAccepted?: unknown;
  dpaAccepted?: unknown;
  privacyAcknowledged?: unknown;
  pdConsentAccepted?: unknown;
  marketingConsentAccepted?: unknown;
  technicalEvidence?: unknown;
};

type RegistrationDocument = {
  key: string;
  requiredForRegistration: boolean;
  versionId: string;
  version: number;
};

@Injectable()
export class MasterInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: TransactionalEmailService,
    private readonly jwt: JwtService,
    private readonly legal: LegalRuntimeService,
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
        name: 'Старт: Клиенты',
        description: 'Профиль, услуги, клиенты и одно рабочее пространство',
        position: 10,
        isActive: true,
      },
      update: {
        name: 'Старт: Клиенты',
        description: 'Профиль, услуги, клиенты и одно рабочее пространство',
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

  async createInvitation(adminId: string, input: { email?: unknown; name?: unknown }) {
    const actorUserId = await this.platformAdminUserId(adminId);
    await this.legal.assertPlatformLegalReady(actorUserId);

    const email = normalizeEmail(input?.email);
    const name = normalizeName(input?.name);
    if (!email || !email.includes('@')) throw new BadRequestException('Укажите корректный email мастера');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const existingInvitation = await this.prisma.masterInvitation.findFirst({
      where: { email, status: MasterInvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (existingInvitation) throw new ConflictException('На этот email уже отправлено активное приглашение');

    const plan = await this.ensureStarterPlan();
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const tenantName = name || email.split('@')[0] || 'Book';

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: tenantName } });
      await tx.tenantAccess.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: TenantAccessStatus.ACTIVE,
          isOwnerBook: false,
        },
      });
      await tx.$executeRaw`
        INSERT INTO "TenantLegalState" ("tenantId", "operationMode", "filingStatus", "updatedAt")
        VALUES (${tenant.id}, 'DEMO', 'NOT_PREPARED', CURRENT_TIMESTAMP)
      `;
      const invitation = await tx.masterInvitation.create({
        data: {
          tenantId: tenant.id,
          createdByAdminId: adminId,
          email,
          name,
          tokenHash,
          expiresAt,
        },
      });
      return { tenant, invitation };
    });

    try {
      await this.sendInvitationEmail({ email, name, token });
    } catch (error) {
      await this.prisma.tenant.delete({ where: { id: created.tenant.id } }).catch(() => undefined);
      throw error;
    }

    await this.prisma.$executeRaw`
      INSERT INTO "LegalStateEvent" (
        "id", "scope", "tenantId", "actorUserId", "changeType", "oldState", "newState", "reason", "occurredAt"
      ) VALUES (
        ${randomUUID()}, 'TENANT', ${created.tenant.id}, ${actorUserId}, 'TENANT_CREATED_DEMO', '{}'::jsonb,
        ${json({ operationMode: 'DEMO', filingStatus: 'NOT_PREPARED' })}::jsonb,
        'New invited master starts fail-closed in DEMO', CURRENT_TIMESTAMP
      )
    `;
    await this.legal.audit(created.tenant.id, actorUserId, 'MASTER_INVITATION_CREATED', 'REGISTRATION', 'SUCCESS', { invitationId: created.invitation.id });
    return this.invitationDto(created.invitation);
  }

  async resendInvitation(adminId: string, invitationId: string) {
    const actorUserId = await this.platformAdminUserId(adminId);
    await this.legal.assertPlatformLegalReady(actorUserId);
    const invitation = await this.prisma.masterInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.createdByAdminId !== adminId) throw new NotFoundException('Приглашение не найдено');
    if (invitation.status !== MasterInvitationStatus.PENDING) throw new ConflictException('Это приглашение уже не активно');

    const oldTokenHash = invitation.tokenHash;
    const oldExpiresAt = invitation.expiresAt;
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const updated = await this.prisma.masterInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt },
    });

    try {
      await this.sendInvitationEmail({ email: invitation.email, name: invitation.name, token });
    } catch (error) {
      await this.prisma.masterInvitation.update({
        where: { id: invitation.id },
        data: { tokenHash: oldTokenHash, expiresAt: oldExpiresAt },
      }).catch(() => undefined);
      throw error;
    }

    return this.invitationDto(updated);
  }

  async inspect(tokenValue: unknown) {
    const invitation = await this.findActiveInvitation(String(tokenValue || ''));
    const legalDocuments = await this.registrationDocuments();
    return {
      email: invitation.email,
      name: invitation.name,
      expiresAt: invitation.expiresAt,
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
      legal: {
        required: legalDocuments.filter((item) => item.requiredForRegistration).map((item) => ({ key: item.key, version: item.version })),
        marketingOptional: true,
      },
    };
  }

  async accept(input: RegistrationInput) {
    const token = String(input?.token || '').trim();
    const password = String(input?.password || '');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    const invitation = await this.findActiveInvitation(token);
    await this.legal.assertPlatformLegalReady('');
    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const legalDocuments = await this.registrationDocuments();
    this.assertRegistrationFacts(legalDocuments, input);
    const passwordHash = await hashPassword(password, 12);
    const evidence = input?.technicalEvidence && typeof input.technicalEvidence === 'object' && !Array.isArray(input.technicalEvidence)
      ? input.technicalEvidence as Record<string, unknown>
      : {};

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          onboardingStep: 0,
          workspaceUnlocked: false,
        },
      });
      const membership = await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });
      await tx.masterInvitation.update({
        where: { id: invitation.id },
        data: {
          status: MasterInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      for (const document of legalDocuments) {
        const fact = this.registrationFact(document.key, input);
        if (!fact.accepted) continue;
        await tx.$executeRaw`
          INSERT INTO "LegalAcceptanceEvent" (
            "id", "tenantId", "userId", "documentVersionId", "action", "source", "technicalEvidence", "occurredAt"
          ) VALUES (
            ${randomUUID()}, ${invitation.tenantId}, ${user.id}, ${document.versionId}, ${fact.action},
            'master-registration', ${json(evidence)}::jsonb, CURRENT_TIMESTAMP
          )
        `;
      }
      return { user, membership };
    });

    const accessToken = await this.jwt.signAsync({
      sub: result.user.id,
      tenantId: invitation.tenantId,
      role: result.membership.role,
    });

    if (input?.dpaAccepted === true) {
      await this.legal.updateTenantChecklist(invitation.tenantId, result.user.id, { dpaAccepted: true });
    }

    await this.legal.audit(invitation.tenantId, result.user.id, 'MASTER_REGISTRATION_ACCEPTED', 'REGISTRATION', 'SUCCESS', {
      invitationId: invitation.id,
      operationMode: 'DEMO',
      filingStatus: 'NOT_PREPARED',
      marketingConsent: input?.marketingConsentAccepted === true,
    });

    return {
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        onboardingStep: result.user.onboardingStep,
        workspaceUnlocked: result.user.workspaceUnlocked,
      },
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
      role: result.membership.role,
      legal: { operationMode: 'DEMO', filingStatus: 'NOT_PREPARED' },
    };
  }

  async listInvitations(adminId: string) {
    const rows = await this.prisma.masterInvitation.findMany({
      where: { createdByAdminId: adminId },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.invitationDto(row),
      tenant: { id: row.tenant.id, name: row.tenant.name },
    }));
  }

  private async platformAdminUserId(adminId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { userId: true },
    });
    if (!admin?.userId) throw new NotFoundException('Администратор Book не найден');
    return admin.userId;
  }

  private async registrationDocuments() {
    return this.prisma.$queryRaw<RegistrationDocument[]>`
      SELECT d."key", d."requiredForRegistration", v."id" AS "versionId", v."version"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v ON v."documentId" = d."id" AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM' AND d."tenantId" IS NULL AND d."isActive" = true
      ORDER BY d."createdAt" ASC, d."key" ASC
    `;
  }

  private registrationFact(key: string, input: RegistrationInput) {
    if (key === 'saas-agreement') return { accepted: input?.saasAgreementAccepted === true, action: 'ACCEPTED' };
    if (key === 'dpa') return { accepted: input?.dpaAccepted === true, action: 'ACCEPTED' };
    if (key === 'privacy-policy') return { accepted: input?.privacyAcknowledged === true, action: 'ACKNOWLEDGED' };
    if (key === 'master-pd-consent') return { accepted: input?.pdConsentAccepted === true, action: 'CONSENTED' };
    if (key === 'marketing-consent') return { accepted: input?.marketingConsentAccepted === true, action: 'CONSENTED' };
    return { accepted: false, action: 'ACKNOWLEDGED' };
  }

  private assertRegistrationFacts(documents: RegistrationDocument[], input: RegistrationInput) {
    for (const document of documents.filter((item) => item.requiredForRegistration)) {
      if (!this.registrationFact(document.key, input).accepted) {
        throw new BadRequestException(`Не подтверждён обязательный юридический факт: ${document.key}`);
      }
    }
    if (input?.marketingConsentAccepted !== true && input?.marketingConsentAccepted !== false && input?.marketingConsentAccepted !== undefined) {
      throw new BadRequestException('Некорректное значение marketing consent');
    }
  }

  private async findActiveInvitation(token: string) {
    if (!token) throw new BadRequestException('Приглашение отсутствует');
    const invitation = await this.prisma.masterInvitation.findUnique({
      where: { tokenHash: invitationHash(token) },
      include: { tenant: true },
    });
    if (!invitation) throw new NotFoundException('Приглашение не найдено');
    if (invitation.status !== MasterInvitationStatus.PENDING) throw new ConflictException('Приглашение уже использовано или отозвано');
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
      tag: 'master-invitation',
      text: `${input.name ? `Здравствуйте, ${input.name}.` : 'Здравствуйте.'}\n\nВам открыт персональный Book в режиме DEMO. Создайте пароль и начните настройку рабочего пространства:\n${url}\n\nСсылка действует 7 дней.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#292522"><h2>Book</h2><p>${greeting}</p><p>Вам открыт персональный Book в режиме DEMO. Создайте пароль и начните настройку своего рабочего пространства.</p><p style="margin:28px 0"><a href="${url}" style="background:#292522;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;display:inline-block">Создать пароль и войти</a></p><p style="color:#817a74;font-size:14px">Ссылка действует 7 дней.</p></div>`,
    });
  }

  private invitationDto(invitation: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    status: MasterInvitationStatus;
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

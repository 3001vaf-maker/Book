import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MasterInvitationStatus,
  MembershipRole,
  TenantAccessStatus,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { hash as hashPassword } from 'bcryptjs';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { PrismaService } from '../prisma.service';
import { MasterInvitationService } from '../master-invitation/master-invitation.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MANUAL_EMAIL_PREFIX = 'manual+';
const MANUAL_EMAIL_SUFFIX = '@book.invalid';
const DEFAULT_BOOK_APP_URL = 'https://book.va-tools.ru';

function text(value: unknown) {
  return String(value || '').trim();
}

function bookAppOrigin() {
  const configured = text(process.env.BOOK_APP_URL);
  if (configured) return configured.replace(/\/+$/, '');

  if (process.env.NODE_ENV !== 'production') {
    const stagingOrigin = text(process.env.CLIENT_APP_URL || process.env.FRONTEND_ORIGIN);
    if (stagingOrigin) return stagingOrigin.replace(/\/+$/, '');
  }

  return DEFAULT_BOOK_APP_URL;
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function invitationHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
}

function isManualEmail(email: string) {
  return email.startsWith(MANUAL_EMAIL_PREFIX) && email.endsWith(MANUAL_EMAIL_SUFFIX);
}

@Injectable()
export class ManualInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: MasterInvitationService,
    private readonly jwt: JwtService,
    private readonly legal: LegalRuntimeService,
  ) {}

  async create(adminId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { userId: true },
    });
    if (!admin?.userId) throw new NotFoundException('Администратор Book не найден');
    await this.legal.assertPlatformLegalReady(admin.userId);

    const plan = await this.invitations.ensureStarterPlan();
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const placeholderEmail = `${MANUAL_EMAIL_PREFIX}${tokenHash.slice(0, 24)}${MANUAL_EMAIL_SUFFIX}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: 'Новый мастер' } });
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
          email: placeholderEmail,
          name: '',
          tokenHash,
          expiresAt,
        },
      });
      return { tenant, invitation };
    });

    await this.legal.audit(created.tenant.id, admin.userId, 'MANUAL_MASTER_INVITATION_CREATED', 'REGISTRATION', 'SUCCESS', {
      invitationId: created.invitation.id,
      operationMode: 'DEMO',
    });

    const origin = bookAppOrigin();

    return {
      id: created.invitation.id,
      tenantId: created.tenant.id,
      url: `${origin}/register/?token=${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  async inspect(tokenValue: unknown) {
    await this.legal.assertPlatformLegalReady('');
    const invitation = await this.findManualInvitation(text(tokenValue));
    const documents = await this.legal.listDocuments('PLATFORM', null);
    const published = documents.filter((item) => item.currentVersion).map((item) => ({
      key: item.key,
      type: item.type,
      title: item.title,
      requiredForRegistration: item.requiredForRegistration,
      version: item.currentVersion!.version,
      content: item.currentVersion!.contentSnapshot,
      contentHash: item.currentVersion!.contentHash,
      operatorIdentity: item.currentVersion!.operatorIdentitySnapshot,
      publishedAt: item.currentVersion!.publishedAt,
    }));
    return {
      expiresAt: invitation.expiresAt,
      legal: {
        required: published.filter((item) => item.requiredForRegistration).map((item) => ({ key: item.key, version: item.version })),
        marketingOptional: true,
      },
      documents: published,
    };
  }

  async accept(input: {
    token?: unknown;
    name?: unknown;
    surname?: unknown;
    phone?: unknown;
    email?: unknown;
    password?: unknown;
    saasAgreementAccepted?: unknown;
    dpaAccepted?: unknown;
    privacyAcknowledged?: unknown;
    pdConsentAccepted?: unknown;
    marketingConsentAccepted?: unknown;
    technicalEvidence?: unknown;
  }) {
    const token = text(input?.token);
    const name = text(input?.name);
    const surname = text(input?.surname);
    const phone = text(input?.phone);
    const email = normalizeEmail(input?.email);
    const password = String(input?.password || '');

    if (!name) throw new BadRequestException('Укажите имя');
    if (!surname) throw new BadRequestException('Укажите фамилию');
    if (!phone) throw new BadRequestException('Укажите телефон');
    if (!email || !email.includes('@')) throw new BadRequestException('Укажите корректный email');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    await this.legal.assertPlatformLegalReady('');
    const invitation = await this.findManualInvitation(token);
    const legalDocuments = await this.legal.listDocuments('PLATFORM', null);
    const requiredDocuments = legalDocuments.filter((item) => item.requiredForRegistration && item.currentVersion);
    const fact = (key: string) => {
      if (key === 'saas-agreement') return { accepted: input?.saasAgreementAccepted === true, action: 'ACCEPTED' };
      if (key === 'dpa') return { accepted: input?.dpaAccepted === true, action: 'ACCEPTED' };
      if (key === 'privacy-policy') return { accepted: input?.privacyAcknowledged === true, action: 'ACKNOWLEDGED' };
      if (key === 'master-pd-consent') return { accepted: input?.pdConsentAccepted === true, action: 'CONSENTED' };
      if (key === 'marketing-consent') return { accepted: input?.marketingConsentAccepted === true, action: 'CONSENTED' };
      return { accepted: false, action: 'ACKNOWLEDGED' };
    };
    for (const document of requiredDocuments) {
      if (!fact(document.key).accepted) {
        throw new BadRequestException(`Не подтверждён обязательный юридический факт: ${document.key}`);
      }
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const passwordHash = await hashPassword(password, 12);
    const fullName = `${name} ${surname}`.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
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
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });
      await tx.profile.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          key: 'profile',
          name,
          surname,
          phone,
          phones: [phone],
          telegrams: [],
          emails: [email],
          about: '',
          photo: '',
          profession: '',
          experience: '',
          professionAbout: '',
          customProfessions: [],
          migrationVerifiedAt: new Date(),
        },
      });
      await tx.tenant.update({
        where: { id: invitation.tenantId },
        data: { name: fullName },
      });
      await tx.masterInvitation.update({
        where: { id: invitation.id },
        data: {
          email,
          name: fullName,
          status: MasterInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      const evidence = input?.technicalEvidence && typeof input.technicalEvidence === 'object' && !Array.isArray(input.technicalEvidence)
        ? input.technicalEvidence as Record<string, unknown>
        : {};
      for (const document of legalDocuments.filter((item) => item.currentVersion)) {
        const acceptance = fact(document.key);
        if (!acceptance.accepted) continue;
        await tx.$executeRaw`
          INSERT INTO "LegalAcceptanceEvent" (
            "id", "tenantId", "userId", "documentVersionId", "action", "source", "technicalEvidence", "occurredAt"
          ) VALUES (
            ${randomUUID()}, ${invitation.tenantId}, ${user.id}, ${document.currentVersion!.id}, ${acceptance.action},
            'manual-master-registration', ${JSON.stringify(evidence)}::jsonb, CURRENT_TIMESTAMP
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
    await this.legal.audit(invitation.tenantId, result.user.id, 'MANUAL_MASTER_REGISTRATION_ACCEPTED', 'REGISTRATION', 'SUCCESS', {
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
      tenant: { id: invitation.tenantId, name: fullName },
      role: result.membership.role,
      legal: { operationMode: 'DEMO', filingStatus: 'NOT_PREPARED' },
    };
  }

  async repairProfile(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const profile = await this.prisma.profile.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { migrationVerifiedAt: true },
    });
    if (!profile || profile.migrationVerifiedAt) {
      return { repaired: false, verified: Boolean(profile?.migrationVerifiedAt) };
    }

    const invitation = await this.prisma.masterInvitation.findFirst({
      where: {
        tenantId,
        email: user.email,
        status: MasterInvitationStatus.ACCEPTED,
      },
      select: { id: true },
    });
    if (!invitation) return { repaired: false, verified: false };

    await this.prisma.profile.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { migrationVerifiedAt: new Date() },
    });
    return { repaired: true, verified: true };
  }

  private async findManualInvitation(token: string) {
    if (!token) throw new BadRequestException('Ссылка регистрации недействительна');
    const invitation = await this.prisma.masterInvitation.findUnique({
      where: { tokenHash: invitationHash(token) },
      include: { tenant: true },
    });
    if (!invitation || !isManualEmail(invitation.email)) {
      throw new NotFoundException('Ссылка регистрации не найдена');
    }
    if (invitation.status !== MasterInvitationStatus.PENDING) {
      throw new ConflictException('Эта ссылка уже использована');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Срок действия ссылки истёк');
    }
    return invitation;
  }
}

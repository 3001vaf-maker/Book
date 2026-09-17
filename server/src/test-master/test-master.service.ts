import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MasterInvitationStatus, MembershipRole, TenantAccessStatus } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash as hashPassword } from 'bcryptjs';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { MasterInvitationService } from '../master-invitation/master-invitation.service';
import { PrismaService } from '../prisma.service';

const TEST_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
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
  type: string;
  title: string;
  requiredForRegistration: boolean;
  versionId: string;
  version: number;
  content: string;
  contentHash: string;
  operatorIdentity: Record<string, unknown>;
  publishedAt: Date;
};

@Injectable()
export class TestMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly invitations: MasterInvitationService,
    private readonly legal: LegalRuntimeService,
  ) {}

  async create(adminId: string, input: { name?: unknown }) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { userId: true },
    });
    if (!admin?.userId) throw new NotFoundException('Администратор Book не найден');

    const plan = await this.invitations.ensureStarterPlan();
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    const suffix = randomBytes(5).toString('hex');
    const email = `test-${suffix}@book.invalid`;
    const name = String(input?.name || '').trim() || `Тестовый мастер ${suffix.slice(0, 4)}`;
    const expiresAt = new Date(Date.now() + TEST_INVITATION_TTL_MS);

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: `[TEST] ${name}` } });
      await tx.tenantAccess.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: TenantAccessStatus.ACTIVE,
          isOwnerBook: false,
        },
      });
      await tx.$executeRaw`
        INSERT INTO "TestTenant" ("tenantId", "createdAt")
        VALUES (${tenant.id}, CURRENT_TIMESTAMP)
      `;
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
          tokenHash: hash,
          expiresAt,
        },
      });
      return { tenant, invitation };
    });

    await this.legal.audit(created.tenant.id, admin.userId, 'TEST_MASTER_CREATED', 'TEST_REGISTRATION', 'SUCCESS', {
      invitationId: created.invitation.id,
      synthetic: true,
      operationMode: 'DEMO',
    });

    return {
      tenantId: created.tenant.id,
      tenantName: created.tenant.name,
      email,
      name,
      expiresAt,
      test: true,
      invitePath: `/invite/?test=1&token=${encodeURIComponent(token)}`,
    };
  }

  async list() {
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string; createdAt: Date }>>`
      SELECT "tenantId", "createdAt" FROM "TestTenant" ORDER BY "createdAt" DESC
    `;
    const result = [];
    for (const row of rows) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: row.tenantId },
        include: {
          memberships: { include: { user: { select: { id: true, email: true } } } },
          masterInvitations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!tenant) continue;
      const legalState = await this.legal.tenantState(tenant.id);
      result.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        test: true,
        operationMode: legalState?.operationMode || 'DEMO',
        filingStatus: legalState?.filingStatus || 'NOT_PREPARED',
        registered: tenant.memberships.length > 0,
        userEmail: tenant.memberships[0]?.user.email || '',
        invitation: tenant.masterInvitations[0] ? {
          id: tenant.masterInvitations[0].id,
          status: tenant.masterInvitations[0].status,
          expiresAt: tenant.masterInvitations[0].expiresAt,
        } : null,
        createdAt: row.createdAt,
      });
    }
    return result;
  }

  async remove(tenantId: string, adminUserId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT "tenantId" FROM "TestTenant" WHERE "tenantId" = ${tenantId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('TEST Book не найден');
    await this.legal.audit(tenantId, adminUserId, 'TEST_MASTER_REMOVED', 'TEST_REGISTRATION', 'SUCCESS', { synthetic: true });
    await this.prisma.tenant.delete({ where: { id: tenantId } });
    return { removed: true, tenantId };
  }

  async inspect(tokenValue: unknown) {
    const invitation = await this.findTestInvitation(String(tokenValue || ''));
    const documents = await this.registrationDocuments();
    return {
      test: true,
      email: invitation.email,
      name: invitation.name,
      expiresAt: invitation.expiresAt,
      tenant: { id: invitation.tenant.id, name: invitation.tenant.name },
      legal: {
        required: documents.filter((item) => item.requiredForRegistration).map((item) => ({ key: item.key, version: item.version })),
        marketingOptional: true,
      },
    };
  }

  async documents(tokenValue: unknown) {
    await this.findTestInvitation(String(tokenValue || ''));
    return this.registrationDocuments();
  }

  async accept(input: RegistrationInput) {
    const token = String(input?.token || '').trim();
    const password = String(input?.password || '');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    const invitation = await this.findTestInvitation(token);
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new ConflictException('Этот TEST мастер уже зарегистрирован');

    const documents = await this.registrationDocuments();
    this.assertRegistrationFacts(documents, input);
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
        data: { status: MasterInvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });

      for (const document of documents) {
        const fact = this.registrationFact(document.key, input);
        if (!fact.accepted) continue;
        await tx.$executeRaw`
          INSERT INTO "LegalAcceptanceEvent" (
            "id", "tenantId", "userId", "documentVersionId", "action", "source", "technicalEvidence", "occurredAt"
          ) VALUES (
            ${randomUUID()}, ${invitation.tenantId}, ${user.id}, ${document.versionId}, ${fact.action},
            'test-master-registration', ${json({ ...evidence, synthetic: true })}::jsonb, CURRENT_TIMESTAMP
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

    await this.legal.audit(invitation.tenantId, result.user.id, 'TEST_MASTER_REGISTRATION_ACCEPTED', 'TEST_REGISTRATION', 'SUCCESS', {
      synthetic: true,
      operationMode: 'DEMO',
      filingStatus: 'NOT_PREPARED',
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
      test: true,
      legal: { operationMode: 'DEMO', filingStatus: 'NOT_PREPARED' },
    };
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
  }

  private async registrationDocuments() {
    return this.prisma.$queryRaw<RegistrationDocument[]>`
      SELECT d."key", d."type", d."title", d."requiredForRegistration",
             v."id" AS "versionId", v."version", v."contentSnapshot" AS "content",
             v."contentHash", v."operatorIdentitySnapshot" AS "operatorIdentity", v."publishedAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v ON v."documentId" = d."id" AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM' AND d."tenantId" IS NULL AND d."isActive" = true
      ORDER BY d."createdAt" ASC, d."key" ASC
    `;
  }

  private async findTestInvitation(token: string) {
    if (!token) throw new BadRequestException('TEST приглашение отсутствует');
    const invitation = await this.prisma.masterInvitation.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { tenant: true },
    });
    if (!invitation) throw new NotFoundException('TEST приглашение не найдено');
    const testRows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT "tenantId" FROM "TestTenant" WHERE "tenantId" = ${invitation.tenantId} LIMIT 1
    `;
    if (!testRows[0]) throw new NotFoundException('Это не TEST приглашение');
    if (invitation.status !== MasterInvitationStatus.PENDING) throw new ConflictException('TEST приглашение уже использовано или отозвано');
    if (invitation.expiresAt.getTime() <= Date.now()) throw new ConflictException('Срок TEST приглашения истёк');
    return invitation;
  }
}
